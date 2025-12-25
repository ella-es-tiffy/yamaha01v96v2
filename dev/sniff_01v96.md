# Yamaha 01V96 MIDI Command Reference
**Source:** Native C MIDI Proxy sniffing Studio Manager  
**Date:** 2025-12-25  
**Version:** v1.1stable

---

## Message Format Overview

All messages follow the pattern:
```
F0 43 [DEVICE] 3E [COMMAND_TYPE] [PARAMS...] F7
```

**Device IDs:**
- `10` = Transmit to mixer
- `30` = Request from mixer
- `00` = Broadcast/Unknown

**Command Types:**
- `7F 01` = Parameter Change
- `1A 21` = Parameter Request
- `1A 04 09` = Master/Layer Control

---

## 1. Parameter Change (Write)
**Format:** `F0 43 10 3E 7F 01 [TYPE] [SUBTYPE] [ID] 00 00 [VALUE...] F7`

### Channel Faders
```
Type: 0x39 (Channel Level)
F0 43 10 3E 7F 01 39 00 [CH_ID] 00 00 07 [VALUE] F7
```

### EQ Parameters
```
Type: 0x23 (EQ Settings)
F0 43 10 3E 7F 01 23 [BAND] [CH] 00 00 [VALUE_MSB] [VALUE_LSB] F7
```

---

## 2. Parameter Request (Read)
**Format:** `F0 43 30 3E 1A 21 [PAGE] [SUBPAGE] [PARAM] 00 [FLAGS] F7`

---

## 3. Master/Layer Control
**Format:** `F0 43 10 3E 1A 04 09 [CMD] 00 00 00 00 [VALUE] F7`

---

## 4. EQ LIBRARY COMMANDS (Confirmed) 🎉

We have successfully verified and implemented the native MIDI preset commands.

### ✅ STORE (with Name)
```
Step 1: Initiate Store
F0 43 10 3E 7F 10 21 00 [ID] 00 00 F7

Step 2: Set Name
F0 43 10 3E 7F 10 41 00 [ID] [NAME_16_BYTES_ASCII] F7

Example - "MY PRESET" to Preset 41 (ID 0x28):
MIXER RX: F0 43 10 3E 7F 10 21 00 28 00 00 F7
MIXER RX: F0 43 10 3E 7F 10 41 00 28 4D 59 20 50 52 45 53 45 54 20 20 20 20 20 20 20 F7
```

### ✅ RECALL
```
F0 43 10 3E 7F 10 01 00 [ID] 00 00 F7

Examples:
- Recall Preset 1 (ID 0x00): ...01 00 00 00 00 F7
- Recall Preset 41 (ID 0x28): ...01 00 28 00 00 F7
```

---

## 5. SMART CACHE MECHANISM

Since the mixer does not broadcast all parameters on recall, we implemented a "Smart Cache":

1.  **Instant Update:** App sends MIDI Recall + immediately updates UI from local SQLite DB.
2.  **Verification (The "Spam Filter"):**
    - **Factory Presets (1-40):** Skip sync (they never change).
    - **Cached User Presets:** Skip sync (trust local DB for speed).
    - **Unknown Presets:** App triggers a verify-sync (requests all 14 EQ params), learns them, and stores them in DB.

---

## 6. Tested & Implemented v1.1stable
- ✅ **EQ Library:** Full bidirectional sync, Store, Recall, Name management.
- ✅ **High-Speed Metering:** Optimized with "Bank-Only" mode.
- ✅ **Zero-Latency UI:** Smart Cache provides instant feedback.
- ✅ **Safety Controls:** Interlock covers and safe MIDI spacing (40ms).

---

**END OF REFERENCE (v1.1stable)**
