package storage

import (
	"path/filepath"
	"testing"

	"github.com/corescope/analyzer/pkg/packet"
)

func TestStoragePrefixNeighborMatching(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test.db")

	store, err := InitDB(dbPath)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer store.Close()

	// 1. Seed full 3B nodes into database: 671AC0, 681AC0, 691AC0, 701AC0
	store.RecordPacket(&packet.ParsedPacket{
		PathByteSize: 3,
		Hops:         []string{"671AC0", "681AC0"},
	})
	store.RecordPacket(&packet.ParsedPacket{
		PathByteSize: 3,
		Hops:         []string{"671AC0", "691AC0"},
	})
	store.RecordPacket(&packet.ParsedPacket{
		PathByteSize: 3,
		Hops:         []string{"671AC0", "701AC0"},
	})

	// 2. Test 2B prefix matching (requires >= 2 matching neighbors)
	pkt2B := &packet.ParsedPacket{
		PathByteSize: 2,
		Hops:         []string{"671A", "681A"},
	}
	store.RecordPacket(pkt2B)

	if pkt2B.ResolvedHops[0] != "671AC0" {
		t.Errorf("Expected 2B prefix '671A' to resolve to '671AC0', got '%s'", pkt2B.ResolvedHops[0])
	}

	// 3. Test 1B prefix matching (requires >= 3 matching neighbors)
	pkt1B := &packet.ParsedPacket{
		PathByteSize: 1,
		Hops:         []string{"681A", "67", "691A"}, // "67" surrounded by 681A and 691A, but needs 3 matching
		Observer:     "701AC0",                       // 3rd neighbor is 701AC0
	}
	store.RecordPacket(pkt1B)

	if pkt1B.ResolvedHops[1] != "671AC0" {
		t.Errorf("Expected 1B prefix '67' to resolve to '671AC0' with 3 matching neighbors, got '%s'", pkt1B.ResolvedHops[1])
	}
}
