package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"

	"github.com/corescope/analyzer/pkg/packet"
)

type Node struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	LastSeen   string   `json:"last_seen"`
	Lat        float64  `json:"lat,omitempty"`
	Lon        float64  `json:"lon,omitempty"`
	Scopes     []string `json:"scopes"`     // e.g. ["KRK", "WAW"]
	PathSizes  []int    `json:"path_sizes"` // e.g. [2, 3]
}

type Edge struct {
	Source       string `json:"source"`
	Target       string `json:"target"`
	LastSeen     string `json:"last_seen"`
	TrafficCount int    `json:"traffic_count"`
}

type TopologyGraph struct {
	Nodes []*Node `json:"nodes"`
	Edges []*Edge `json:"edges"`
}

type Storage struct {
	db *sql.DB
	mu sync.RWMutex
}

func InitDB(dbPath string) (*Storage, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %v", err)
	}

	s := &Storage{db: db}
	if err := s.initSchema(); err != nil {
		db.Close()
		return nil, err
	}

	return s, nil
}

func (s *Storage) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS nodes (
		id TEXT PRIMARY KEY,
		name TEXT,
		last_seen TEXT,
		lat REAL DEFAULT 0,
		lon REAL DEFAULT 0,
		scopes_json TEXT DEFAULT '[]',
		path_sizes_json TEXT DEFAULT '[]'
	);

	CREATE TABLE IF NOT EXISTS node_aliases (
		alias_id TEXT PRIMARY KEY,
		target_id TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS edges (
		source TEXT,
		target TEXT,
		last_seen TEXT,
		traffic_count INTEGER DEFAULT 1,
		PRIMARY KEY (source, target)
	);

	CREATE TABLE IF NOT EXISTS packets (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		timestamp TEXT,
		region TEXT,
		observer TEXT,
		origin TEXT,
		scope_name TEXT DEFAULT '',
		route_type INTEGER DEFAULT 0,
		payload_type INTEGER,
		type_name TEXT,
		path_byte_size INTEGER,
		hops_json TEXT,
		resolved_hops_json TEXT,
		hash TEXT,
		raw_hex TEXT,
		packet_size INTEGER DEFAULT 0,
		snr REAL,
		rssi INTEGER,
		channel_name TEXT DEFAULT '',
		decrypted_txt TEXT DEFAULT '',
		sender TEXT DEFAULT '',
		decoded_json TEXT DEFAULT ''
	);
	`
	_, err := s.db.Exec(schema)
	return err
}

func (s *Storage) Close() error {
	return s.db.Close()
}

func (s *Storage) ClearDatabase() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM nodes;"); err != nil {
		return err
	}
	if _, err := tx.Exec("DELETE FROM edges;"); err != nil {
		return err
	}
	if _, err := tx.Exec("DELETE FROM packets;"); err != nil {
		return err
	}

	return tx.Commit()
}

func (s *Storage) RecordPacket(pkt *packet.ParsedPacket) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UTC().Format(time.RFC3339)

	// 1. Resolve Hops prefixes using known nodes and topology adjacency
	resolvedHops := make([]string, len(pkt.Hops))
	for i, hop := range pkt.Hops {
		var neighbors []string
		for j, h := range pkt.Hops {
			if j != i {
				neighbors = append(neighbors, h)
			}
		}
		if pkt.AdvertKey != "" {
			neighbors = append(neighbors, pkt.AdvertKey)
		}
		if pkt.Observer != "" {
			neighbors = append(neighbors, pkt.Observer)
		}

		resolvedHops[i] = s.resolvePrefixLocked(hop, neighbors)
	}
	pkt.ResolvedHops = resolvedHops

	// 2. Insert/Update Nodes & Edges for topology graph
	// Include ALL nodes (1B, 2B, 3B) in the topology map
	for i, hopID := range resolvedHops {
		s.upsertNodeLocked(hopID, "", 0, 0, pkt.Region, pkt.PathByteSize, now)
		if i > 0 {
			prevID := resolvedHops[i-1]
			s.upsertEdgeLocked(prevID, hopID, now)
		}
	}

	// Link Last Hop to Observer node if present
	if pkt.Observer != "" {
		s.upsertNodeLocked(pkt.Observer, pkt.Observer, 0, 0, pkt.Region, 0, now)
		if len(resolvedHops) > 0 {
			lastHop := resolvedHops[len(resolvedHops)-1]
			s.upsertEdgeLocked(lastHop, pkt.Observer, now)
		}
	}

	// Link Advert Node: Advert -> First Hop -> ... -> Last Hop -> Observer
	if pkt.AdvertKey != "" {
		s.upsertNodeLocked(pkt.AdvertKey, pkt.AdvertName, pkt.Lat, pkt.Lon, pkt.Region, pkt.PathByteSize, now)

		if len(resolvedHops) > 0 {
			firstHop := resolvedHops[0]
			s.upsertEdgeLocked(pkt.AdvertKey, firstHop, now)
		} else if pkt.Observer != "" {
			s.upsertEdgeLocked(pkt.AdvertKey, pkt.Observer, now)
		}
	}

	// 3. Insert Packet record in history
	hopsJson, _ := json.Marshal(pkt.Hops)
	resolvedHopsJson, _ := json.Marshal(pkt.ResolvedHops)

	res, err := s.db.Exec(`
		INSERT INTO packets (
			timestamp, region, observer, origin, scope_name, route_type,
			payload_type, type_name, path_byte_size, hops_json, resolved_hops_json,
			hash, raw_hex, packet_size, snr, rssi, channel_name, decrypted_txt, sender, decoded_json
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, pkt.Timestamp, pkt.Region, pkt.Observer, pkt.Origin, pkt.ScopeName, pkt.RouteType,
		pkt.PayloadType, pkt.TypeName, pkt.PathByteSize, string(hopsJson), string(resolvedHopsJson),
		pkt.Hash, pkt.RawHex, pkt.PacketSize, pkt.SNR, pkt.RSSI, pkt.ChannelName, pkt.DecryptedTxt, pkt.Sender, pkt.DecodedJSON)
	if err == nil {
		if lastID, err := res.LastInsertId(); err == nil {
			pkt.ID = lastID
		}
	}
}

func (s *Storage) resolvePrefixLocked(prefix string, neighbors []string) string {
	prefix = strings.ToUpper(prefix)

	// Check explicit manual aliases first
	var explicitTarget string
	err := s.db.QueryRow("SELECT target_id FROM node_aliases WHERE alias_id = ?", prefix).Scan(&explicitTarget)
	if err == nil && explicitTarget != "" {
		return explicitTarget
	}

	if len(prefix) >= 6 {
		return prefix
	}

	rows, err := s.db.Query("SELECT id FROM nodes WHERE id LIKE ?", prefix+"%")
	if err != nil {
		return prefix
	}
	defer rows.Close()

	var candidates []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil && len(id) == 6 {
			candidates = append(candidates, id)
		}
	}

	if len(candidates) == 0 {
		return prefix
	}

	// If there's uniquely one 3B candidate matching this 1B or 2B prefix, merge directly
	if len(candidates) == 1 {
		return candidates[0]
	}

	// Thresholds for multiple candidates:
	// 2B (len == 4): >= 2 matching neighbors
	// 1B (len == 2): >= 3 matching neighbors
	minRequired := 2
	if len(prefix) <= 2 {
		minRequired = 3
	}

	bestCand := ""
	maxMatches := 0

	for _, cand := range candidates {
		candNeighbors := s.getNodeNeighborsLocked(cand)
		matchCount := 0
		for _, neigh := range neighbors {
			neighUpper := strings.ToUpper(neigh)
			for _, cNeigh := range candNeighbors {
				cNeighUpper := strings.ToUpper(cNeigh)
				if strings.HasPrefix(cNeighUpper, neighUpper) || strings.HasPrefix(neighUpper, cNeighUpper) {
					matchCount++
					break
				}
			}
		}

		if matchCount >= minRequired && matchCount > maxMatches {
			maxMatches = matchCount
			bestCand = cand
		}
	}

	if bestCand != "" {
		return bestCand
	}

	return prefix
}

func (s *Storage) getNodeNeighborsLocked(nodeID string) []string {
	rows, err := s.db.Query(`
		SELECT target FROM edges WHERE source = ?
		UNION
		SELECT source FROM edges WHERE target = ?
	`, nodeID, nodeID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var neighbors []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err == nil {
			neighbors = append(neighbors, n)
		}
	}
	return neighbors
}

func (s *Storage) upsertNodeLocked(id, name string, lat, lon float64, scope string, pathSize int, now string) {
	id = strings.ToUpper(id)
	if id == "" {
		return
	}

	var existingName, scopesJson, pathSizesJson string
	err := s.db.QueryRow("SELECT name, scopes_json, path_sizes_json FROM nodes WHERE id = ?", id).Scan(&existingName, &scopesJson, &pathSizesJson)

	var scopes []string
	var pathSizes []int
	if err == nil {
		_ = json.Unmarshal([]byte(scopesJson), &scopes)
		_ = json.Unmarshal([]byte(pathSizesJson), &pathSizes)
	}

	if name != "" {
		existingName = name
	} else if existingName == "" {
		existingName = "Node " + id
	}

	if scope != "" && !containsStr(scopes, scope) {
		scopes = append(scopes, scope)
	}
	if pathSize > 0 && !containsInt(pathSizes, pathSize) {
		pathSizes = append(pathSizes, pathSize)
	}

	newScopesJson, _ := json.Marshal(scopes)
	newPathSizesJson, _ := json.Marshal(pathSizes)

	_, err = s.db.Exec(`
		INSERT INTO nodes (id, name, last_seen, lat, lon, scopes_json, path_sizes_json)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name = EXCLUDED.name,
			last_seen = EXCLUDED.last_seen,
			lat = CASE WHEN EXCLUDED.lat != 0 THEN EXCLUDED.lat ELSE nodes.lat END,
			lon = CASE WHEN EXCLUDED.lon != 0 THEN EXCLUDED.lon ELSE nodes.lon END,
			scopes_json = EXCLUDED.scopes_json,
			path_sizes_json = EXCLUDED.path_sizes_json;
	`, id, existingName, now, lat, lon, string(newScopesJson), string(newPathSizesJson))
	if err != nil {
		log.Printf("[DB] Failed to upsert node %s: %v", id, err)
	}
}

func (s *Storage) upsertEdgeLocked(source, target, now string) {
	source = strings.ToUpper(source)
	target = strings.ToUpper(target)
	if source == "" || target == "" || source == target {
		return
	}

	_, err := s.db.Exec(`
		INSERT INTO edges (source, target, last_seen, traffic_count)
		VALUES (?, ?, ?, 1)
		ON CONFLICT(source, target) DO UPDATE SET
			last_seen = EXCLUDED.last_seen,
			traffic_count = edges.traffic_count + 1;
	`, source, target, now)
	if err != nil {
		log.Printf("[DB] Failed to upsert edge %s->%s: %v", source, target, err)
	}
}

func (s *Storage) GetTopologyGraph() (*TopologyGraph, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Include all nodes (1-byte len=2, 2-byte len=4, 3-byte len=6, observer len>6) in topology map
	nodesRows, err := s.db.Query("SELECT id, name, last_seen, lat, lon, scopes_json, path_sizes_json FROM nodes")
	if err != nil {
		return nil, err
	}
	defer nodesRows.Close()

	var nodes []*Node
	nodeMap := make(map[string]bool)
	for nodesRows.Next() {
		var n Node
		var scopesJson, pathSizesJson string
		if err := nodesRows.Scan(&n.ID, &n.Name, &n.LastSeen, &n.Lat, &n.Lon, &scopesJson, &pathSizesJson); err == nil {
			_ = json.Unmarshal([]byte(scopesJson), &n.Scopes)
			_ = json.Unmarshal([]byte(pathSizesJson), &n.PathSizes)
			nodes = append(nodes, &n)
			nodeMap[n.ID] = true
		}
	}

	edgesRows, err := s.db.Query("SELECT source, target, last_seen, traffic_count FROM edges")
	if err != nil {
		return nil, err
	}
	defer edgesRows.Close()

	var edges []*Edge
	for edgesRows.Next() {
		var e Edge
		if err := edgesRows.Scan(&e.Source, &e.Target, &e.LastSeen, &e.TrafficCount); err == nil {
			if nodeMap[e.Source] && nodeMap[e.Target] {
				edges = append(edges, &e)
			}
		}
	}

	return &TopologyGraph{Nodes: nodes, Edges: edges}, nil
}

func containsStr(slice []string, val string) bool {
	for _, item := range slice {
		if item == val {
			return true
		}
	}
	return false
}

type PacketQueryParams struct {
	Since       string
	Limit       int
	Region      string
	Observer    string
	Node        string
	Channel     string
	Type        string
	Hash        string
	GroupByHash bool
}

type PacketGroup struct {
	Hash             string                `json:"hash"`
	Count            int                   `json:"count"`
	ObservationCount int                   `json:"observation_count"`
	ObserverCount    int                   `json:"observer_count"`
	Latest           string                `json:"latest"`
	Observer         string                `json:"observer"`
	ObserverID       string                `json:"observer_id"`
	ObserverName     string                `json:"observer_name"`
	PathJSON         string                `json:"path_json"`
	PayloadType      byte                  `json:"payload_type"`
	TypeName         string                `json:"type_name"`
	RouteType        int                   `json:"route_type"`
	RawHex           string                `json:"raw_hex"`
	DecodedJSON      string                `json:"decoded_json,omitempty"`
	ScopeName        string                `json:"scope_name,omitempty"`
	DistinctIATAs    []string              `json:"distinct_iatas,omitempty"`
	Children         []*packet.ParsedPacket `json:"_children,omitempty"`
}

func (s *Storage) QueryPackets(params PacketQueryParams) ([]*packet.ParsedPacket, int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var conditions []string
	var args []interface{}

	if params.Hash != "" {
		conditions = append(conditions, "hash = ?")
		args = append(args, strings.ToUpper(params.Hash))
	} else {
		if params.Since != "" {
			conditions = append(conditions, "timestamp >= ?")
			args = append(args, params.Since)
		}
		if params.Region != "" {
			regs := strings.Split(params.Region, ",")
			var regConds []string
			for _, r := range regs {
				regConds = append(regConds, "region = ?")
				args = append(args, strings.ToUpper(strings.TrimSpace(r)))
			}
			if len(regConds) > 0 {
				conditions = append(conditions, "("+strings.Join(regConds, " OR ")+")")
			}
		}
		if params.Observer != "" {
			obsList := strings.Split(params.Observer, ",")
			var obsConds []string
			for _, o := range obsList {
				obsConds = append(obsConds, "observer = ?")
				args = append(args, strings.TrimSpace(o))
			}
			if len(obsConds) > 0 {
				conditions = append(conditions, "("+strings.Join(obsConds, " OR ")+")")
			}
		}
		if params.Node != "" {
			nodeLike := "%" + strings.TrimSpace(params.Node) + "%"
			conditions = append(conditions, "(hops_json LIKE ? OR resolved_hops_json LIKE ? OR origin LIKE ? OR decoded_json LIKE ?)")
			args = append(args, nodeLike, nodeLike, nodeLike, nodeLike)
		}
		if params.Channel != "" {
			conditions = append(conditions, "(channel_name = ? OR raw_hex LIKE ?)")
			args = append(args, params.Channel, "%"+params.Channel+"%")
		}
		if params.Type != "" {
			types := strings.Split(params.Type, ",")
			var typeConds []string
			for _, tStr := range types {
				if tInt, err := strconv.Atoi(strings.TrimSpace(tStr)); err == nil {
					typeConds = append(typeConds, "payload_type = ?")
					args = append(args, tInt)
				}
			}
			if len(typeConds) > 0 {
				conditions = append(conditions, "("+strings.Join(typeConds, " OR ")+")")
			}
		}
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	limit := params.Limit
	if limit <= 0 {
		limit = 500
	}

	query := fmt.Sprintf(`
		SELECT id, timestamp, region, observer, origin, scope_name, route_type,
		       payload_type, type_name, path_byte_size, hops_json, resolved_hops_json,
		       hash, raw_hex, packet_size, snr, rssi, channel_name, decrypted_txt, sender, decoded_json
		FROM packets
		%s
		ORDER BY id DESC
		LIMIT %d
	`, whereClause, limit)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var packets []*packet.ParsedPacket
	for rows.Next() {
		var p packet.ParsedPacket
		var hopsJson, resHopsJson string
		var snr sql.NullFloat64
		var rssi sql.NullInt64

		err := rows.Scan(
			&p.ID, &p.Timestamp, &p.Region, &p.Observer, &p.Origin, &p.ScopeName, &p.RouteType,
			&p.PayloadType, &p.TypeName, &p.PathByteSize, &hopsJson, &resHopsJson,
			&p.Hash, &p.RawHex, &p.PacketSize, &snr, &rssi, &p.ChannelName, &p.DecryptedTxt, &p.Sender, &p.DecodedJSON,
		)
		if err != nil {
			continue
		}

		if snr.Valid {
			p.SNR = &snr.Float64
		}
		if rssi.Valid {
			rInt := int(rssi.Int64)
			p.RSSI = &rInt
		}
		p.Scope = p.ScopeName
		_ = json.Unmarshal([]byte(hopsJson), &p.Hops)
		_ = json.Unmarshal([]byte(resHopsJson), &p.ResolvedHops)
		p.HopCount = len(p.Hops)
		p.PathCount = p.HopCount

		packets = append(packets, &p)
	}

	return packets, len(packets), nil
}

func (s *Storage) GetPacketByHashOrID(query string) (*packet.ParsedPacket, []*packet.ParsedPacket, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var basePkt *packet.ParsedPacket
	var observations []*packet.ParsedPacket

	rows, err := s.db.Query(`
		SELECT id, timestamp, region, observer, origin, scope_name, route_type,
		       payload_type, type_name, path_byte_size, hops_json, resolved_hops_json,
		       hash, raw_hex, packet_size, snr, rssi, channel_name, decrypted_txt, sender, decoded_json
		FROM packets
		WHERE UPPER(hash) = ? OR id = ? OR UPPER(hash) LIKE ? OR UPPER(raw_hex) LIKE ?
		ORDER BY id DESC
	`, strings.ToUpper(query), query, strings.ToUpper(query)+"%", strings.ToUpper(query)+"%")
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var p packet.ParsedPacket
		var hopsJson, resHopsJson string
		var snr sql.NullFloat64
		var rssi sql.NullInt64

		err := rows.Scan(
			&p.ID, &p.Timestamp, &p.Region, &p.Observer, &p.Origin, &p.ScopeName, &p.RouteType,
			&p.PayloadType, &p.TypeName, &p.PathByteSize, &hopsJson, &resHopsJson,
			&p.Hash, &p.RawHex, &p.PacketSize, &snr, &rssi, &p.ChannelName, &p.DecryptedTxt, &p.Sender, &p.DecodedJSON,
		)
		if err != nil {
			continue
		}

		if snr.Valid {
			p.SNR = &snr.Float64
		}
		if rssi.Valid {
			rInt := int(rssi.Int64)
			p.RSSI = &rInt
		}
		p.Scope = p.ScopeName
		_ = json.Unmarshal([]byte(hopsJson), &p.Hops)
		_ = json.Unmarshal([]byte(resHopsJson), &p.ResolvedHops)
		p.HopCount = len(p.Hops)
		p.PathCount = p.HopCount

		if basePkt == nil {
			cp := p
			basePkt = &cp
		}
		cpObs := p
		observations = append(observations, &cpObs)
	}

	if basePkt == nil {
		return nil, nil, fmt.Errorf("packet not found")
	}

	return basePkt, observations, nil
}

type ObserverInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	IATA string `json:"iata"`
}

func (s *Storage) GetObservers() ([]*ObserverInfo, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rows, err := s.db.Query("SELECT DISTINCT observer, region FROM packets WHERE observer != ''")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var observers []*ObserverInfo
	for rows.Next() {
		var obs, reg string
		if err := rows.Scan(&obs, &reg); err == nil && obs != "" {
			observers = append(observers, &ObserverInfo{
				ID:   obs,
				Name: obs,
				IATA: reg,
			})
		}
	}
	return observers, nil
}

func (s *Storage) SearchNodes(query string) ([]*Node, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	qLike := "%" + strings.TrimSpace(query) + "%"
	rows, err := s.db.Query("SELECT id, name, last_seen, lat, lon, scopes_json, path_sizes_json FROM nodes WHERE id LIKE ? OR name LIKE ? ORDER BY last_seen DESC LIMIT 20", qLike, qLike)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nodes []*Node
	for rows.Next() {
		var n Node
		var scopesJson, pathSizesJson string
		if err := rows.Scan(&n.ID, &n.Name, &n.LastSeen, &n.Lat, &n.Lon, &scopesJson, &pathSizesJson); err == nil {
			_ = json.Unmarshal([]byte(scopesJson), &n.Scopes)
			_ = json.Unmarshal([]byte(pathSizesJson), &n.PathSizes)
			nodes = append(nodes, &n)
		}
	}
	return nodes, nil
}

func (s *Storage) DeleteNode(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	id = strings.ToUpper(id)
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM nodes WHERE id = ?", id); err != nil {
		return err
	}
	if _, err := tx.Exec("DELETE FROM edges WHERE source = ? OR target = ?", id, id); err != nil {
		return err
	}

	return tx.Commit()
}

func (s *Storage) DeleteEdge(source, target string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	source = strings.ToUpper(source)
	target = strings.ToUpper(target)

	_, err := s.db.Exec("DELETE FROM edges WHERE (source = ? AND target = ?) OR (source = ? AND target = ?)", source, target, target, source)
	return err
}

func (s *Storage) MergeNodes(aliasID, targetID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	aliasID = strings.ToUpper(strings.TrimSpace(aliasID))
	targetID = strings.ToUpper(strings.TrimSpace(targetID))

	if aliasID == "" || targetID == "" || aliasID == targetID {
		return fmt.Errorf("invalid merge IDs")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Insert into node_aliases mapping
	_, err = tx.Exec("INSERT INTO node_aliases (alias_id, target_id) VALUES (?, ?) ON CONFLICT(alias_id) DO UPDATE SET target_id = EXCLUDED.target_id", aliasID, targetID)
	if err != nil {
		return err
	}

	// Update edges where source or target is aliasID -> redirect to targetID
	rows, err := tx.Query("SELECT source, target, last_seen, traffic_count FROM edges WHERE source = ? OR target = ?", aliasID, aliasID)
	if err == nil {
		type edgeRecord struct {
			src, tgt, ls string
			traffic      int
		}
		var oldEdges []edgeRecord
		for rows.Next() {
			var r edgeRecord
			if err := rows.Scan(&r.src, &r.tgt, &r.ls, &r.traffic); err == nil {
				oldEdges = append(oldEdges, r)
			}
		}
		rows.Close()

		for _, e := range oldEdges {
			newSrc := e.src
			newTgt := e.tgt
			if newSrc == aliasID {
				newSrc = targetID
			}
			if newTgt == aliasID {
				newTgt = targetID
			}
			if newSrc != newTgt {
				_, _ = tx.Exec(`
					INSERT INTO edges (source, target, last_seen, traffic_count)
					VALUES (?, ?, ?, ?)
					ON CONFLICT(source, target) DO UPDATE SET
						last_seen = MAX(edges.last_seen, EXCLUDED.last_seen),
						traffic_count = edges.traffic_count + EXCLUDED.traffic_count;
				`, newSrc, newTgt, e.ls, e.traffic)
			}
		}
	}

	// Delete old aliasID node and edges
	_, _ = tx.Exec("DELETE FROM edges WHERE source = ? OR target = ?", aliasID, aliasID)
	_, _ = tx.Exec("DELETE FROM nodes WHERE id = ?", aliasID)

	return tx.Commit()
}

func containsInt(slice []int, val int) bool {
	for _, item := range slice {
		if item == val {
			return true
		}
	}
	return false
}
