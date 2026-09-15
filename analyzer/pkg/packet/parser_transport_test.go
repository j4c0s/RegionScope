package packet

import (
	"strings"
	"testing"
)

func TestParseMeshCorePacket_TransportCodesAndAdvert(t *testing.T) {
	// Raw advert packet with TRANSPORT_FLOOD (0x10)
	rawHex := "10E547000082ABCD4CF0F0F0D58838E96FC9BD83312FD479511DE782F76F7AE5FA001C03AB0EBE1195A6C47CC986A86A9C7B09355E1BA8AC1AE7AE03A1B9E66EE7105C99EB5C35458AEDCE0DC59D4DECF8F1DB90ADAA4ADD94E80AB0A1ECB30BFBCCDA6197F249BEE59250F64B142D0192F61E15037AEC0601504B525F36332D3734302D4B4F42594C494E5F3033"

	parsed, err := ParseMeshCorePacket("meshcore/KRK/OBSERVER1/packets", []byte(rawHex))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if parsed.RouteType != 0 {
		t.Errorf("RouteType = %d; want 0 (TRANSPORT_FLOOD)", parsed.RouteType)
	}
	if parsed.PathByteSize != 3 {
		t.Errorf("PathByteSize = %d; want 3", parsed.PathByteSize)
	}
	if len(parsed.Hops) != 2 || parsed.Hops[0] != "ABCD4C" || parsed.Hops[1] != "F0F0F0" {
		t.Errorf("Hops = %v; want [ABCD4C, F0F0F0]", parsed.Hops)
	}
	if !strings.Contains(parsed.AdvertName, "KOBYLIN") {
		t.Errorf("AdvertName = %s; want to contain KOBYLIN", parsed.AdvertName)
	}
}
