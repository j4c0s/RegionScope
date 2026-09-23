package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/gorilla/websocket"

	"github.com/corescope/analyzer/pkg/packet"
	"github.com/corescope/analyzer/pkg/storage"
)

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	mu          sync.RWMutex
	clients     = make(map[*ClientConn]bool)
	recentPkts  = make([]*packet.ParsedPacket, 0, 20)
	brokerConns = make(map[string]*BrokerConfig)
	configFile  = "brokers.json"
	dbStorage   *storage.Storage
)

type ClientConn struct {
	conn *websocket.Conn
	wmu  sync.Mutex
}

func (c *ClientConn) WriteJSON(v interface{}) error {
	c.wmu.Lock()
	defer c.wmu.Unlock()
	return c.conn.WriteJSON(v)
}

type BrokerConfig struct {
	ID      string      `json:"id"`
	Broker  string      `json:"broker"` // e.g. "tcp://mqtt.marwoj.net:1883"
	Topic   string      `json:"topic"`  // e.g. "meshcore/#"
	User    string      `json:"user,omitempty"`
	Pass    string      `json:"pass,omitempty"`
	Enabled bool        `json:"enabled"`
	Status  string      `json:"status"` // "connected", "connecting", "disconnected", "paused", "error"
	Client  mqtt.Client `json:"-"`
}

type WsMessage struct {
	Type     string                 `json:"type"` // "packet", "status", "brokers", "init", "topology", "cleared"
	Status   string                 `json:"status,omitempty"`
	Brokers  []*BrokerConfig        `json:"brokers,omitempty"`
	Packets  []*packet.ParsedPacket `json:"packets,omitempty"`
	Packet   *packet.ParsedPacket   `json:"packet,omitempty"`
	Topology *storage.TopologyGraph `json:"topology,omitempty"`
}

func main() {
	portFlag := flag.String("port", "", "HTTP port to listen on (e.g. 8085)")
	cfgFlag := flag.String("config", "brokers.json", "Path to brokers configuration file")
	dbFlag := flag.String("db", "analyzer.db", "Path to SQLite database file")
	flag.Parse()

	if *cfgFlag != "" {
		configFile = *cfgFlag
	}

	requestedPort := *portFlag
	if requestedPort == "" {
		requestedPort = getEnv("HTTP_PORT", "8085")
	}

	defaultBrokers := getEnv("MQTT_BROKERS", getEnv("MQTT_BROKER", ""))
	defaultUser := getEnv("MQTT_USERNAME", "")
	defaultPass := getEnv("MQTT_PASSWORD", "")
	simulate := getEnv("SIMULATE", "false")

	log.Printf("[Analyzer] Starting MeshCore Packet Analyzer...")

	// Initialize SQLite Database
	var err error
	dbStorage, err = storage.InitDB(*dbFlag)
	if err != nil {
		log.Fatalf("[DB] Failed to initialize SQLite database: %v", err)
	}
	defer dbStorage.Close()
	log.Printf("[DB] SQLite database initialized at: %s", *dbFlag)

	// Load persisted brokers configuration from disk
	loadBrokersConfig()

	// If env variable brokers provided and not in config, add them
	if defaultBrokers != "" {
		brokers := strings.Split(defaultBrokers, ",")
		for _, b := range brokers {
			b = strings.TrimSpace(b)
			if b != "" {
				if !strings.HasPrefix(b, "tcp://") && !strings.HasPrefix(b, "ssl://") && !strings.HasPrefix(b, "ws://") && !strings.HasPrefix(b, "wss://") {
					b = "tcp://" + b
				}
				if !brokerExists(b) {
					addBroker(b, "meshcore/#", defaultUser, defaultPass, true)
				}
			}
		}
	}

	if simulate == "true" {
		go runSimulator()
	}

	webDir := resolveWebDir()
	log.Printf("[Analyzer] Serving web UI from: %s", webDir)

	fs := http.FileServer(http.Dir(webDir))

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/ws":
			handleWebSockets(w, r)
		case r.URL.Path == "/api/health":
			handleHealth(w, r)
		case r.URL.Path == "/api/brokers":
			handleBrokersApi(w, r)
		case r.URL.Path == "/api/topology":
			handleTopologyApi(w, r)
		case r.URL.Path == "/api/clear":
			handleClearApi(w, r)
		case r.URL.Path == "/api/simulate":
			handleSimulate(w, r)
		default:
			fs.ServeHTTP(w, r)
		}
	})

	listener, portStr, err := bindAvailablePort(requestedPort)
	if err != nil {
		log.Fatalf("[Analyzer] Failed to bind any HTTP port: %v", err)
	}

	log.Printf("==========================================================")
	log.Printf("[Analyzer] SUCCESS! Server running on PC.")
	log.Printf("[Analyzer] Open browser at: http://localhost:%s/", portStr)
	log.Printf("==========================================================")

	if err := http.Serve(listener, handler); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

func resolveWebDir() string {
	candidates := []string{
		getEnv("WEB_DIR", ""),
		"web",
		"analyzer/web",
		"../web",
		"../../web",
	}
	for _, c := range candidates {
		if c == "" {
			continue
		}
		if info, err := os.Stat(c); err == nil && info.IsDir() {
			return c
		}
	}
	return "web"
}

func brokerExists(brokerUrl string) bool {
	mu.RLock()
	defer mu.RUnlock()
	for _, b := range brokerConns {
		if b.Broker == brokerUrl {
			return true
		}
	}
	return false
}

func loadBrokersConfig() {
	if _, err := os.Stat(configFile); os.IsNotExist(err) {
		return
	}

	data, err := os.ReadFile(configFile)
	if err != nil {
		log.Printf("[Config] Failed to read %s: %v", configFile, err)
		return
	}

	var savedBrokers []*BrokerConfig
	if err := json.Unmarshal(data, &savedBrokers); err != nil {
		log.Printf("[Config] Failed to parse %s: %v", configFile, err)
		return
	}

	mu.Lock()
	for _, b := range savedBrokers {
		if b.ID == "" {
			b.ID = randomID()
		}
		if b.Status == "" {
			b.Status = "disconnected"
		}
		brokerConns[b.ID] = b
	}
	mu.Unlock()

	for _, b := range savedBrokers {
		if b.Enabled {
			go connectMQTT(b)
		} else {
			b.Status = "paused"
		}
	}

	log.Printf("[Config] Loaded %d brokers from %s", len(savedBrokers), configFile)
}

func saveBrokersConfig() {
	mu.RLock()
	list := make([]*BrokerConfig, 0, len(brokerConns))
	for _, b := range brokerConns {
		cp := &BrokerConfig{
			ID:      b.ID,
			Broker:  b.Broker,
			Topic:   b.Topic,
			User:    b.User,
			Pass:    b.Pass,
			Enabled: b.Enabled,
			Status:  b.Status,
		}
		list = append(list, cp)
	}
	mu.RUnlock()

	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		log.Printf("[Config] Failed to marshal brokers config: %v", err)
		return
	}

	dir := filepath.Dir(configFile)
	if dir != "." && dir != "" {
		_ = os.MkdirAll(dir, 0755)
	}

	if err := os.WriteFile(configFile, data, 0644); err != nil {
		log.Printf("[Config] Failed to write %s: %v", configFile, err)
	} else {
		log.Printf("[Config] Saved %d brokers to %s", len(list), configFile)
	}
}

func bindAvailablePort(startPort string) (net.Listener, string, error) {
	portNum, err := strconv.Atoi(startPort)
	if err != nil || portNum <= 0 {
		portNum = 8085
	}

	for p := portNum; p < portNum+20; p++ {
		addr := fmt.Sprintf(":%d", p)
		l, err := net.Listen("tcp", addr)
		if err == nil {
			return l, strconv.Itoa(p), nil
		}
		log.Printf("[Analyzer] Port %d busy, trying next...", p)
	}

	return nil, "", fmt.Errorf("all ports in range %d-%d are busy", portNum, portNum+20)
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func randomID() string {
	b := make([]byte, 4)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func addBroker(brokerUrl, topic, user, pass string, enabled bool) *BrokerConfig {
	if topic == "" {
		topic = "meshcore/#"
	}
	id := randomID()

	cfg := &BrokerConfig{
		ID:      id,
		Broker:  brokerUrl,
		Topic:   topic,
		User:    user,
		Pass:    pass,
		Enabled: enabled,
		Status:  "connecting",
	}

	if !enabled {
		cfg.Status = "paused"
	}

	mu.Lock()
	brokerConns[id] = cfg
	mu.Unlock()

	if enabled {
		go connectMQTT(cfg)
	}

	saveBrokersConfig()
	broadcastBrokersStatus()
	return cfg
}

func toggleBroker(id string, enabled bool) {
	mu.Lock()
	cfg, exists := brokerConns[id]
	if !exists {
		mu.Unlock()
		return
	}

	cfg.Enabled = enabled
	if !enabled {
		cfg.Status = "paused"
		if cfg.Client != nil && cfg.Client.IsConnected() {
			cfg.Client.Disconnect(250)
		}
		cfg.Client = nil
		mu.Unlock()
	} else {
		cfg.Status = "connecting"
		mu.Unlock()
		go connectMQTT(cfg)
	}

	saveBrokersConfig()
	broadcastBrokersStatus()
}

func connectMQTT(cfg *BrokerConfig) {
	clientID := fmt.Sprintf("meshcore-analyzer-%s-%d", cfg.ID, time.Now().UnixNano()%100000)
	opts := mqtt.NewClientOptions().AddBroker(cfg.Broker).SetClientID(clientID)
	opts.SetAutoReconnect(true)
	opts.SetConnectRetry(true)
	opts.SetConnectRetryInterval(5 * time.Second)

	if cfg.User != "" {
		opts.SetUsername(cfg.User)
		opts.SetPassword(cfg.Pass)
	}

	opts.OnConnect = func(c mqtt.Client) {
		log.Printf("[MQTT:%s] Connected to %s", cfg.ID, cfg.Broker)
		mu.Lock()
		cfg.Status = "connected"
		mu.Unlock()
		broadcastBrokersStatus()

		topicToSub := cfg.Topic
		if topicToSub == "" {
			topicToSub = "meshcore/#"
		}

		topicsMap := map[string]byte{
			topicToSub: 0,
		}

		token := c.SubscribeMultiple(topicsMap, func(client mqtt.Client, msg mqtt.Message) {
			// Don't flood log with /status topics if they don't contain raw packet hex
			if strings.HasSuffix(msg.Topic(), "/status") {
				pkt, err := packet.ParseMeshCorePacket(msg.Topic(), msg.Payload())
				if err != nil {
					return
				}
				log.Printf("[MQTT:%s] Ingested packet on %s (Region: %s, Observer: %s)", cfg.ID, msg.Topic(), pkt.Region, pkt.Observer)
				addAndBroadcastPacket(pkt)
				return
			}

			pkt, err := packet.ParseMeshCorePacket(msg.Topic(), msg.Payload())
			if err != nil {
				log.Printf("[MQTT:%s] Ignored message on %s: %v", cfg.ID, msg.Topic(), err)
				return
			}
			log.Printf("[MQTT:%s] Ingested packet on %s (Region: %s, Observer: %s)", cfg.ID, msg.Topic(), pkt.Region, pkt.Observer)
			addAndBroadcastPacket(pkt)
		})
		token.Wait()
		if token.Error() != nil {
			log.Printf("[MQTT:%s] Subscribe error on %s: %v", cfg.ID, cfg.Topic, token.Error())
		}
	}

	opts.OnConnectionLost = func(c mqtt.Client, err error) {
		log.Printf("[MQTT:%s] Connection lost on %s: %v", cfg.ID, cfg.Broker, err)
		mu.Lock()
		if cfg.Enabled {
			cfg.Status = "disconnected"
		} else {
			cfg.Status = "paused"
		}
		mu.Unlock()
		broadcastBrokersStatus()
	}

	client := mqtt.NewClient(opts)
	cfg.Client = client
	if token := client.Connect(); token.Wait() && token.Error() != nil {
		log.Printf("[MQTT:%s] Initial connect error on %s: %v", cfg.ID, cfg.Broker, token.Error())
		mu.Lock()
		if cfg.Enabled {
			cfg.Status = "error"
		}
		mu.Unlock()
		broadcastBrokersStatus()
	}
}

func removeBroker(id string) {
	mu.Lock()
	cfg, exists := brokerConns[id]
	if exists {
		if cfg.Client != nil && cfg.Client.IsConnected() {
			cfg.Client.Disconnect(250)
		}
		delete(brokerConns, id)
	}
	mu.Unlock()

	saveBrokersConfig()
	broadcastBrokersStatus()
}

func addAndBroadcastPacket(pkt *packet.ParsedPacket) {
	if dbStorage != nil {
		dbStorage.RecordPacket(pkt)
	}

	mu.Lock()
	if len(recentPkts) >= 20 {
		recentPkts = recentPkts[1:]
	}
	recentPkts = append(recentPkts, pkt)
	mu.Unlock()

	var topo *storage.TopologyGraph
	if dbStorage != nil {
		topo, _ = dbStorage.GetTopologyGraph()
	}

	broadcastJson(WsMessage{
		Type:     "packet",
		Packet:   pkt,
		Topology: topo,
	})
}

func getBrokersList() []*BrokerConfig {
	mu.RLock()
	defer mu.RUnlock()
	list := make([]*BrokerConfig, 0, len(brokerConns))
	for _, b := range brokerConns {
		list = append(list, b)
	}
	return list
}

func getRecentPacketsCopy() []*packet.ParsedPacket {
	mu.RLock()
	defer mu.RUnlock()
	cp := make([]*packet.ParsedPacket, len(recentPkts))
	copy(cp, recentPkts)
	return cp
}

func broadcastBrokersStatus() {
	brokers := getBrokersList()
	broadcastJson(WsMessage{
		Type:    "brokers",
		Brokers: brokers,
	})
}

func broadcastJson(msg interface{}) {
	mu.RLock()
	clientList := make([]*ClientConn, 0, len(clients))
	for c := range clients {
		clientList = append(clientList, c)
	}
	mu.RUnlock()

	for _, c := range clientList {
		err := c.WriteJSON(msg)
		if err != nil {
			mu.Lock()
			delete(clients, c)
			mu.Unlock()
			c.conn.Close()
		}
	}
}

func handleWebSockets(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS] Upgrade error: %v", err)
		return
	}

	clientConn := &ClientConn{conn: conn}

	mu.Lock()
	clients[clientConn] = true
	mu.Unlock()

	var topo *storage.TopologyGraph
	if dbStorage != nil {
		topo, _ = dbStorage.GetTopologyGraph()
	}

	initMsg := WsMessage{
		Type:     "init",
		Brokers:  getBrokersList(),
		Packets:  getRecentPacketsCopy(),
		Topology: topo,
	}
	_ = clientConn.WriteJSON(initMsg)

	go func() {
		defer func() {
			mu.Lock()
			delete(clients, clientConn)
			mu.Unlock()
			conn.Close()
		}()

		for {
			_, msgBytes, err := conn.ReadMessage()
			if err != nil {
				break
			}

			var req struct {
				Action   string `json:"action"` // "add_broker", "remove_broker", "toggle_broker", "clear_db", "delete_node", "delete_edge"
				ID       string `json:"id"`
				Source   string `json:"source"`
				Target   string `json:"target"`
				Host     string `json:"host"`
				Port     string `json:"port"`
				Topic    string `json:"topic"`
				Username string `json:"username"`
				Password string `json:"password"`
				Enabled  *bool  `json:"enabled"`
			}

			if err := json.Unmarshal(msgBytes, &req); err == nil {
				if req.Action == "add_broker" {
					host := strings.TrimSpace(req.Host)
					if host != "" {
						port := strings.TrimSpace(req.Port)
						if port == "" {
							port = "1883"
						}
						brokerUrl := host
						if !strings.HasPrefix(brokerUrl, "tcp://") && !strings.HasPrefix(brokerUrl, "ssl://") && !strings.HasPrefix(brokerUrl, "ws://") && !strings.HasPrefix(brokerUrl, "wss://") {
							brokerUrl = "tcp://" + brokerUrl + ":" + port
						}
						addBroker(brokerUrl, req.Topic, req.Username, req.Password, true)
					}
				} else if req.Action == "remove_broker" && req.ID != "" {
					removeBroker(req.ID)
				} else if req.Action == "toggle_broker" && req.ID != "" && req.Enabled != nil {
					toggleBroker(req.ID, *req.Enabled)
				} else if req.Action == "clear_db" {
					clearAllData()
				} else if req.Action == "delete_node" && req.ID != "" {
					if dbStorage != nil {
						_ = dbStorage.DeleteNode(req.ID)
						broadcastTopology()
					}
				} else if req.Action == "delete_edge" && req.Source != "" && req.Target != "" {
					if dbStorage != nil {
						_ = dbStorage.DeleteEdge(req.Source, req.Target)
						broadcastTopology()
					}
				}
			}
		}
	}()
}

func broadcastTopology() {
	var topo *storage.TopologyGraph
	if dbStorage != nil {
		topo, _ = dbStorage.GetTopologyGraph()
	}
	broadcastJson(WsMessage{
		Type:     "topology",
		Topology: topo,
	})
}

func clearAllData() {
	if dbStorage != nil {
		_ = dbStorage.ClearDatabase()
	}

	mu.Lock()
	recentPkts = make([]*packet.ParsedPacket, 0, 20)
	mu.Unlock()

	var emptyTopo *storage.TopologyGraph
	if dbStorage != nil {
		emptyTopo, _ = dbStorage.GetTopologyGraph()
	}

	broadcastJson(WsMessage{
		Type:     "cleared",
		Packets:  []*packet.ParsedPacket{},
		Topology: emptyTopo,
	})
}

func handleBrokersApi(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == "POST" {
		var req struct {
			Host     string `json:"host"`
			Port     string `json:"port"`
			Topic    string `json:"topic"`
			Username string `json:"username"`
			Password string `json:"password"`
			Enabled  *bool  `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil && req.Host != "" {
			port := req.Port
			if port == "" {
				port = "1883"
			}
			brokerUrl := req.Host
			if !strings.HasPrefix(brokerUrl, "tcp://") && !strings.HasPrefix(brokerUrl, "ssl://") && !strings.HasPrefix(brokerUrl, "ws://") && !strings.HasPrefix(brokerUrl, "wss://") {
				brokerUrl = "tcp://" + brokerUrl + ":" + port
			}
			enabled := true
			if req.Enabled != nil {
				enabled = *req.Enabled
			}
			cfg := addBroker(brokerUrl, req.Topic, req.Username, req.Password, enabled)
			json.NewEncoder(w).Encode(cfg)
			return
		}
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	json.NewEncoder(w).Encode(getBrokersList())
}

func handleTopologyApi(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if dbStorage == nil {
		json.NewEncoder(w).Encode(map[string]interface{}{"nodes": []string{}, "edges": []string{}})
		return
	}
	topo, err := dbStorage.GetTopologyGraph()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(topo)
}

func handleClearApi(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	clearAllData()
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	mu.RLock()
	count := len(recentPkts)
	mu.RUnlock()

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":       "ok",
		"brokers":      getBrokersList(),
		"recent_count": count,
	})
}

func handleSimulate(w http.ResponseWriter, r *http.Request) {
	pkt := createSimulatedPacket()
	addAndBroadcastPacket(pkt)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "simulated_packet_sent",
		"packet": pkt,
	})
}

func runSimulator() {
	ticker := time.NewTicker(3 * time.Second)
	for range ticker.C {
		addAndBroadcastPacket(createSimulatedPacket())
	}
}

func createSimulatedPacket() *packet.ParsedPacket {
	sizes := []byte{0x02, 0x42, 0x82}
	pathByte := sizes[time.Now().UnixNano()%3]

	var hopsBytes []byte
	switch pathByte {
	case 0x02:
		hopsBytes = []byte{0xA1, 0xB2}
	case 0x42:
		hopsBytes = []byte{0xC1, 0xD2, 0xE3, 0xF4}
	case 0x82:
		hopsBytes = []byte{0x03, 0x3D, 0xA9, 0xE5, 0x6A, 0x45}
	}

	headerByte := byte(0x05) // GRP_TXT by default
	if time.Now().UnixNano()%4 == 0 {
		headerByte = byte(0x11) // ADVERT: payloadType=4 -> (4<<2)|1 = 0x11
	}

	rawBuf := []byte{headerByte, pathByte}
	rawBuf = append(rawBuf, hopsBytes...)

	if headerByte == 0x11 {
		// Append Advert payload (Key + Name)
		rawBuf = append(rawBuf, []byte{0x03, 0x3D, 0xA9, 0xE5}...)
		rawBuf = append(rawBuf, []byte("PL-KRK-REP-1")...)
	}

	rawHex := hex.EncodeToString(rawBuf)

	regions := []string{"KRK", "WAW", "RZE", "RDO", "GDN"}
	region := regions[time.Now().UnixNano()%int64(len(regions))]

	pkt, _ := packet.ParseMeshCorePacket("meshcore/"+region+"/033DA9E56A45/packets", []byte(rawHex))
	if pkt != nil {
		pkt.Hash = fmt.Sprintf("%X", time.Now().UnixNano()%0xFFFFFFFF)
		pkt.Origin = "Node " + strconv.Itoa(int(time.Now().Unix()%100))
	}
	return pkt
}
