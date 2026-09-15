package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
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
		payload_type INTEGER,
		type_name TEXT,
		path_byte_size INTEGER,
		hops_json TEXT,
		resolved_hops_json TEXT,
		hash TEXT,
		raw_hex TEXT
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

	_, _ = s.db.Exec(`
		INSERT INTO packets (timestamp, region, observer, origin, payload_type, type_name, path_byte_size, hops_json, resolved_hops_json, hash, raw_hex)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, pkt.Timestamp, pkt.Region, pkt.Observer, pkt.Origin, pkt.PayloadType, pkt.TypeName, pkt.PathByteSize, string(hopsJson), string(resolvedHopsJson), pkt.Hash, pkt.RawHex)
}

func (s *Storage) resolvePrefixLocked(prefix string, neighbors []string) string {
	prefix = strings.ToUpper(prefix)
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

	nodesRows, err := s.db.Query("SELECT id, name, last_seen, lat, lon, scopes_json, path_sizes_json FROM nodes")
	if err != nil {
		return nil, err
	}
	defer nodesRows.Close()

	var nodes []*Node
	for nodesRows.Next() {
		var n Node
		var scopesJson, pathSizesJson string
		if err := nodesRows.Scan(&n.ID, &n.Name, &n.LastSeen, &n.Lat, &n.Lon, &scopesJson, &pathSizesJson); err == nil {
			_ = json.Unmarshal([]byte(scopesJson), &n.Scopes)
			_ = json.Unmarshal([]byte(pathSizesJson), &n.PathSizes)
			nodes = append(nodes, &n)
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
			edges = append(edges, &e)
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

func containsInt(slice []int, val int) bool {
	for _, item := range slice {
		if item == val {
			return true
		}
	}
	return false
}
