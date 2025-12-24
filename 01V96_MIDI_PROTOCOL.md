# Yamaha 01V96 MIDI SysEx Protocol Documentation

This document lists the discovered MIDI System Exclusive (SysEx) messages for controlling the Yamaha 01V96 digital mixer. 

**Base Message Structure:**
All messages start with the Yamaha Header: `F0 43 10 3E`
And end with the End of Exclusive: `F7`

---

## 1. Parameter Change (Live Control)
Format: `F0 43 10 3E 7F 01 [Element] [P1] [P2] [D0 D1 D2 D3] F7`

| Element | Parameter | P1 | P2 | Data Format | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **0x1C** | Channel Fader | 0x00 | Ch Index (0-31) | 10-bit: `00 00 (V>>7) (V&7F)` | 0-1023 range |
| **0x4F** | Master Fader | 0x00 | 0x00 | 10-bit: `00 00 (V>>7) (V&7F)` | Master Level |
| **0x1A** | Channel Mute/On | 0x00 | Ch Index (0-31) | `00 00 00 01/00` | 1 = ON, 0 = MUTED |
| **0x4D** | Master Mute/On | 0x00 | 0x00 | `00 00 00 01/00` | 1 = ON, 0 = MUTED |
| **0x1B** | Channel Pan | 0x00 | Ch Index (0-31) | Signed 7-bit | Center=0, Right=+63 (`00 00 00 3F`), Left=-63 (`7F 7F 7F 41`) |
| **0x20** | **EQ Settings** | | Ch Index (0-31) | 4-byte scale | Scaling depends on parameter |
| | - EQ On/Off | **0x0F** | | `00 00 00 01/00` | High-level switch for the channel EQ |
| | - Low Q | **0x01** | | 0x00 - 0x27 | Range 0.1 to 10.0 (Skaliert 0-39) |
| | - Low Freq | **0x02** | | 0.1dB steps | 20Hz - 20kHz |
| | - Low Gain | **0x03** | | Signed `-180` to `+180` | -18.0dB to +18.0dB in 0.1dB steps |
| | - L-Mid (Q/F/G) | **04/05/06** | | Same as Low | |
| | - H-Mid (Q/F/G) | **07/08/09** | | Same as Low | |
| | - High (Q/F/G) | **0A/0B/0C** | | Same as Low | |

---

## 2. System Parameter Change (Selection & More)
Format: `F0 43 10 3E 0D 04 [AddrHigh] [AddrLow] 00 00 00 00 [Value] F7`

| Address | Function | Values | Notes |
| :--- | :--- | :--- | :--- |
| **09 18** | **Selected Channel** | `00` - `1F` (CH1-32) | Changes the focus/display on the mixer hardware |
| | | `0x38` (56) | Master Selection |

---

## 3. Metering
To receive live meter levels for all channels:

**Request:** `F0 43 10 3E 0D 21 F7`
(Send periodically, e.g., every 30 seconds to keep the stream alive).

**Response:** `F0 43 10 3E 21 [74 bytes of data] F7`
The data contains the levels for all channels, buses, and auxes.
- **CH1-32:** Start at byte index 6
- **Master L/R:** Bytes 54 (L) and 55 (R)

---

## 4. Special Messages
- **Pult Busy/Ack:** `F0 43 10 3E 0D 7F F7`
Often sent by the mixer between commands to indicate status.

---

*Captured and documented during the "Neko Yamaha" Pair Programming Session - 2025.*
