package packet

import (
	"encoding/hex"
	"testing"
)

func TestParseMeshCorePacket_PathBytes(t *testing.T) {
	// Header byte: Route=1 (FLOOD), Payload=1 (0x05) -> (1<<2) | 1 = 0x05
	// Path byte:
	// 1-byte size (0<<6), 2 hops -> 0x02
	// 2-byte size (1<<6), 2 hops -> 0x42
	// 3-byte size (2<<6), 2 hops -> 0x82

	tests := []struct {
		name         string
		pathByte     byte
		hopsData     []byte
		expectedSize int
		expectedCount int
		expectedHops []string
	}{
		{
			name:         "1-byte path",
			pathByte:     0x02, // size=1, count=2
			hopsData:     []byte{0xAA, 0xBB},
			expectedSize: 1,
			expectedCount: 2,
			expectedHops: []string{"AA", "BB"},
		},
		{
			name:         "2-byte path",
			pathByte:     0x42, // size=2, count=2
			hopsData:     []byte{0x11, 0x22, 0x33, 0x44},
			expectedSize: 2,
			expectedCount: 2,
			expectedHops: []string{"1122", "3344"},
		},
		{
			name:         "3-byte path",
			pathByte:     0x82, // size=3, count=2
			hopsData:     []byte{0x01, 0x02, 0x03, 0x04, 0x05, 0x06},
			expectedSize: 3,
			expectedCount: 2,
			expectedHops: []string{"010203", "040506"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pktBytes := []byte{0x05, tt.pathByte}
			pktBytes = append(pktBytes, tt.hopsData...)
			rawHex := hex.EncodeToString(pktBytes)

			topic := "meshcore/KRK/OBSERVER1/packets"
			parsed, err := ParseMeshCorePacket(topic, []byte(rawHex))
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if parsed.PathByteSize != tt.expectedSize {
				t.Errorf("PathByteSize = %d; want %d", parsed.PathByteSize, tt.expectedSize)
			}
			if parsed.PathCount != tt.expectedCount {
				t.Errorf("PathCount = %d; want %d", parsed.PathCount, tt.expectedCount)
			}
			if len(parsed.Hops) != len(tt.expectedHops) {
				t.Fatalf("len(Hops) = %d; want %d", len(parsed.Hops), len(tt.expectedHops))
			}
			for i, hop := range parsed.Hops {
				if hop != tt.expectedHops[i] {
					t.Errorf("Hops[%d] = %s; want %s", i, hop, tt.expectedHops[i])
				}
			}
		})
	}
}

func TestParseMeshCorePacket_JsonPayload(t *testing.T) {
	jsonPayload := `{
		"timestamp": "2026-09-14T19:16:00.903554+00:00",
		"hash": "5C4C0FBDA2023FC",
		"origin": "PL-KNS McOrian",
		"direction": "rx",
		"hex": "054211223344"
	}`

	topic := "meshcore/KRK/033DA9E56A4570019E996EE46F47FCC91E3461364B409CF0B2E87457FD005B61/packets"
	parsed, err := ParseMeshCorePacket(topic, []byte(jsonPayload))
	if err != nil {
		t.Fatalf("ParseMeshCorePacket returned error: %v", err)
	}

	if parsed.Region != "KRK" {
		t.Errorf("Region = %s; want KRK", parsed.Region)
	}
	if parsed.Observer != "033DA9E56A4570019E996EE46F47FCC91E3461364B409CF0B2E87457FD005B61" {
		t.Errorf("Observer = %s", parsed.Observer)
	}
	if parsed.Origin != "PL-KNS McOrian" {
		t.Errorf("Origin = %s; want PL-KNS McOrian", parsed.Origin)
	}
	if parsed.Hash != "5C4C0FBDA2023FC" {
		t.Errorf("Hash = %s; want 5C4C0FBDA2023FC", parsed.Hash)
	}
	if parsed.PathByteSize != 2 {
		t.Errorf("PathByteSize = %d; want 2", parsed.PathByteSize)
	}
	if len(parsed.Hops) != 2 || parsed.Hops[0] != "1122" || parsed.Hops[1] != "3344" {
		t.Errorf("Hops mismatch: %v", parsed.Hops)
	}
}

func TestParseMeshCorePacket_AdvertGPS(t *testing.T) {
	// Header: PayloadType=ADVERT(0x04), Route=FLOOD(1) -> 0x11
	// Path: 0 hops -> 0x00
	pktBytes := []byte{0x11, 0x00}

	// 100 bytes advert header: 32B PubKey, 4B Timestamp, 64B Sig
	advertBuf := make([]byte, 100)
	// PubKey 3-byte prefix: 671AC0
	advertBuf[0] = 0x67
	advertBuf[1] = 0x1A
	advertBuf[2] = 0xC0

	// AppData: flags = 0x90 (hasLocation 0x10 | hasName 0x80)
	appData := []byte{0x90}
	// Lat = 50.0 (50000000 = 0x02FAF080 LE int32)
	latBytes := []byte{0x80, 0xF0, 0xFA, 0x02}
	// Lon = 20.0 (20000000 = 0x01312D00 LE int32)
	lonBytes := []byte{0x00, 0x2D, 0x31, 0x01}

	appData = append(appData, latBytes...)
	appData = append(appData, lonBytes...)
	appData = append(appData, []byte("TestGPSNode\x00")...)

	pktBytes = append(pktBytes, append(advertBuf, appData...)...)

	parsed, err := ParseMeshCorePacket("meshcore/KRK/OBSERVER1/packets", []byte(hex.EncodeToString(pktBytes)))
	if err != nil {
		t.Fatalf("ParseMeshCorePacket failed: %v", err)
	}

	if parsed.AdvertKey != "671AC0" {
		t.Errorf("AdvertKey = %s; want 671AC0", parsed.AdvertKey)
	}
	if parsed.AdvertName != "TestGPSNode" {
		t.Errorf("AdvertName = %s; want TestGPSNode", parsed.AdvertName)
	}
	if parsed.Lat != 50.0 {
		t.Errorf("Lat = %f; want 50.0", parsed.Lat)
	}
	if parsed.Lon != 20.0 {
		t.Errorf("Lon = %f; want 20.0", parsed.Lon)
	}
}
