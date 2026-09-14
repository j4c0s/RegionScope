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
	"strconv"
	"strings"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/gorilla/websocket"

	"github.com/corescope/analyzer/pkg/packet"
)

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	mu          sync.RWMutex
	clients     = make(map[*ClientConn]bool)
	recentPkts  = make([]*packet.ParsedPacket, 0, 20)
	brokerConns = make(map[string]*BrokerConfig)
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
	ID     string      `json:"id"`
	Broker string      `json:"broker"` // e.g. "tcp://mqtt.marwoj.net:1883"
	Topic  string      `json:"topic"`  // e.g. "meshcore/#"
	User   string      `json:"user,omitempty"`
	Pass   string      `json:"pass,omitempty"`
	Status string      `json:"status"` // "connected", "connecting", "disconnected", "error"
	Client mqtt.Client `json:"-"`
}

type WsMessage struct {
	Type    string                 `json:"type"` // "packet", "status", "brokers", "init"
	Status  string                 `json:"status,omitempty"`
	Brokers []*BrokerConfig        `json:"brokers,omitempty"`
	Packets []*packet.ParsedPacket `json:"packets,omitempty"`
	Packet  *packet.ParsedPacket   `json:"packet,omitempty"`
}

func main() {
	portFlag := flag.String("port", "", "HTTP port to listen on (e.g. 8085)")
	flag.Parse()

	requestedPort := *portFlag
	if requestedPort == "" {
		requestedPort = getEnv("HTTP_PORT", "8085")
	}

	defaultBrokers := getEnv("MQTT_BROKERS", getEnv("MQTT_BROKER", ""))
	defaultTopic := getEnv("MQTT_TOPIC", "meshcore/#")
	defaultUser := getEnv("MQTT_USERNAME", "")
	defaultPass := getEnv("MQTT_PASSWORD", "")
	simulate := getEnv("SIMULATE", "false")

	log.Printf("[Analyzer] Starting MeshCore Packet Analyzer...")

	if defaultBrokers != "" {
		brokers := strings.Split(defaultBrokers, ",")
		for _, b := range brokers {
			b = strings.TrimSpace(b)
			if b != "" {
				if !strings.HasPrefix(b, "tcp://") && !strings.HasPrefix(b, "ssl://") && !strings.HasPrefix(b, "ws://") && !strings.HasPrefix(b, "wss://") {
					b = "tcp://" + b
				}
				addBroker(b, defaultTopic, defaultUser, defaultPass)
			}
		}
	}

	if simulate == "true" {
		go runSimulator()
	}

	webDir := getEnv("WEB_DIR", "web")
	if _, err := os.Stat(webDir); os.IsNotExist(err) {
		webDir = "../../web"
	}

	fs := http.FileServer(http.Dir(webDir))

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/ws":
			handleWebSockets(w, r)
		case r.URL.Path == "/api/health":
			handleHealth(w, r)
		case r.URL.Path == "/api/brokers":
			handleBrokersApi(w, r)
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

func bindAvailablePort(startPort string) (net.Listener, string, error) {
	portNum, err := strconv.Atoi(startPort)
	if err != nil || portNum <= 0 {
		portNum = 8085
	}

	// Try requested port first, then fallback to next 20 ports if busy
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

func addBroker(brokerUrl, topic, user, pass string) *BrokerConfig {
	if topic == "" {
		topic = "meshcore/#"
	}
	id := randomID()

	cfg := &BrokerConfig{
		ID:     id,
		Broker: brokerUrl,
		Topic:  topic,
		User:   user,
		Pass:   pass,
		Status: "connecting",
	}

	mu.Lock()
	brokerConns[id] = cfg
	mu.Unlock()

	go connectMQTT(cfg)
	broadcastBrokersStatus()
	return cfg
}

func connectMQTT(cfg *BrokerConfig) {
	clientID := "meshcore-analyzer-" + cfg.ID
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

		token := c.Subscribe(cfg.Topic, 0, func(client mqtt.Client, msg mqtt.Message) {
			pkt, err := packet.ParseMeshCorePacket(msg.Topic(), msg.Payload())
			if err != nil {
				return
			}
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
		cfg.Status = "disconnected"
		mu.Unlock()
		broadcastBrokersStatus()
	}

	client := mqtt.NewClient(opts)
	cfg.Client = client
	if token := client.Connect(); token.Wait() && token.Error() != nil {
		log.Printf("[MQTT:%s] Initial connect error on %s: %v", cfg.ID, cfg.Broker, token.Error())
		mu.Lock()
		cfg.Status = "error"
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
	broadcastBrokersStatus()
}

func addAndBroadcastPacket(pkt *packet.ParsedPacket) {
	mu.Lock()
	if len(recentPkts) >= 20 {
		recentPkts = recentPkts[1:]
	}
	recentPkts = append(recentPkts, pkt)
	mu.Unlock()

	broadcastJson(WsMessage{
		Type:   "packet",
		Packet: pkt,
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

	initMsg := WsMessage{
		Type:    "init",
		Brokers: getBrokersList(),
		Packets: getRecentPacketsCopy(),
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
				Action   string `json:"action"`
				ID       string `json:"id"`
				Host     string `json:"host"`
				Port     string `json:"port"`
				Topic    string `json:"topic"`
				Username string `json:"username"`
				Password string `json:"password"`
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
						addBroker(brokerUrl, req.Topic, req.Username, req.Password)
					}
				} else if req.Action == "remove_broker" && req.ID != "" {
					removeBroker(req.ID)
				}
			}
		}
	}()
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
			cfg := addBroker(brokerUrl, req.Topic, req.Username, req.Password)
			json.NewEncoder(w).Encode(cfg)
			return
		}
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	json.NewEncoder(w).Encode(getBrokersList())
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
		hopsBytes = []byte{0x11, 0x22, 0x33, 0x44, 0x55, 0x66}
	}

	rawBuf := []byte{0x05, pathByte}
	rawBuf = append(rawBuf, hopsBytes...)
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
