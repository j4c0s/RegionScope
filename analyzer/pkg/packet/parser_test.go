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
	rawHex := "110692B35DCE3B83368F8C21DFE32AA180E4C6FB75B113402D23D6FECF367456B1B4843F0EF33CD630D44B664AA86CFA085F2FA4011377332DCA8FC7CE9619BE109D37E9FD08F9EE0C7133FC3A988CB3F68411F79A52E5BC1A60571A9883CB6A34C9376A65762BDCF75B40089220561903254B42015750492D536965727A63686F772D525054"

	topic := "meshcore/POZ/PKN-BASE-GL1/packets"
	parsed, err := ParseMeshCorePacket(topic, []byte(rawHex))
	if err != nil {
		t.Fatalf("ParseMeshCorePacket returned error: %v", err)
	}

	if parsed.PayloadType != PayloadTypeAdvert {
		t.Errorf("PayloadType = %d; want %d (ADVERT)", parsed.PayloadType, PayloadTypeAdvert)
	}
	if parsed.PathByteSize != 1 {
		t.Errorf("PathByteSize = %d; want 1", parsed.PathByteSize)
	}
	if parsed.AdvertKey != "36" {
		t.Errorf("AdvertKey = %s; want 36", parsed.AdvertKey)
	}
	if parsed.AdvertKeyFull != "368F8C21DFE32AA180E4C6FB75B113402D23D6FECF367456B1B4843F0EF33CD6" {
		t.Errorf("AdvertKeyFull = %s; want 368F8C21DFE32AA180E4C6FB75B113402D23D6FECF367456B1B4843F0EF33CD6", parsed.AdvertKeyFull)
	}
	if parsed.AdvertName != "WPI-Sierzchow-RPT" {
		t.Errorf("AdvertName = %s; want WPI-Sierzchow-RPT", parsed.AdvertName)
	}
	// Lat: 51.992096, Lon: 21.121829
	if parsed.Lat < 51.9920 || parsed.Lat > 51.9922 {
		t.Errorf("Lat = %f; want ~51.992096", parsed.Lat)
	}
	if parsed.Lon < 21.1218 || parsed.Lon > 21.1219 {
		t.Errorf("Lon = %f; want ~21.121829", parsed.Lon)
	}
}
