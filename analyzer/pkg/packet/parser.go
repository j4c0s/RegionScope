package packet

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// ParsedPacket represents a processed MeshCore packet.
type ParsedPacket struct {
	Timestamp    string   `json:"timestamp"`
	Topic        string   `json:"topic"`
	Observer     string   `json:"observer,omitempty"`
	Region       string   `json:"region,omitempty"` // Region / Scope (e.g. KRK, WAW, RZE)
	Origin       string   `json:"origin,omitempty"`
	Hash         string   `json:"hash,omitempty"`
	RawHex       string   `json:"raw_hex"`
	PayloadType  int      `json:"payload_type"`
	RouteType    int      `json:"route_type"`
	PathByteSize int      `json:"path_byte_size"` // 1, 2, 3, or 4 bytes per hop
	PathCount    int      `json:"path_count"`     // number of hops
	Hops         []string `json:"hops"`
	Len          int      `json:"len"`
	Direction    string   `json:"direction,omitempty"`
	Count        int      `json:"count,omitempty"` // Used when grouped by hash
}

// MqttPayloadStruct helps parse JSON payloads from MeshCore MQTT messages.
type MqttPayloadStruct struct {
	Timestamp  string          `json:"timestamp"`
	Hash       string          `json:"hash"`
	Origin     string          `json:"origin"`
	Region     string          `json:"region"`
	Scope      string          `json:"scope"`
	Type       string          `json:"type"`
	Direction  string          `json:"direction"`
	Time       string          `json:"time"`
	Date       string          `json:"date"`
	Len        json.RawMessage `json:"len"`
	PacketType json.RawMessage `json:"packet_type"`
	Payload    string          `json:"payload"`
	Hex        string          `json:"hex"`
	RawHex     string          `json:"raw_hex"`
	Raw        string          `json:"raw"`
	Data       string          `json:"data"`
}

// ParseMeshCorePacket extracts packet path byte size, repeater hops, and details from an MQTT message.
func ParseMeshCorePacket(topic string, rawPayload []byte) (*ParsedPacket, error) {
	parsed := &ParsedPacket{
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		Topic:     topic,
		Hops:      []string{},
		Count:     1,
	}

	// Parse topic structure: meshcore/<REGION>/<OBSERVER>/...
	parts := strings.Split(topic, "/")
	if len(parts) >= 2 && parts[1] != "" {
		parsed.Region = strings.ToUpper(parts[1])
	}
	if len(parts) >= 3 {
		parsed.Observer = parts[2]
	}

	var hexData string

	// Try parsing JSON payload
	var mqttMsg MqttPayloadStruct
	if err := json.Unmarshal(rawPayload, &mqttMsg); err == nil {
		if mqttMsg.Timestamp != "" {
			parsed.Timestamp = mqttMsg.Timestamp
		}
		if mqttMsg.Hash != "" {
			parsed.Hash = strings.ToUpper(mqttMsg.Hash)
		}
		if mqttMsg.Origin != "" {
			parsed.Origin = mqttMsg.Origin
		}
		if mqttMsg.Region != "" {
			parsed.Region = strings.ToUpper(mqttMsg.Region)
		} else if mqttMsg.Scope != "" {
			parsed.Region = strings.ToUpper(mqttMsg.Scope)
		}
		if mqttMsg.Direction != "" {
			parsed.Direction = mqttMsg.Direction
		}

		// Pick the raw packet hex string
		if mqttMsg.Hex != "" {
			hexData = mqttMsg.Hex
		} else if mqttMsg.Payload != "" {
			hexData = mqttMsg.Payload
		} else if mqttMsg.RawHex != "" {
			hexData = mqttMsg.RawHex
		} else if mqttMsg.Raw != "" {
			hexData = mqttMsg.Raw
		} else if mqttMsg.Data != "" {
			hexData = mqttMsg.Data
		}
	} else {
		// Fallback: entire MQTT payload might be a raw hex string
		hexData = strings.TrimSpace(string(rawPayload))
	}

	hexData = strings.TrimSpace(hexData)
	if hexData == "" {
		return nil, fmt.Errorf("no packet hex found in payload")
	}

	parsed.RawHex = strings.ToUpper(hexData)
	buf, err := hex.DecodeString(hexData)
	if err != nil {
		return nil, fmt.Errorf("failed to decode hex: %w", err)
	}

	parsed.Len = len(buf)
	if len(buf) < 1 {
		return nil, fmt.Errorf("packet buffer empty")
	}

	// MeshCore Header
	headerByte := buf[0]
	parsed.RouteType = int(headerByte & 0x03)
	parsed.PayloadType = int((headerByte >> 2) & 0x0F)

	offset := 1
	// RouteType 3 = TRANSPORT (4 transport code bytes)
	if parsed.RouteType == 3 {
		if len(buf) < offset+4 {
			return parsed, nil
		}
		offset += 4
	}

	if offset >= len(buf) {
		return parsed, nil
	}

	// Path Byte
	pathByte := buf[offset]
	offset++

	parsed.PathByteSize = int(pathByte>>6) + 1
	parsed.PathCount = int(pathByte & 0x3F)

	hops := make([]string, 0, parsed.PathCount)
	for i := 0; i < parsed.PathCount; i++ {
		start := offset + i*parsed.PathByteSize
		end := start + parsed.PathByteSize
		if end > len(buf) {
			break
		}
		hops = append(hops, strings.ToUpper(hex.EncodeToString(buf[start:end])))
	}

	parsed.Hops = hops
	return parsed, nil
}
