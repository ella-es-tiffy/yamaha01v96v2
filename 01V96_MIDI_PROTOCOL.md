# Yamaha 01V96 MIDI SysEx Protocol Documentation

This document lists the discovered MIDI System Exclusive (SysEx) messages for controlling the Yamaha 01V96 digital mixer. 

**Base Message Structure:**
- All messages start with the Yamaha Header: `F0 43 nn 3E` (where `nn` is device ID, usually `10` or `30`)
- End of Exclusive: `F7`

---

## 1. Parameter Change (Live Control)
Format: `F0 43 10 3E 7F 01 [Element] [P1] [P2] [D0 D1 D2 D3] F7`

| Element | Parameter | P1 | P2 (Channel Source) | Data Format / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **0x1C** | Fader | 0x00 | 0-31 (CH), 32-35 (ST), 36-43 (Bus), 44-51 (Aux) | 10-bit: `00 00 (V>>7) (V&7F)` |
| **0x1A** | Mute / ON | 0x00 | same as above | `00 00 00 01` (ON), `00 00 00 00` (MUTED) |
| **0x1B** | Pan | 0x00 | 0-31 (CH) | Signed 7-bit: L63=`7F 7F 7F 41`, C=`00`, R63=`3F` |
| **0x1D** | Attenuation | 0x00 | 0-31 (CH) | 10-bit: ~16000 = 0dB. Range -96dB to +12dB. |
| **0x2B** | Aux Send | 0-7 (Aux#) | 0-31 (CH) | 10-bit: Level of the channel to specific Aux |
| **0x22** | Routing | 0x00 (ST), 0x02 (DIR), 0x03-0A (Bus 1-8) | 0-31 (CH) | `01` (Active), `00` (Inactive) |
| **0x4F** | Master Fader | 0x00 | 0x00 (Fixed) | 10-bit Master Level |
| **0x4D** | Master Mute | 0x00 | 0x00 (Fixed) | `01` (ON), `00` (MUTED) |

### 1.1 EQ Parameters (Element 0x20)
| P1 | Parameter | Band | Range / Notes |
| :--- | :--- | :--- | :--- |
| **0x0F** | EQ On/Off | Global | 1 = ON, 0 = OFF |
| **0x0E** | (Reserved?) | | Old Assumption was Type |
| **0x00** | EQ Type | Global | 0 = Type I, 1 = Type II |
| **0x01/02/03** | Q / Freq / Gain | **Low** | Gain is signed (18.0dB to -18.0dB) |
| **0x05/06/07** | Q / Freq / Gain | **L-Mid** | **Corrected:** Gain=0x07, Q=0x05, Freq=0x06 |
| **0x08/09/0A** | Q / Freq / Gain | **H-Mid** | **Corrected:** Gain=0x0A, Q=0x08, Freq=0x09 |
| **0x0B/0C/0D** | Q / Freq / Gain | **High** | **Corrected:** Gain=0x0D, Q=0x0B, Freq=0x0C |

### 1.2 Dynamics 1 - Gate (Element 0x1E)
| P1 | Parameter | Notes |
| :--- | :--- | :--- |
| **0x01** | Gate ON/OFF | 1=ON |
| **0x04** | Threshold | 10-bit scale |
| **0x05** | Range | |
| **0x06** | Attack | |
| **0x07** | Release | |
| **0x08** | Hold | |

### 1.3 Dynamics 2 - Compressor (Element 0x1F)
| P1 | Parameter | Notes |
| :--- | :--- | :--- |
| **0x01** | Comp ON/OFF | 1=ON |
| **0x04** | Threshold | 10-bit scale |
| **0x05** | Ratio | |
| **0x06** | Attack | |
| **0x07** | Release | |
| **0x08** | Knee | 0-3 (Hard/Soft/...) |
| **0x09** | Out Gain | Signed 10-bit |

---

## 2. System Parameter Change (Selection & Solo)
Format: `F0 43 10 3E 0D [Area] [AddrHigh] [AddrMid] [AddrLow] 00 00 00 [Value] F7`

| Address (H M L) | Function | Range / Values |
| :--- | :--- | :--- |
| **04 09 18** | **Selected Channel** | `00-1F` (CH1-32), `20-23` (ST1-4), `38` (56=Master) |
| **03 2E [CH]** | **Solo (Cue)** | `01` (ON), `00` (OFF). CH matches index above. |
| **00 2E 00** | **User Define 1** | Triggers when the physical User-Def key is pressed |

---

## 3. Metering
Live levels are requested once to start the stream.
- **Request:** `F0 43 10 3E 0D 21 F7`
- **Response:** `F0 43 10 3E 21 [Data...] F7` (approx. 74-128 bytes depending on config)
- **Data Index 9, Stride 2:** Standard Meter Data (0-127)

---

## 4. Library & Recall
Library recall allows loading saved settings (EQ, Dynamics, Effects) to the currently selected channel or a specific slot.

### 4.1 Recall Command
Format: `F0 43 1n 3E 12 [Slot] [LibraryNumber] F7`

| Slot | Target | Notes |
| :--- | :--- | :--- |
| **0x01** | Scene | Recalls a full Scene |
| **0x02** | **EQ Library** | Recalls EQ to selected channel |
| **0x03** | Dynamics | Recalls Dyn 1/2 |
| **0x04** | Effects | Recalls FX engines |

### 4.2 EQ Library Preset Map
Factory presets (1-40) and User presets (41-127).

| Number | Hex ID | Preset Name |
| :--- | :--- | :--- |
| **001-002** | 0x00-01 | Bass Drum 1, 2 |
| **003-004** | 0x02-03 | Snare Drum 1, 2 |
| **005-007** | 0x04-06 | Tom-tom 1, 2, 3 |
| **008-010** | 0x07-09 | Hi-hat, Cymbals, Percussion |
| **012-014** | 0x0B-0D | Guitar (Elec 1/2, Acous) |
| **015-018** | 0x0E-11 | Bass (Elec 1/2, Synth 1/2) |
| **019-020** | 0x12-13 | Piano 1, 2 |
| **021** | 0x14 | Organ |
| **022-023** | 0x15-16 | Strings 1, 2 |
| **024** | 0x17 | Brass |
| **025-026** | 0x18-19 | Male Vocal 1, 2 |
| **027-028** | 0x1A-1B | Female Vo. 1, 2 |
| **029-031** | 0x1C-1E | Chorus 1, 2, 3 |
| **032-033** | 0x1F-20 | Speech 1, 2 |
| **034-035** | 0x21-22 | Radio, Telephone |
| **036-037** | 0x23-24 | BGM, Karaoke |
| **041** | **0x28** | **tiff sub** (User Preset) |
| **044** | **0x2B** | **flashstore** (User Preset) |

---

*Captured and documented during the "Neko Yamaha" Pair Programming Session - 2025.*
