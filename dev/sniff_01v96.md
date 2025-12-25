# Yamaha 01V96 MIDI Command Reference
**Source:** Native C MIDI Proxy sniffing Studio Manager  
**Date:** 2025-12-25  
**Total Messages Captured:** ~11,000+

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

Examples:
- Channel 1: ...39 00 00 00 00 07 75 F7  (Value: 0x75)
- Channel 32: ...39 00 1F 00 00 07 61 F7 (Value: 0x61)
```

### Aux Sends
```
Type: 0x2B (Auxiliary Send Level)
F0 43 10 3E 7F 01 2B 00 [AUX_ID] 00 00 07 [VALUE] F7

Examples:
- Aux 1: ...2B 00 00 00 00 07 75 F7
- Aux 8: ...2B 00 07 00 00 07 61 F7
```

### Bus/Master Faders
```
Type: 0x1C (Bus/Master Level)
F0 43 10 3E 7F 01 1C 00 [BUS_ID] 00 00 [MSB] [LSB] F7

Examples:
- Bus 1: ...1C 00 20 00 00 01 02 F7
- Master: ...1C 00 26 00 00 01 0C F7
```

### EQ Parameters
```
Type: 0x23 (EQ Settings)
F0 43 10 3E 7F 01 23 [BAND] [CH] 00 00 [VALUE_MSB] [VALUE_LSB] F7

Examples (massive data, too many to list):
- Band 1 Frequency: ...23 10 04 00 00 04 7E F7
- Band 2 Gain: ...23 16 07 00 00 00 00 F7
- Q Factor: ...23 17 07 00 00 04 49 F7
```

### Effects
```
Type: 0x4F (Effect 1-4 Parameters)
Type: 0x4D (Effect Selection/Bypass)

F0 43 10 3E 7F 01 4F 00 00 00 00 [MSB] [LSB] F7
F0 43 10 3E 7F 01 4D 00 00 00 00 [VALUE] [VALUE] F7

Examples:
- Reverb Time: ...4F 00 00 00 00 02 46 F7
- Effect Bypass: ...4D 00 00 00 00 00 01 F7
```

---

## 2. Parameter Request (Read)
**Format:** `F0 43 30 3E 1A 21 [PAGE] [SUBPAGE] [PARAM] 00 [FLAGS] F7`

### Standard Refresh
```
F0 43 30 3E 1A 21 00 00 00 00 10 F7  (Page 0, All params)
F0 43 30 3E 1A 21 00 00 20 00 10 F7  (Page 0, Sub-page)
F0 43 30 3E 1A 21 01 00 00 00 08 F7  (Page 1)
F0 43 30 3E 1A 21 02 00 00 00 08 F7  (Page 2)
F0 43 30 3E 1A 21 04 00 00 00 02 F7  (Page 4 - Effects)
```

**Observation:** Studio Manager sends these after every parameter change to refresh the UI.

---

## 3. Master/Layer Control
**Format:** `F0 43 10 3E 1A 04 09 [CMD] 00 00 00 00 [VALUE] F7`

### Layer Switch
```
F0 43 10 3E 1A 04 09 18 00 00 00 00 [LAYER] F7

Values:
- 0x38 = Layer 1-16
- 0x39 = Layer 17-32
```

### Master Selection
```
F0 43 10 3E 1A 04 09 21 00 00 00 00 [STATE] F7

Values:
- 0x00 = Off
- 0x01 = On
```

---

## 4. CRITICAL FINDINGS - EQ PRESET COMMANDS! 🎉

### ✅ STORE (with Name)
```
Step 1: Initiate Store
F0 43 10 3E 7F 10 21 00 [ID] 00 00 F7

Step 2: Set Name
F0 43 10 3E 7F 10 41 00 [ID] [NAME_16_BYTES_ASCII] F7

Example - "helloworld" to Preset 41 (ID 0x29):
SM→MIXER: F0 43 10 3E 7F 10 21 00 29 00 00 F7
SM→MIXER: F0 43 10 3E 7F 10 41 00 29 68 65 6C 6C 6F 77 6F 72 6C 64 20 20 20 20 20 20 F7
```

**Name Format:**
- Exactly 16 bytes ASCII
- Pad with spaces (0x20) if shorter
- Example: "helloworld" = `68 65 6C 6C 6F 77 6F 72 6C 64 20 20 20 20 20 20`

### ✅ RECALL
```
F0 43 10 3E 7F 10 01 00 [ID] 00 00 F7

Examples:
- Recall Preset 41 (ID 0x29, "helloworld"):
  SM→MIXER: F0 43 10 3E 7F 10 01 00 29 00 00 F7

- Recall Preset 40 (ID 0x28, "narrator"):
  SM→MIXER: F0 43 10 3E 7F 10 01 00 28 00 00 F7

- Recall Preset 39 (ID 0x27, "pine-Eq"):
  SM→MIXER: F0 43 10 3E 7F 10 01 00 27 00 00 F7
```

### ✅ DELETE
```
F0 43 10 3E 7F 10 61 00 [ID] F7

Example - Delete Preset 41 (ID 0x29):
SM→MIXER: F0 43 10 3E 7F 10 61 00 29 F7
```

**Note:** Undo is handled in Studio Manager software, not via MIDI.

### ❌ NO Bulk Sync Command

**Tested:**
- Studio Manager's "Sync" button is grayed out
- No bulk request command exists
- Cannot retrieve all preset names via MIDI programmatically

**Workaround:**
1. **One-time:** User triggers manual Bulk Transmit at mixer (`UTILITY → MIDI → Bulk Dump → EQ LIBRARY → TRANSMIT`)
2. App parses incoming 0x51 messages containing names
3. App stores names locally for future recalls

### ID Mapping
```
UI Display: 1-128
MIDI ID: 0x00-0x7F (0-127)

Example:
- UI Preset #41 = MIDI ID 0x28 (40 decimal, 0-based)
- UI Preset #40 = MIDI ID 0x27 (39 decimal)
```

---

## 5. Tested Features

### Successfully Captured:
- ✅ All Faders (Ch 1-32, Aux 1-8, Bus 1-8, Sti 1-4, Master)
- ✅ Pan controls
- ✅ Mute/Solo buttons
- ✅ EQ parameters (all bands, all controls)
- ✅ Compressor parameters (threshold, ratio, attack, release, etc.)
- ✅ Gate parameters
- ✅ Effects 1-4 (all parameters: reverb, delay, etc.)
- ✅ Layer switching (1-16, 17-32)
- ✅ Master selection

### NOT Functional via MIDI:
- ❌ EQ Preset Save/Recall (no SysEx commands)
- ❌ Compressor Preset Save/Recall
- ❌ Gate Preset Save/Recall
- ❌ Input Patch Store/Recall
- ❌ Output Patch Store/Recall (possibly dysfunctional even in SM)
- ❌ Effect Preset Save/Recall
- ❌ Bulk Library Sync/Dump

---

## 6. Implications for Web App

### What We CAN Do:
1. **Real-time Parameter Control:**
   - Faders, Pans, Mutes (all working)
   - EQ parameters (full control)
   - Effects parameters (full control)
   - Compressor/Gate (full control)

2. **State Reflection:**
   - Monitor all parameter changes
   - Build local state model
   - Sync UI with mixer

### What We CANNOT Do (via MIDI):
1. **Preset Management:**
   - Save EQ presets to mixer
   - Recall EQ presets from mixer
   - Get preset names from mixer (except manual Bulk Transmit)

2. **Bulk Operations:**
   - No "Sync All" command
   - No library dump request
   - Must query parameters individually

---

## 7. Workaround for EQ Presets

Since Studio Manager doesn't use MIDI Store/Recall:

**Option A: Manual Transmit (Current)**
- User triggers manual Bulk Dump at mixer
- App parses incoming 0x51 messages
- Works but requires user action

**Option B: Local Preset Storage**
- App stores presets locally (like Studio Manager)
- "Save" = snapshot all EQ params to local DB
- "Recall" = send all params individually
- No mixer preset memory used

**Option C: Hybrid**
- Allow manual transmit for existing mixer presets
- Add local preset storage for web-app-only presets

---

## 8. Next Steps

1. **Implement Parameter Control:**
   - Use discovered message formats
   - Build fader/EQ/effects controllers

2. **Implement Local Preset System:**
   - Since MIDI Store/Recall doesn't exist
   - Build DB-backed preset management

3. **Parse Manual Bulk Dumps:**
   - Fix `processEQNames()` in yamaha_controller.js
   - Allow one-time import of mixer presets

4. **Document All Parameter Types:**
   - Complete mapping of all 0x23 (EQ) subtypes
   - Map all 0x4F/0x4D (Effects) parameters

---

## Appendix: Raw Log Samples

(See separate file for full 11,000+ line capture)

**Example Sequences:**

**Fader Movement:**
```
SM→MIXER: F0 43 10 3E 7F 01 39 00 00 00 00 07 75 F7
SM→MIXER: F0 43 10 3E 7F 01 39 00 00 00 00 07 6B F7
SM→MIXER: F0 43 10 3E 7F 01 39 00 00 00 00 07 61 F7
```

**EQ Encoder Turn:**
```
SM→MIXER: F0 43 10 3E 7F 01 23 17 07 00 00 04 49 F7
SM→MIXER: F0 43 10 3E 7F 01 23 17 07 00 00 04 38 F7
SM→MIXER: F0 43 10 3E 7F 01 23 17 07 00 00 04 28 F7
```

**Effect Parameter:**
```
SM→MIXER: F0 43 10 3E 7F 01 4F 00 00 00 00 03 6E F7
SM→MIXER: F0 43 10 3E 7F 01 4F 00 00 00 00 03 73 F7
```

---

**END OF REFERENCE**
