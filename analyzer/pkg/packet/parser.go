package packet

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

// Payload type constants matching MeshCore standard
const (
	PayloadTypeReq      = 0x00
	PayloadTypeResp     = 0x01
	PayloadTypeTxtMsg   = 0x02
	PayloadTypeAck      = 0x03
	PayloadTypeAdvert   = 0x04
	PayloadTypeGrpTxt   = 0x05
	PayloadTypeLocation = 0x07
	PayloadTypePath     = 0x08
	PayloadTypeTrace    = 0x09
)

func GetPayloadTypeName(pType byte) string {
	switch pType {
	case PayloadTypeReq:
		return "REQ"
	case PayloadTypeResp:
		return "RESP"
	case PayloadTypeTxtMsg:
		return "TXT_MSG"
	case PayloadTypeAck:
		return "ACK"
	case PayloadTypeAdvert:
		return "ADVERT"
	case PayloadTypeGrpTxt:
		return "GRP_TXT"
	case PayloadTypeLocation:
		return "LOCATION"
	case PayloadTypePath:
		return "PATH"
	case PayloadTypeTrace:
		return "TRACE"
	default:
		return fmt.Sprintf("UNKNOWN(0x%02X)", pType)
	}
}

// ParsedPacket represents a processed MeshCore packet.
type ParsedPacket struct {
	Timestamp    string   `json:"timestamp"`
	Region       string   `json:"region"`
	Observer     string   `json:"observer"`
	Origin       string   `json:"origin"`
	RouteType    int      `json:"route_type"`
	PathByteSize int      `json:"path_byte_size"`
	PathCount    int      `json:"path_count"`
	HopCount     int      `json:"hop_count"`
	Hops         []string `json:"hops"`
	ResolvedHops []string `json:"resolved_hops"`
	PayloadType  byte     `json:"payload_type"`
	TypeName     string   `json:"type_name"`
	Hash         string   `json:"hash"`
	RawHex       string   `json:"raw_hex"`
	AdvertName   string   `json:"advert_name,omitempty"`
	AdvertKey    string   `json:"advert_key,omitempty"`
	Lat          float64  `json:"lat,omitempty"`
	Lon          float64  `json:"lon,omitempty"`
}

// ParseMeshCorePacket extracts packet path byte size, payload type, repeater hops, and details from an MQTT message.
func ParseMeshCorePacket(topic string, rawPayload []byte) (*ParsedPacket, error) {
	parsed := &ParsedPacket{
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		Region:    "MESH",
		Observer:  "Observer",
		TypeName:  "DATA",
	}

	// 1. Extract Region / Scope and Observer ID from MQTT topic if formatted like meshcore/<REGION>/<OBSERVER>/packets
	topicParts := strings.Split(topic, "/")
	if len(topicParts) >= 3 {
		parsed.Region = topicParts[1]
		parsed.Observer = topicParts[2]
		parsed.Origin = topicParts[2]
	}

	// 2. Extract Raw Hex String
	var rawHex string
	var jsonHash string
	if len(rawPayload) > 0 && rawPayload[0] == '{' {
		var jsonMsg struct {
			Raw      string `json:"raw"`
			Hex      string `json:"hex"`
			Payload  string `json:"payload"`
			Origin   string `json:"origin"`
			Observer string `json:"observer"`
			Hash     string `json:"hash"`
			Scope    string `json:"scope"`
		}
		if err := json.Unmarshal(rawPayload, &jsonMsg); err == nil {
			if jsonMsg.Raw != "" {
				rawHex = jsonMsg.Raw
			} else if jsonMsg.Hex != "" {
				rawHex = jsonMsg.Hex
			} else if jsonMsg.Payload != "" {
				rawHex = jsonMsg.Payload
			}
			if jsonMsg.Origin != "" {
				parsed.Origin = jsonMsg.Origin
			} else if jsonMsg.Observer != "" {
				parsed.Observer = jsonMsg.Observer
			}
			if jsonMsg.Hash != "" {
				jsonHash = jsonMsg.Hash
			}
			if jsonMsg.Scope != "" {
				parsed.Region = jsonMsg.Scope
			}
		}
	} else {
		rawHex = strings.TrimSpace(string(rawPayload))
	}

	if rawHex == "" {
		return nil, fmt.Errorf("no packet hex found in payload")
	}

	buf, err := hex.DecodeString(rawHex)
	if err != nil {
		return nil, fmt.Errorf("invalid hex string: %v", err)
	}

	if len(buf) < 2 {
		return nil, fmt.Errorf("packet buffer empty or too short")
	}

	parsed.RawHex = strings.ToUpper(rawHex)

	// Header Byte 0: payloadType = (header >> 2) & 0x0F, routeType = header & 0x03
	headerByte := buf[0]
	payloadType := (headerByte >> 2) & 0x0F
	routeType := int(headerByte & 0x03)

	parsed.PayloadType = payloadType
	parsed.RouteType = routeType
	parsed.TypeName = GetPayloadTypeName(payloadType)

	offset := 1
	// If TRANSPORT_FLOOD (0) or TRANSPORT_DIRECT (3), skip 4 transport code bytes
	if routeType == 0 || routeType == 3 {
		if len(buf) < offset+4 {
			return nil, fmt.Errorf("packet too short for transport codes")
		}
		offset += 4
	}

	if offset >= len(buf) {
		return nil, fmt.Errorf("packet too short for path byte")
	}

	// Path Specifier Byte
	pathSpec := buf[offset]
	offset++

	pathByteSize := int((pathSpec>>6)&0x03) + 1
	hopCount := int(pathSpec & 0x3F)

	parsed.PathByteSize = pathByteSize
	parsed.HopCount = hopCount
	parsed.PathCount = hopCount

	hops := make([]string, 0, hopCount)

	for i := 0; i < hopCount; i++ {
		if offset+pathByteSize > len(buf) {
			break
		}
		hopBytes := buf[offset : offset+pathByteSize]
		hops = append(hops, strings.ToUpper(hex.EncodeToString(hopBytes)))
		offset += pathByteSize
	}

	parsed.Hops = hops
	parsed.ResolvedHops = hops

	if jsonHash != "" {
		parsed.Hash = strings.ToUpper(jsonHash)
	} else {
		hashLen := 4
		if len(buf) < hashLen {
			hashLen = len(buf)
		}
		parsed.Hash = strings.ToUpper(hex.EncodeToString(buf[len(buf)-hashLen:]))
	}

	// Parse Advert payload if PayloadType == 0x04 (ADVERT)
	if payloadType == PayloadTypeAdvert && len(buf) > offset {
		parseAdvertPayload(buf[offset:], parsed)
	}

	return parsed, nil
}

func parseAdvertPayload(payload []byte, pkt *ParsedPacket) {
	// Standard MeshCore Advert format:
	// If full length (>= 100 bytes): PubKey(32B), Timestamp(4B), Sig(64B), AppFlags(1B), [Lat(4B), Lon(4B)], Name(...)
	if len(payload) >= 32 {
		pkt.AdvertKey = strings.ToUpper(hex.EncodeToString(payload[:3])) // First 3 bytes as key ID
	} else if len(payload) >= 3 {
		pkt.AdvertKey = strings.ToUpper(hex.EncodeToString(payload[:3]))
	}

	// Look for string name at the end of advert payload
	var nameBytes []byte
	if len(payload) >= 101 { // Full advert packet
		// AppFlags at offset 100
		flags := payload[100]
		nameStart := 101
		hasLocation := (flags & 0x10) != 0 || (flags & 0x01) != 0

		if hasLocation && len(payload) >= 109 {
			nameStart = 109
		}
		if nameStart < len(payload) {
			nameBytes = payload[nameStart:]
		}
	} else {
		// Short format: name after key/flags
		if len(payload) > 4 {
			nameBytes = payload[4:]
		}
	}

	if len(nameBytes) > 0 {
		nameStr := cleanUTF8String(nameBytes)
		if nameStr != "" {
			pkt.AdvertName = nameStr
		}
	}
}

func cleanUTF8String(b []byte) string {
	// Trim trailing nulls and spaces
	s := strings.Trim(string(b), "\x00\r\n ")
	if !utf8.ValidString(s) {
		// Replace invalid UTF-8 sequences
		s = strings.ToValidUTF8(s, "")
	}
	return strings.TrimSpace(s)
}
