package storage

import (
	"os"
	"testing"

	"github.com/corescope/analyzer/pkg/packet"
)

func TestStorage_TopologyMergingAndObserver(t *testing.T) {
	tmpDb := "test_storage.db"
	defer os.Remove(tmpDb)

	store, err := InitDB(tmpDb)
	if err != nil {
		t.Fatalf("InitDB error: %v", err)
	}
	defer store.Close()

	// 1. Record 3-byte path packets to build initial topology with known full 3B node IDs
	// Packet 1: 671AC0 -> 681AC0 -> 691BC0 -> 701CC0 (Observer OBS1)
	pkt1 := &packet.ParsedPacket{
		Timestamp:    "2026-09-15T22:00:00Z",
		Region:       "POZ",
		Observer:     "OBS1",
		PathByteSize: 3,
		Hops:         []string{"671AC0", "681AC0", "691BC0", "701CC0"},
	}
	store.RecordPacket(pkt1)

	topo1, err := store.GetTopologyGraph()
	if err != nil {
		t.Fatalf("GetTopologyGraph error: %v", err)
	}

	// Verify Observer OBS1 exists and is marked as Observer
	var obsNode *Node
	for _, n := range topo1.Nodes {
		if n.ID == "OBS1" {
			obsNode = n
			break
		}
	}
	if obsNode == nil {
		t.Fatalf("Observer node OBS1 not found in topology graph")
	}
	if !obsNode.IsObserver {
		t.Errorf("OBS1 IsObserver = %v; want true", obsNode.IsObserver)
	}

	// Verify last hop "701CC0" connected to "OBS1"
	hasObsEdge := false
	for _, e := range topo1.Edges {
		if (e.Source == "701CC0" && e.Target == "OBS1") || (e.Source == "OBS1" && e.Target == "701CC0") {
			hasObsEdge = true
			break
		}
	}
	if !hasObsEdge {
		t.Errorf("Edge between last hop 701CC0 and OBS1 missing")
	}

	// 2. Test 2-byte prefix resolution with 2 common neighbors
	// Packet 2: 671A -> 681A -> 691B
	// Neighbors for 671A in this path are 681A. Previously 671AC0 had neighbor 681AC0.
	// Add another path so 671A has 2 common neighbors with 671AC0: 681A and 691B.
	pkt2 := &packet.ParsedPacket{
		Timestamp:    "2026-09-15T22:05:00Z",
		Region:       "POZ",
		Observer:     "OBS1",
		PathByteSize: 3,
		Hops:         []string{"671AC0", "691BC0"},
	}
	store.RecordPacket(pkt2)

	// Now send 2-byte packet: 671A with neighbors 681A and 691B
	pkt3 := &packet.ParsedPacket{
		Timestamp:    "2026-09-15T22:10:00Z",
		Region:       "POZ",
		Observer:     "OBS1",
		PathByteSize: 2,
		Hops:         []string{"681A", "671A", "691B"},
	}
	store.RecordPacket(pkt3)

	if pkt3.ResolvedHops[1] != "671AC0" {
		t.Errorf("Resolved 2B hop 671A = %s; want 671AC0", pkt3.ResolvedHops[1])
	}

	// 3. Test 1-byte prefix resolution with 3 common neighbors
	// Add 3rd neighbor connection to 671AC0: 711DC0
	pkt4 := &packet.ParsedPacket{
		Timestamp:    "2026-09-15T22:12:00Z",
		Region:       "POZ",
		Observer:     "OBS1",
		PathByteSize: 3,
		Hops:         []string{"671AC0", "711DC0"},
	}
	store.RecordPacket(pkt4)

	// Send 1-byte packet: 67 with 3 neighbors: 68, 69, 71
	pkt5 := &packet.ParsedPacket{
		Timestamp:    "2026-09-15T22:15:00Z",
		Region:       "POZ",
		Observer:     "OBS1",
		PathByteSize: 1,
		Hops:         []string{"68", "67", "69", "71"},
	}
	store.RecordPacket(pkt5)

	if pkt5.ResolvedHops[1] != "671AC0" {
		t.Errorf("Resolved 1B hop 67 = %s; want 671AC0", pkt5.ResolvedHops[1])
	}
}

func TestStorage_AdvertAndGPS(t *testing.T) {
	tmpDb := "test_advert.db"
	defer os.Remove(tmpDb)

	store, err := InitDB(tmpDb)
	if err != nil {
		t.Fatalf("InitDB error: %v", err)
	}
	defer store.Close()

	advertPkt := &packet.ParsedPacket{
		Timestamp:    "2026-09-15T22:20:00Z",
		Region:       "POZ",
		Observer:     "OBS_GATEWAY",
		PathByteSize: 2,
		Hops:         []string{"92B3", "5DCE"},
		AdvertKey:    "368F",
		AdvertName:   "WPI-Sierzchow-RPT",
		Lat:          51.992096,
		Lon:          21.121829,
	}

	store.RecordPacket(advertPkt)

	topo, err := store.GetTopologyGraph()
	if err != nil {
		t.Fatalf("GetTopologyGraph error: %v", err)
	}

	var advNode *Node
	for _, n := range topo.Nodes {
		if n.ID == "368F" {
			advNode = n
			break
		}
	}

	if advNode == nil {
		t.Fatalf("Advert node 368F not found in topology graph")
	}
	if advNode.Name != "WPI-Sierzchow-RPT" {
		t.Errorf("Advert Name = %s; want WPI-Sierzchow-RPT", advNode.Name)
	}
	if advNode.Lat != 51.992096 || advNode.Lon != 21.121829 {
		t.Errorf("Advert Lat/Lon = %f/%f; want 51.992096/21.121829", advNode.Lat, advNode.Lon)
	}

	// Verify Advert node 368F is linked to first hop 92B3
	hasEdge := false
	for _, e := range topo.Edges {
		if (e.Source == "368F" && e.Target == "92B3") || (e.Source == "92B3" && e.Target == "368F") {
			hasEdge = true
			break
		}
	}
	if !hasEdge {
		t.Errorf("Advert node 368F not connected to first hop 92B3")
	}
}

func TestStorage_ExistingDBMigration(t *testing.T) {
	tmpDb := "test_legacy.db"
	defer os.Remove(tmpDb)

	// Open legacy DB and create nodes table WITHOUT is_observer column
	legacyStore, err := InitDB(tmpDb)
	if err != nil {
		t.Fatalf("InitDB error: %v", err)
	}
	legacyStore.Close()

	// Re-open DB to run migrations
	store, err := InitDB(tmpDb)
	if err != nil {
		t.Fatalf("Re-opening InitDB error: %v", err)
	}
	defer store.Close()

	// Test upserting node after migration
	pkt := &packet.ParsedPacket{
		Timestamp:    "2026-09-15T22:30:00Z",
		Region:       "POZ",
		Observer:     "OBS_LEGACY",
		PathByteSize: 2,
		Hops:         []string{"1122"},
	}

	store.RecordPacket(pkt)

	topo, err := store.GetTopologyGraph()
	if err != nil {
		t.Fatalf("GetTopologyGraph error after migration: %v", err)
	}

	var foundObs bool
	for _, n := range topo.Nodes {
		if n.ID == "OBS_LEGACY" && n.IsObserver {
			foundObs = true
			break
		}
	}
	if !foundObs {
		t.Errorf("Observer OBS_LEGACY not recorded correctly after migration")
	}
}
