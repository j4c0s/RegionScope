package packet

import (
	"crypto/aes"
	"crypto/hmac"
	"crypto/sha256"
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

// ParsedPacket represents a processed MeshCore packet with rich decoded fields.
type ParsedPacket struct {
	ID           int64    `json:"id,omitempty"`
	Timestamp    string   `json:"timestamp"`
	Region       string   `json:"region"`
	Observer     string   `json:"observer"`
	Origin       string   `json:"origin"`
	Scope        string   `json:"scope,omitempty"`
	ScopeName    string   `json:"scope_name,omitempty"`
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
	PacketSize   int      `json:"packet_size"`
	SNR          *float64 `json:"snr,omitempty"`
	RSSI         *int     `json:"rssi,omitempty"`
	AdvertName   string   `json:"advert_name,omitempty"`
	AdvertKey    string   `json:"advert_key,omitempty"`
	Lat          float64  `json:"lat,omitempty"`
	Lon          float64  `json:"lon,omitempty"`
	// Decoded Payload fields
	ChannelName  string   `json:"channel_name,omitempty"`
	DecryptedTxt string   `json:"decrypted_txt,omitempty"`
	Sender       string   `json:"sender,omitempty"`
	CtrlSubtype  string   `json:"ctrl_subtype,omitempty"`
	DestHash     string   `json:"dest_hash,omitempty"`
	SrcHash      string   `json:"src_hash,omitempty"`
	MAC          string   `json:"mac,omitempty"`
	ExtraHash    string   `json:"extra_hash,omitempty"`
	DecodedJSON  string   `json:"decoded_json,omitempty"`
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
	trimmedPayload := strings.TrimSpace(string(rawPayload))

	if len(trimmedPayload) > 0 && trimmedPayload[0] == '{' {
		var jsonMap map[string]interface{}
		if err := json.Unmarshal([]byte(trimmedPayload), &jsonMap); err == nil {
			// Search for packet hex in common keys
			hexKeys := []string{"raw", "hex", "payload", "data", "packet", "raw_hex", "payload_hex", "packet_hex"}
			for _, k := range hexKeys {
				if val, ok := jsonMap[k].(string); ok && val != "" {
					rawHex = val
					break
				}
			}

			// Check nested payload object if present
			if rawHex == "" {
				if pObj, ok := jsonMap["payload"].(map[string]interface{}); ok {
					for _, k := range []string{"raw", "hex", "data", "raw_hex", "payload_hex"} {
						if val, ok := pObj[k].(string); ok && val != "" {
							rawHex = val
							break
						}
					}
				}
			}

			if orig, ok := jsonMap["origin"].(string); ok && orig != "" {
				parsed.Origin = orig
			}
			if obs, ok := jsonMap["observer"].(string); ok && obs != "" {
				parsed.Observer = obs
			}
			if h, ok := jsonMap["hash"].(string); ok && h != "" {
				jsonHash = h
			}

			if sc, ok := jsonMap["scope"].(string); ok && sc != "" {
				parsed.Scope = strings.ToUpper(sc)
				parsed.ScopeName = parsed.Scope
				if strings.ToUpper(sc) != "MESH" && strings.ToUpper(sc) != "GLOBAL" {
					parsed.Region = strings.ToUpper(sc)
				}
			} else if rg, ok := jsonMap["region"].(string); ok && rg != "" {
				if strings.ToUpper(rg) != "MESH" && strings.ToUpper(rg) != "GLOBAL" {
					parsed.Region = strings.ToUpper(rg)
				}
			}

			if snrVal, ok := jsonMap["snr"].(float64); ok {
				parsed.SNR = &snrVal
			}
			if rssiVal, ok := jsonMap["rssi"].(float64); ok {
				rssiInt := int(rssiVal)
				parsed.RSSI = &rssiInt
			}
		}
	} else {
		rawHex = trimmedPayload
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
	parsed.PacketSize = len(buf)

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

	// Decode specific payload types if payload bytes are present
	if len(buf) > offset {
		payloadBuf := buf[offset:]
		decodePayloadDetails(payloadType, payloadBuf, parsed)
	}

	// Sanitize Region
	parsed.Region = strings.ToUpper(parsed.Region)
	if parsed.Region == "" {
		parsed.Region = "MESH"
	}

	// Flexible region matching for WRO, IEG, POZ (e.g. WRO, WROCLAW, PL-WRO, POZ, POZNAN, POZ_SKORZEWO, IEG, ZIELONAGORA)
	regUpper := strings.ToUpper(parsed.Region)
	isWro := strings.Contains(regUpper, "WRO") || strings.Contains(regUpper, "WROCLAW")
	isPoz := strings.Contains(regUpper, "POZ") || strings.Contains(regUpper, "POZNAN")
	isIeg := strings.Contains(regUpper, "IEG") || strings.Contains(regUpper, "ZIELONA")

	if !isWro && !isPoz && !isIeg {
		return nil, fmt.Errorf("packet region '%s' ignored (allowed: WRO, IEG, POZ)", parsed.Region)
	}

	// Standardize parsed.Region for display
	if isWro {
		parsed.Region = "WRO"
	} else if isPoz {
		parsed.Region = "POZ"
	} else if isIeg {
		parsed.Region = "IEG"
	}

	if parsed.ScopeName == "" {
		parsed.ScopeName = parsed.Scope
	}

	// Build a decoded JSON summary map for CoreScope parity
	decodedMap := map[string]interface{}{
		"type": parsed.TypeName,
	}
	if parsed.AdvertName != "" {
		decodedMap["type"] = "ADVERT"
		decodedMap["name"] = parsed.AdvertName
		if parsed.AdvertKey != "" {
			decodedMap["pubKey"] = parsed.AdvertKey
		}
		if parsed.Lat != 0 || parsed.Lon != 0 {
			decodedMap["lat"] = parsed.Lat
			decodedMap["lon"] = parsed.Lon
		}
	} else if parsed.ChannelName != "" && parsed.DecryptedTxt != "" {
		decodedMap["type"] = "CHAN"
		decodedMap["channel"] = parsed.ChannelName
		decodedMap["sender"] = parsed.Sender
		decodedMap["text"] = parsed.DecryptedTxt
	} else if parsed.CtrlSubtype != "" {
		decodedMap["type"] = "CONTROL"
		decodedMap["ctrlSubtype"] = parsed.CtrlSubtype
	} else if parsed.DestHash != "" && parsed.SrcHash != "" {
		decodedMap["type"] = parsed.TypeName
		decodedMap["destHash"] = parsed.DestHash
		decodedMap["srcHash"] = parsed.SrcHash
	}
	if dj, err := json.Marshal(decodedMap); err == nil {
		parsed.DecodedJSON = string(dj)
	}

	return parsed, nil
}

func decodePayloadDetails(pType byte, payload []byte, pkt *ParsedPacket) {
	switch pType {
	case PayloadTypeAdvert:
		parseAdvertPayload(payload, pkt)
	case PayloadTypeReq, PayloadTypeResp, PayloadTypeTxtMsg:
		if len(payload) >= 4 {
			pkt.DestHash = strings.ToUpper(hex.EncodeToString(payload[0:1]))
			pkt.SrcHash = strings.ToUpper(hex.EncodeToString(payload[1:2]))
			pkt.MAC = strings.ToUpper(hex.EncodeToString(payload[2:4]))
		}
	case PayloadTypeAck:
		if len(payload) >= 4 {
			crc := binary.LittleEndian.Uint32(payload[0:4])
			pkt.ExtraHash = fmt.Sprintf("%08X", crc)
		}
	case PayloadTypeGrpTxt:
		if len(payload) >= 3 {
			channelHash := payload[0]
			pkt.MAC = strings.ToUpper(hex.EncodeToString(payload[1:3]))
			ciphertext := payload[3:]

			// Attempt AES-128-ECB channel decryption with known keys
			knownChannels := []string{"#public", "Public", "#mesh", "mesh", "#wro", "#poz", "#ieg", "WRO", "POZ", "IEG"}
			for _, chName := range knownChannels {
				key := deriveChannelKey(chName)
				if channelHashBytes(key) == channelHash {
					if plain, ok := decryptChannelBlock(key, payload[1:3], ciphertext); ok {
						if ts, sender, msg, err := parseChannelPlaintext(plain); err == nil {
							_ = ts
							pkt.ChannelName = chName
							pkt.Sender = sender
							pkt.DecryptedTxt = msg
							break
						}
					}
				}
			}
		}
	case 0x0B: // PayloadTypeControl
		if len(payload) >= 1 {
			switch payload[0] & 0xF0 {
			case 0x80:
				pkt.CtrlSubtype = "DISCOVER_REQ"
			case 0x90:
				pkt.CtrlSubtype = "DISCOVER_RESP"
			default:
				pkt.CtrlSubtype = fmt.Sprintf("CTRL_0x%02X", payload[0])
			}
		}
	}
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

func deriveChannelKey(channelName string) []byte {
	h := sha256.Sum256([]byte(channelName))
	return h[:16]
}

func channelHashBytes(key []byte) byte {
	h := sha256.Sum256(key)
	return h[0]
}

func decryptChannelBlock(key, mac, ciphertext []byte) ([]byte, bool) {
	if len(key) != 16 || len(mac) != 2 || len(ciphertext) == 0 || len(ciphertext)%aes.BlockSize != 0 {
		return nil, false
	}

	channelSecret := make([]byte, 32)
	copy(channelSecret, key)

	h := hmac.New(sha256.New, channelSecret)
	h.Write(ciphertext)
	calculatedMac := h.Sum(nil)
	if calculatedMac[0] != mac[0] || calculatedMac[1] != mac[1] {
		return nil, false
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, false
	}
	plaintext := make([]byte, len(ciphertext))
	for i := 0; i < len(ciphertext); i += aes.BlockSize {
		block.Decrypt(plaintext[i:i+aes.BlockSize], ciphertext[i:i+aes.BlockSize])
	}

	return plaintext, true
}

func parseChannelPlaintext(plaintext []byte) (timestamp uint32, sender string, message string, err error) {
	if len(plaintext) < 5 {
		return 0, "", "", fmt.Errorf("plaintext too short")
	}

	timestamp = binary.LittleEndian.Uint32(plaintext[0:4])
	text := string(plaintext[5:])
	if idx := strings.IndexByte(text, 0); idx >= 0 {
		text = text[:idx]
	}

	if !utf8.ValidString(text) {
		return 0, "", "", fmt.Errorf("invalid utf8")
	}

	if colonIdx := strings.Index(text, ": "); colonIdx > 0 && colonIdx < 50 {
		potentialSender := text[:colonIdx]
		if !strings.ContainsAny(potentialSender, ":[]") {
			return timestamp, potentialSender, text[colonIdx+2:], nil
		}
	}

	return timestamp, "", text, nil
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
