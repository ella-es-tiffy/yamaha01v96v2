# Yamaha 01V96 MIDI Protocol Implementation Status

This document outlines the current status of the Yamaha 01V96 MIDI protocol implementation within the `01v96-remote` project. It details the supported features, communication methods, and areas for future development or reverse engineering.

## 1. Overview
The communication relies primarily on **System Exclusive (SysEx)** messages, specifically using the Yamaha proprietary request/response format (Model ID `0x3E` for 01V96).

- **Header**: `F0 43 1n 3E` (where `n` is channel/device ID usually `0` or `1`)
- **Parameter Changes**: `... 7F 01 [LO] [HI] [CH] ...`
- **Bulk Data**: `... 0E ...` or `... 7F 01 ...`

## 2. Implemented Features

### Channel Strip Control
| Feature | SysEx / Msg Type | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Fader** | `7F 01 1C` | ✅ Full | In/Out. 10-bit resolution (mapped to 14-bit in logic). |
| **Mute** | `7F 01 1A` | ✅ Full | In/Out. On/Off logic inverted (On = Unmute). |
| **Pan** | `7F 01 1B` | ✅ Full | In/Out. 0-127 mapping. |
| **Attenuation** | `7F 01 1D` | ✅ Full | In/Out. Signed 14-bit dB mapping (-96.0 to +12.0 dB). |
| **Phase** | - | ❌ Missing | Not implemented. |
| **Surround** | - | ❌ Missing | Not implemented. |

### Equalizer (EQ)
| Feature | SysEx / Msg Type | Status | Notes |
| :--- | :--- | :--- | :--- |
| **EQ Param** | `7F 01 20` | ✅ Full | Q, Freq, Gain x 4 Bands (Low, L-Mid, H-Mid, High). |
| **EQ Type** | `7F 01 20 00` | ✅ Full | Type I / Type II switching. |
| **EQ On/Off** | `7F 01 20 0F` | ✅ Full | Channel EQ Bypass. |
| **Library Recall**| `7F 10 01` | ✅ Full | Recall Factory & User Presets (1-128). |
| **Library Store** | `7F 10 21` | ✅ Full | Store User Presets (41-128). |
| **Library Name** | `7F 10 41` | ✅ Full | Set Name for stored presets. |

### Dynamics (Compressor / Gate)
*Note: Partially present in parser, but setter methods are incomplete.*
| Feature | SysEx / Msg Type | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Gate On/Off** | `7F 01 1E` | ⚠️ Read-Only | Parser detects status. No `setGate` method. |
| **Gate Params** | `7F 01 1E` | ⚠️ Read-Only | Parser detects Thr, Range, Atk, Rel, Hold. |
| **Comp On/Off** | `7F 01 1F` | ⚠️ Read-Only | Parser detects status. No `setComp` method. |
| **Comp Params** | `7F 01 1F` | ⚠️ Read-Only | Parser detects Thr, Rat, Atk, Rel, Knee, Gain. |

### Routing & Aux
| Feature | SysEx / Msg Type | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Aux Sends** | `7F 01 2B` | ❌ Missing | Detected in parser switch case but logic empty or minimal. |
| **Bus Routing** | `7F 01 22` | ⚠️ Read-Only | Parser detects Bus 1-8, Stereo, Direct assignment. No setters. |

### System & Control
| Feature | SysEx / Msg Type | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Metering** | `21` (Bulk) | ✅ Full | Universal 32-channel meter request loop (Split 1-16 / 17-32). |
| **Selection** | `0D 04 09 18` | ✅ Full | Bi-directional. Includes Optimistic UI Logic for stability. |
| **Solo/Cue** | `0D 03 2E` | ⚠️ Read-Only | Parser detects Solo state. No setter implemented. |
| **Channel Names**| `0E` (Bulk) | ✅ Full | Requests and parses Channel Names from "Remote" Bank (Bulk R). |

## 3. Reverse Engineering Findings & Todo
The following areas are identified for future work based on the "Reverse Engineering" goal:

1.  **Aux Sends (Sends on Fader):**
    -   Need to implement `setAuxSend(ch, auxBus, val)` using Element `0x2B`.
    -   Need to handle value mapping (Pre/Post toggle?).

2.  **Dynamics Control:**
    -   The parser logic exists (`0x1E`, `0x1F`), so the exact Byte structure is known (P1 = Parameter ID).
    -   **Todo:** Implement `setGate()` and `setComp()` methods mirroring the `setEQ()` logic.

3.  **Routing Control:**
    -   Element `0x22`. P1 identifies the target (Stereo, Bus, Direct).
    -   **Todo:** Add toggle switches for Routing in UI and Backend.

4.  **Scene Memory:**
    -   Currently only EQ Library is handled.
    -   Scene Recall/Store (`07 00`?) is not implemented.

## 4. Known Quirks / Workarounds
-   **Selection Jump:** The hardware tends to reset selection to Ch1 or the Preset target channel upon recall.
    -   *Fix:* Controller uses `recallTargetChannel` lock and forces selection restore (Double-Tap Strategy) after 100ms/1200ms.
-   **Channel Recall:** The "Recall Preset" command (`7F 10 01`) effectively ignores the Channel Byte or behaves inconsistently on recent firmware.
    -   *Workaround:* Command now uses `0x00` (Current Channel), and relying on pre-selection logic.
