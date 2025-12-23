# Yamaha 01V96 V2 Web Control

Web-basierte Fernsteuerung für den Yamaha 01V96 V2 Digital Mixer via MIDI über VirtualHere USB-over-IP.

## System-Status

### Hardware
- **Gerät:** Yamaha 01V96 V2 Digital Mixing Console
- **Verbindung:** VirtualHere USB-over-IP Bridge
- **USB Vendor ID:** 0x0499 (Yamaha Corporation)
- **USB Product ID:** 0x5008
- **MIDI Ports:** 8 Input / 8 Output Ports erkannt

### Software
- **Plattform:** macOS (Darwin 24.6.0)
- **Node.js:** Installiert
- **MIDI Library:** node-midi
- **WebSocket:** ws

## Features

### ✅ Implementiert

1. **USB Device Detection**
   - Automatische Erkennung des Yamaha 01V96 V2
   - 8 MIDI-Ports (bidirektional)

2. **MIDI Communication**
   - MIDI Input/Output über alle 8 Ports
   - Control Change (CC) Unterstützung
   - NRPN (Non-Registered Parameter Numbers) für 10-bit+ Auflösung
   - SysEx für Device Identity Request

3. **MIDI Controller Class**
   - `yamaha_controller.js` - Vollständige Controller-Klasse
   - Verbindungsmanagement
   - NRPN Encoder/Decoder
   - Channel Fader Control
   - CC Message Handling

4. **Web Interface**
   - WebSocket Server (Port 3001)
   - HTTP Server (Port 3000)
   - Real-time Mixer Control
   - 16 Channel Strips (erweiterbar auf 32)
   - Master Fader
   - Mute/Solo Buttons
   - Responsive Design

5. **Monitoring Tools**
   - `scan_midi.js` - Port Scanner mit Identity Request
   - `monitor_live.js` - Live MIDI Monitor für alle 8 Ports
   - Real-time Message Decoding

## Installation

```bash
# Dependencies installieren
npm install

# MIDI Ports scannen
node scan_midi.js

# Live MIDI Monitor starten
node monitor_live.js

# Web Server starten
node server.js
```

## Verwendung

### 1. Web Interface

```bash
node server.js
```

Öffne im Browser: `http://localhost:3000`

**Features:**
- Echtzeit Fader-Steuerung (0-1023, 10-bit)
- Channel Mute/Solo
- Master Fader
- WebSocket-basierte Synchronisation

### 2. MIDI Monitor

```bash
node monitor_live.js
```

Überwacht alle 8 MIDI-Ports gleichzeitig und zeigt:
- Control Change Messages
- NRPN Messages
- Note On/Off
- Pitch Bend
- SysEx

### 3. Standalone Controller

```javascript
const Yamaha01V96Controller = require('./yamaha_controller');

const mixer = new Yamaha01V96Controller(0); // Port 0

if (mixer.connect()) {
    // Channel 1 Fader auf 512 setzen (Mitte)
    mixer.setChannelFader(1, 512);

    // Control Change senden
    mixer.sendCC(1, 7, 100); // Channel 1, Volume CC, Wert 100

    // NRPN senden
    mixer.sendNRPN(1, 0x10, 0x00, 0x40, 0x00);

    mixer.disconnect();
}
```

## MIDI Implementation

### Control Change (CC)
Das Yamaha 01V96 V2 unterstützt Standard MIDI CC für 7-bit Auflösung (0-127).

**Wichtige CCs:**
- CC 7: Volume
- CC 10: Pan
- CC 91: Reverb Send
- CC 93: Chorus Send

### NRPN (10-bit+ Auflösung)
Für präzise Fader-Steuerung nutzt das 01V96 NRPN mit 10-bit (0-1023) oder höherer Auflösung.

**NRPN Message Format:**
```
0xB0 + Ch | 0x63 | MSB  (NRPN MSB)
0xB0 + Ch | 0x62 | LSB  (NRPN LSB)
0xB0 + Ch | 0x06 | MSB  (Data Entry MSB)
0xB0 + Ch | 0x26 | LSB  (Data Entry LSB)
```

**Fader Werte:**
- 10-bit: 0-1023 (Standard für die meisten Fader)
- 14-bit: 0-16383 (für spezielle Parameter)

### Port Konfiguration

**Auf dem 01V96 V2:**
1. MIDI/HOST Setup öffnen
2. Rx/Tx PORT: 1
3. Port Type: USB
4. Tx/Rx CHANNEL: 1
5. PARAMETER CHANGE: ON
6. Fader Resolution: LOW (für 10-bit via NRPN)

## Dateien

```
yamaha_midi/
├── README.md                 # Diese Datei
├── package.json              # Node.js Dependencies
├── scan_midi.js              # MIDI Port Scanner
├── monitor_live.js           # Live MIDI Monitor (8 Ports)
├── yamaha_controller.js      # Yamaha 01V96 Controller Class
├── server.js                 # WebSocket + HTTP Server
└── public/
    ├── index.html            # Web Interface
    ├── style.css             # Styling
    └── app.js                # Client-side JavaScript
```

## Technische Details

### USB Connection
```
Vendor: YAMAHA Corporation (0x0499)
Product: YAMAHA 01V96 (0x5008)
Version: 1.01
Speed: 12 Mb/s (USB 1.1)
Driver: AppleUSBUserHCI (VirtualHere)
```

### MIDI Ports
```
YAMAHA 01V96 Port1-8 (Input)
YAMAHA 01V96 Port1-8 (Output)
```

### WebSocket Protocol

**Client → Server:**
```json
{
  "type": "setFader",
  "channel": 1,
  "value": 512
}
```

**Server → Client:**
```json
{
  "type": "state",
  "data": {
    "connected": true,
    "channels": [
      {
        "number": 1,
        "name": "Ch 1",
        "fader": 512,
        "pan": 64,
        "mute": false,
        "solo": false
      }
    ]
  }
}
```

## Nächste Schritte

### 🔧 Verbesserungen

1. **NRPN Address Table**
   - Vollständige NRPN-Adressen aus offizieller Yamaha Dokumentation extrahieren
   - Mapping für alle Parameter (EQ, Dynamics, Aux Sends, etc.)

2. **Erweiterte Features**
   - EQ Control (High, Mid, Low)
   - Dynamics (Gate, Compressor)
   - Aux Sends (8x Aux Buses)
   - Scene Recall via Program Change
   - Meter Bridge (Level Anzeigen)

3. **UI/UX**
   - Touch-optimierte Bedienung
   - Drag & Drop für Channel Groups
   - Custom Channel Names
   - Fader Grouping
   - VU Meters

4. **Persistence**
   - Scene Speicherung in Datenbank
   - Automatisches State Backup
   - Undo/Redo Funktionalität

5. **Multi-Client**
   - Mehrere Browser gleichzeitig
   - Tablet/Mobile Apps
   - OSC Bridge

## Ressourcen

- [Yamaha 01V96 V2 Manual](https://usa.yamaha.com/files/download/other_assets/5/334235/01v96v2_om_en_f0.pdf)
- [MIDI Implementation Chart](https://www.manualslib.com/manual/871851/Yamaha-01v-96.html?page=134)
- [01v96-remote GitHub](https://github.com/kryops/01v96-remote) - Ähnliches Projekt als Referenz
- [VirtualHere USB Server](https://virtualhere.com/)

## Lizenz

MIT

## Autor

Entwickelt für die Steuerung des Yamaha 01V96 V2 über VirtualHere USB-over-IP.
