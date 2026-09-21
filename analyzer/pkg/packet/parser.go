package packet

import (
	"encoding/binary"
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
	if len(topicParts) >= 2 {
		pUpper := strings.ToUpper(topicParts[1])
		if pUpper != "" && pUpper != "MESHCORE" && pUpper != "PACKETS" {
			parsed.Region = pUpper
		}
	}
	if len(topicParts) >= 3 {
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
			Region   string `json:"region"`
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
			// Only override parsed.Region from JSON if it's not generic ("MESH", "GLOBAL") or if topic region is default
			if jsonMsg.Scope != "" && strings.ToUpper(jsonMsg.Scope) != "MESH" && strings.ToUpper(jsonMsg.Scope) != "GLOBAL" {
				parsed.Region = strings.ToUpper(jsonMsg.Scope)
			} else if jsonMsg.Region != "" && strings.ToUpper(jsonMsg.Region) != "MESH" && strings.ToUpper(jsonMsg.Region) != "GLOBAL" {
				parsed.Region = strings.ToUpper(jsonMsg.Region)
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

	// Sanitize Region
	parsed.Region = strings.ToUpper(parsed.Region)
	if parsed.Region == "" {
		parsed.Region = "MESH"
	}

	// Check if region can be refined from topic, origin, observer, advert name, or GPS
	combinedInfo := strings.ToUpper(topic + " " + parsed.Origin + " " + parsed.Observer + " " + parsed.AdvertName)
	if strings.Contains(combinedInfo, "WRO") || strings.Contains(combinedInfo, "WROC") {
		parsed.Region = "WRO"
	} else if strings.Contains(combinedInfo, "POZ") || strings.Contains(combinedInfo, "POZN") {
		parsed.Region = "POZ"
	} else if strings.Contains(combinedInfo, "IEG") || strings.Contains(combinedInfo, "ZIELONA") {
		parsed.Region = "IEG"
	} else if parsed.Lat != 0 && parsed.Lon != 0 {
		// Infer region from GPS bounding box coordinates if available
		if parsed.Lat >= 50.8 && parsed.Lat <= 51.4 && parsed.Lon >= 16.6 && parsed.Lon <= 17.4 {
			parsed.Region = "WRO"
		} else if parsed.Lat >= 52.1 && parsed.Lat <= 52.7 && parsed.Lon >= 16.5 && parsed.Lon <= 17.3 {
			parsed.Region = "POZ"
		} else if parsed.Lat >= 51.7 && parsed.Lat <= 52.2 && parsed.Lon >= 15.0 && parsed.Lon <= 15.8 {
			parsed.Region = "IEG"
		}
	}

	return parsed, nil
}

func parseAdvertPayload(payload []byte, pkt *ParsedPacket) {
	// Standard MeshCore Advert format:
	// If full length (>= 100 bytes): PubKey(32B), Timestamp(4B), Sig(64B), AppFlags(1B), [Lat(4B), Lon(4B)], Name(...)
	if len(payload) >= 3 {
		pkt.AdvertKey = strings.ToUpper(hex.EncodeToString(payload[:3])) // 3-byte prefix (6 hex chars)
	}

	if len(payload) < 101 {
		// Short or incomplete advert payload
		if len(payload) > 4 {
			nameStr := cleanUTF8String(payload[4:])
			if nameStr != "" {
				pkt.AdvertName = nameStr
			}
		}
		return
	}

	appdata := payload[100:]
	flags := appdata[0]
	hasLocation := (flags & 0x10) != 0
	hasFeat1 := (flags & 0x20) != 0
	hasFeat2 := (flags & 0x40) != 0
	hasName := (flags & 0x80) != 0

	off := 1
	if hasLocation && len(appdata) >= off+8 {
		latRaw := int32(binary.LittleEndian.Uint32(appdata[off : off+4]))
		lonRaw := int32(binary.LittleEndian.Uint32(appdata[off+4 : off+8]))
		lat := float64(latRaw) / 1e6
		lon := float64(lonRaw) / 1e6
		if lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 {
			pkt.Lat = lat
			pkt.Lon = lon
		}
		off += 8
	}

	if hasFeat1 && len(appdata) >= off+2 {
		off += 2
	}
	if hasFeat2 && len(appdata) >= off+2 {
		off += 2
	}

	if hasName && off < len(appdata) {
		nameEnd := len(appdata)
		for i := off; i < len(appdata); i++ {
			if appdata[i] == 0x00 {
				nameEnd = i
				break
			}
		}
		nameStr := cleanUTF8String(appdata[off:nameEnd])
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
