package packet

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"
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

	// Header Byte 0: payloadType = (header >> 2) & 0x0F
	headerByte := buf[0]
	payloadType := (headerByte >> 2) & 0x0F
	parsed.PayloadType = payloadType
	parsed.TypeName = GetPayloadTypeName(payloadType)

	// Header Byte 1: Path Specifier
	pathSpec := buf[1]
	pathByteSize := int((pathSpec>>6)&0x03) + 1
	hopCount := int(pathSpec & 0x3F)

	parsed.PathByteSize = pathByteSize
	parsed.HopCount = hopCount
	parsed.PathCount = hopCount

	hops := make([]string, 0, hopCount)
	idx := 2

	for i := 0; i < hopCount; i++ {
		if idx+pathByteSize > len(buf) {
			break
		}
		hopBytes := buf[idx : idx+pathByteSize]
		hops = append(hops, strings.ToUpper(hex.EncodeToString(hopBytes)))
		idx += pathByteSize
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
	if payloadType == PayloadTypeAdvert && len(buf) > idx {
		parseAdvertPayload(buf[idx:], parsed)
	}

	return parsed, nil
}

func parseAdvertPayload(payload []byte, pkt *ParsedPacket) {
	if len(payload) >= 4 {
		keyBytes := payload[:4]
		pkt.AdvertKey = strings.ToUpper(hex.EncodeToString(keyBytes))
	}
	if len(payload) > 4 {
		nameBytes := payload[4:]
		name := strings.Trim(string(nameBytes), "\x00\r\n ")
		if name != "" {
			pkt.AdvertName = name
		}
	}
}
