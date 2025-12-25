
const midi = require('midi');
const EQPresetManager = require('./lib/eqPresets');
const BulkParser = require('./lib/bulkParser');
const MIDIHelpers = require('./lib/midiHelpers');
const FACTORY_EQ_PRESETS = require('./lib/factoryPresets');
const db = require('./lib/db');

class Yamaha01V96Controller {
    constructor(portNumber = 0) {
        this.input = new midi.Input();
        this.output = new midi.Output();
        this.portNumber = portNumber;
        this.connected = false;
        this.onStateChange = null;
        this.onRawMidi = null;
        this.meterConfig = { ms: 8000, start: 0, count: 32 }; // Request interval

        // Initialize helper modules
        this.eqPresets = new EQPresetManager(this.output);
        this.bulkParser = new BulkParser();


        this.state = {
            selectedChannel: 1,
            channels: Array(36).fill(null).map((_, i) => ({
                number: i + 1,
                name: (i === 0) ? "RB" : (i === 1) ? "RH" : (i === 2) ? "LB" : (i === 3) ? "LH" : (i === 4) ? "BT_B" : (i === 5) ? "BTH" : (i < 32) ? `CH${i + 1}` : `ST${i - 31}`,
                fader: 0,
                mute: false,
                solo: false,
                pan: 64,
                att: 0,
                eqOn: false,
                eqType: 0,
                eq: {
                    low: { gain: 64, freq: 64, q: 64 },
                    lmid: { gain: 64, freq: 64, q: 64 },
                    hmid: { gain: 64, freq: 64, q: 64 },
                    high: { gain: 64, freq: 64, q: 64 }
                },
                gate: { on: false, thr: 0, range: 0, atk: 0, rel: 0, hold: 0 },
                comp: { on: false, thr: 0, rat: 0, atk: 0, rel: 0, gain: 0, knee: 0 },
                routing: { stereo: false, direct: false, bus: Array(8).fill(false) }
            })),
            master: { fader: 0, mute: false, solo: false },
            eqPresets: { ...FACTORY_EQ_PRESETS }, // Names
            eqLibrary: {}, // Full parameter sets from DB
            settings: {
                meterOffset: 0,
                meterInterval: 500, // Reduced from 8000ms for responsiveness
                meterBroadcastRate: 150, // How often to send meter data to clients (ms)
                autoCloseSafety: false,
                bankOnlyMetering: false,
                uiLocked: false
            }
        };

        this.loadLibrary();
    }

    async loadLibrary() {
        try {
            // Load EQ Presets
            const presets = await db.getAllPresets();
            presets.forEach(p => {
                this.state.eqLibrary[p.id] = p;
                if (p.id > 40) this.state.eqPresets[p.id] = p.name;
            });
            console.log(`[DB] Loaded ${presets.length} presets from library.`);

            // Load System Settings
            const savedSettings = await db.getSetting('system_config');
            if (savedSettings) {
                this.state.settings = { ...this.state.settings, ...savedSettings };

                // CRITICAL: Always reset UI Lock on reboot
                this.state.settings.uiLocked = false;

                console.log(`[DB] System settings restored (UI Lock reset):`, this.state.settings);

                // Automatically apply loaded metering config
                this.meterConfig.ms = this.state.settings.meterInterval;
            }
        } catch (e) {
            console.error('[DB] Error loading library/settings:', e);
        }
    }

    async saveSystemSettings() {
        try {
            await db.saveSetting('system_config', this.state.settings);
            console.log('[DB] System settings saved.');
        } catch (e) {
            console.error('[DB] Error saving system settings:', e);
        }
    }

    startMetering(ms, start, count) {
        if (ms !== undefined) this.meterConfig.ms = ms;
        if (start !== undefined) this.meterConfig.start = start;
        if (count !== undefined) this.meterConfig.count = count;

        if (this.meterInterval) clearInterval(this.meterInterval);

        // Split into chunks of 16 to avoid SysEx buffer overflow
        // Request 1: Ch 1-16
        const req1 = [
            0xF0, 0x43, 0x30, 0x3E, 0x0D, 0x21, 0x00,
            0x00, 0x00, 0, 16, 0xF7
        ];

        // Request 2: Ch 17-32
        const req2 = [
            0xF0, 0x43, 0x30, 0x3E, 0x0D, 0x21, 0x00,
            0x00, 0x00, 16, 16, 0xF7 // Start at index 16 (Ch 17)
        ];

        const sendReq = () => {
            if (this.connected) {
                this.output.sendMessage(req1);
                // Tiny delay for second packet
                setTimeout(() => { if (this.connected) this.output.sendMessage(req2); }, 20);
            }
        };

        if (this.connected) {
            sendReq();
            console.log(`📊 Metering Active: Split Requests 1-16 & 17-32 (${this.meterConfig.ms}ms)`);
        }

        this.meterInterval = setInterval(sendReq, this.meterConfig.ms);
    }

    setMeterInterval(ms, range) {
        const safeMs = ms ? Math.max(1000, ms) : this.meterConfig.ms;
        const start = range ? range.start : this.meterConfig.start;
        const count = range ? range.count : this.meterConfig.count;

        this.state.settings.meterInterval = safeMs;
        this.saveSystemSettings();

        this.startMetering(safeMs, start, count);
    }

    setMeterOffset(val) {
        this.state.settings.meterOffset = val;
        this.saveSystemSettings();
        if (this.onStateChange) this.onStateChange(this.state);
    }

    setMeterBroadcastRate(val) {
        const safeVal = Math.max(1, Math.min(2000, val)); // Clamp to 1-2000ms
        this.state.settings.meterBroadcastRate = safeVal;
        this.saveSystemSettings();
        if (this.onStateChange) this.onStateChange(this.state);
    }

    setUIOption(key, val) {
        if (this.state.settings.hasOwnProperty(key)) {
            this.state.settings[key] = val;
            // Don't persist UI Lock to database to avoid being stuck after reboot
            if (key !== 'uiLocked') {
                this.saveSystemSettings();
            }
            if (this.onStateChange) this.onStateChange(this.state);
        }
    }

    connect() {
        try {
            const portCount = this.output.getPortCount();
            let actualPort = -1;
            for (let i = 0; i < portCount; i++) {
                if (this.output.getPortName(i).includes('YAMAHA 01V96 Port1')) {
                    actualPort = i; break;
                }
            }
            if (actualPort === -1) actualPort = this.portNumber;

            this.output.openPort(actualPort);
            this.input.openPort(actualPort);
            this.input.ignoreTypes(false, false, false);

            this.input.on('message', (deltaTime, message) => {
                if (this.onRawMidi) this.onRawMidi(message);
                this.handleMidiMessage(deltaTime, message);
            });

            this.connected = true;
            setTimeout(() => this.requestInitialState(), 500);
            this.startMetering(); // Sends immediately + sets interval
            return true;
        } catch (error) {
            console.error('Connection failed:', error.message);
            return false;
        }
    }

    async requestInitialState() {
        if (!this.connected) return;
        console.log('📥 Requesting EQ Library Names (Bulk Request)...');

        // Only use Bulk Request (0x20) - 0x10 and 0x30 are for changes/individual params
        const msgNames = [0xF0, 0x43, 0x20, 0x3E, 0x02, 0x02, 0xF7];
        this.output.sendMessage(msgNames);
    }

    handleMidiMessage(deltaTime, message) {
        if (!message || message.length < 3) return;

        if (this.onRawMidi) this.onRawMidi(message, false);

        const status = message[0];
        const data1 = message[1];
        const data2 = message[2];
        let changed = false;
        let meterChanged = false;

        // METER DATA PARSING (Universal for varied ranges)
        if (message[0] === 0xF0 && message[1] === 0x43 && message[5] === 0x21) {
            const startIdx = message[8]; // Extract starting channel from packet
            // Debug: Check packet size vs expected 32 channels (approx 75 bytes)
            // console.log(`[METER RAW] Len: ${message.length} Start: ${startIdx}`);

            const dataLen = (message.length - 11) / 2; // Data is between address and F7

            for (let i = 0; i < dataLen; i++) {
                const val = message[9 + (i * 2)];
                const chMapIdx = startIdx + i;
                if (this.state.channels[chMapIdx]) {
                    this.state.channels[chMapIdx].meter = val || 0;
                }
            }

            // Handle Master separately - usually at a high index or separate group
            // For now, we only update master if the packet is the "Full" 32-ch one or larger
            if (message.length > 100) {
                const masterL = message[9 + (48 * 2)] || 0;
                const masterR = message[9 + (49 * 2)] || 0;
                this.state.master.meter = Math.max(masterL, masterR);
            }
            meterChanged = true;
        }

        // DEBUG: Logging ALL Yamaha SysEx (3E and 7E)
        if (message[0] === 0xF0 && message[1] === 0x43) {
            const fs = require('fs');
            const logLine = message.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ') + '\n';
            try { fs.appendFileSync('dev/startup_log.txt', logLine); } catch (e) { }

            const ascii = message.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
            if (ascii.toLowerCase().includes('test')) {
                console.log(`\n🎯 SNIFFED "test" in SysEx: ${message.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
            }
        }

        // 2. OPTIMIZED SYSEX PARSING (The "Yellow" messages)
        if (message[0] === 0xF0 && message[1] === 0x43 && message[3] === 0x3E) {
            const fs = require('fs');
            const logLine = message.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ') + '\n';
            try { fs.appendFileSync('dev/startup_log.txt', logLine); } catch (e) { }

            const ascii = message.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
            if (ascii.toLowerCase().includes('test')) {
                console.log(`\n🎯 SNIFFED "test" in SysEx: ${message.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
            }

            // A: Parameter Changes (Element based)
            let markerPos = -1;
            if (message[4] === 0x7F && message[5] === 0x01) markerPos = 4;
            else if (message[5] === 0x7F && message[6] === 0x01) markerPos = 5;

            if (markerPos !== -1) {
                const head = markerPos + 2;
                const element = message[head];
                const p1 = message[head + 1];
                const p2 = message[head + 2];
                const f7Pos = message.indexOf(0xF7);

                if (f7Pos >= 12) {
                    const val14 = (message[f7Pos - 2] << 7) | message[f7Pos - 1];
                    const val7 = message[f7Pos - 1];

                    // --- Advanced Element Mapping ---
                    // 1C=Fader, 1A=Mute, 1B=Pan, 20=EQ, 1D=Att (Trim), 2B=AuxSend, 1E=Gate, 1F=Comp, 22=Routing
                    if ([0x1C, 0x1A, 0x1B, 0x20, 0x1D, 0x2B, 0x1E, 0x1F, 0x22].includes(element)) {
                        if (p2 >= 0 && p2 < 36) {
                            const ch = this.state.channels[p2];
                            switch (element) {
                                case 0x1C: ch.fader = val14; break;
                                case 0x1A: ch.mute = (val7 === 0); break;
                                case 0x1B: ch.pan = (message[f7Pos - 3] === 0x7F) ? (64 - (128 - val7)) : (64 + val7); break;
                                case 0x1D: // Attenuation (Signed 14-bit)
                                    const rawAtt = (message[f7Pos - 4] === 0x7F) ? -((0x7F - message[f7Pos - 2]) * 128 + (0x80 - message[f7Pos - 1])) : val14;
                                    ch.att = Math.round(((rawAtt + 960) / 1080) * 127);
                                    break;
                                case 0x22: // Routing (Bus, Stereo, Direct)
                                    if (p1 === 0x00) ch.routing.stereo = (val7 === 1);
                                    else if (p1 === 0x02) ch.routing.direct = (val7 === 1);
                                    else if (p1 >= 0x03 && p1 <= 0x0A) {
                                        ch.routing.bus[p1 - 0x03] = (val7 === 1);
                                    }
                                    break;
                                case 0x1E: // Gate (Dynamics 1)
                                    if (p1 === 0x01) ch.gate.on = (val7 === 1);
                                    else {
                                        const gm = { 0x04: 'thr', 0x05: 'range', 0x06: 'atk', 0x07: 'rel', 0x08: 'hold' }[p1];
                                        if (gm) ch.gate[gm] = val14;
                                    }
                                    break;
                                case 0x1F: // Comp (Dynamics 2)
                                    if (p1 === 0x01) ch.comp.on = (val7 === 1);
                                    else {
                                        const cm = { 0x04: 'thr', 0x05: 'rat', 0x06: 'atk', 0x07: 'rel', 0x08: 'knee', 0x09: 'gain' }[p1];
                                        if (cm) {
                                            let cv = val14;
                                            if (p1 === 0x09) { // Signed Gain
                                                cv = (message[f7Pos - 4] === 0x7F) ? -((0x7F - message[f7Pos - 2]) * 128 + (0x80 - message[f7Pos - 1])) : val14;
                                            }
                                            ch.comp[cm] = cv;
                                        }
                                    }
                                    break;
                                case 0x20:
                                    if (p1 === 0x0F) ch.eqOn = (val7 === 1);
                                    else if (p1 === 0x00) ch.eqType = val7;
                                    else {
                                        const m = {
                                            0x01: { b: 'low', p: 'q' }, 0x02: { b: 'low', p: 'freq' }, 0x03: { b: 'low', p: 'gain' },
                                            0x04: { b: 'high', p: 'gain' }, 0x05: { b: 'lmid', p: 'q' }, 0x06: { b: 'lmid', p: 'freq' },
                                            0x07: { b: 'lmid', p: 'gain' }, 0x08: { b: 'hmid', p: 'q' }, 0x09: { b: 'hmid', p: 'freq' },
                                            0x0A: { b: 'hmid', p: 'gain' }, 0x0B: { b: 'high', p: 'q' }, 0x0C: { b: 'high', p: 'freq' },
                                            0x0D: { b: 'high', p: 'gain' }
                                        }[p1];
                                        if (m && ch.eq) {
                                            let fv = val7;
                                            if (m.p === 'gain') {
                                                const rawG = (message[f7Pos - 4] === 0x7F) ? -((0x7F - message[f7Pos - 2]) * 128 + (0x80 - message[f7Pos - 1])) : val14;
                                                fv = Math.round(((rawG + 180) / 360) * 127);
                                            }
                                            if (!isNaN(fv)) {
                                                ch.eq[m.b][m.p] = fv;
                                                // Automatic DB consistency (If we are in "EDIT" we could save here too, 
                                                // but usually we only save on deliberate Store or Scan)
                                            }
                                        }
                                    }
                                    break;
                            }
                            changed = true;

                            // SMART: If this is channel 32 during a scan, we might want to trigger a DB save
                            // But usually we prefer the full sync check.
                        }
                    } else if (element === 0x4F) { this.state.master.fader = val14; changed = true; }
                    else if (element === 0x4D) { this.state.master.mute = (val7 === 0); changed = true; }
                    else {
                        // Discovery: Log unknown elements for Gate, Compressor, etc.
                        console.log(`🔍 DISCOVERY: Element: 0x${element.toString(16).toUpperCase()} P1: 0x${p1.toString(16).toUpperCase()} P2: 0x${p2.toString(16).toUpperCase()} Val: ${val14}`);
                    }
                }
            }

            // B: Hardware SELECTION & SOLO/CUE
            if (message[4] === 0x0D) {
                // Address 04 09 18 = Selection
                // We check for the specific length and pattern of a SEL message
                if (message[5] === 0x04 && message[6] === 0x09 && message[7] === 0x18 && message.length >= 12) {
                    const val = message[message.indexOf(0xF7) - 1];
                    if (val >= 0 && val <= 56) {
                        const newSel = (val === 56) ? 'master' : (val + 1);
                        if (this.state.selectedChannel !== newSel) {
                            console.log(`📡 Mixer HW Selection -> ${newSel}`);
                            this.state.selectedChannel = newSel;
                            changed = true;
                        }
                    }
                }
                // Address 03 2E = Solo/Cue
                if (message[5] === 0x03 && message[6] === 0x2E) {
                    const chIdx = message[8];
                    const val = message[message.indexOf(0xF7) - 1];
                    if (chIdx < 36 && this.state.channels[chIdx]) {
                        this.state.channels[chIdx].solo = (val === 1);
                        changed = true;
                    } else if (chIdx === 56) {
                        this.state.master.solo = (val === 1);
                        changed = true;
                    }
                }
            }

            // D: EQ Store Detection (Preset Name in Message!)
            // When mixer STORES a preset: F0 43 10 3E 7F 10 41 00 [ID] [NAME...] F7
            // The name is directly in the message as ASCII!
            if (message[0] === 0xF0 && message[1] === 0x43 &&
                (message[2] & 0xF0) === 0x10 &&
                message[3] === 0x3E && message[4] === 0x7F &&
                message[5] === 0x10 && message[6] === 0x41 && message[7] === 0x00 &&
                message.length >= 25) { // At least header + 16 chars name

                const presetId = message[8]; // 1-based ID
                let name = "";

                // Read ASCII name from byte 9 onwards (up to 16 chars)
                for (let i = 9; i < Math.min(25, message.length - 1); i++) {
                    const c = message[i];
                    if (c >= 32 && c < 127) name += String.fromCharCode(c);
                    else if (c === 0x20) name += " "; // Space
                }
                name = name.trim();

                console.log(`[STORE DETECTED] Preset #${presetId} stored as "${name}"`);

                // Store in both state and manager
                if (!this.state.eqPresets) this.state.eqPresets = {};
                this.state.eqPresets[presetId] = name;
                this.eqPresets.setPresets(this.state.eqPresets);

                this.emitEQPresets();
            }

            // E: EQ Recall Echo Detection (Mixer hardware changed preset)
            // F0 43 1X 3E 7F 10 01 00 [ID] 00 00 F7
            if (message[0] === 0xF0 && message[1] === 0x43 &&
                (message[2] & 0xF0) === 0x10 &&
                message[3] === 0x3E && message[4] === 0x7F &&
                message[5] === 0x10 && message[6] === 0x01 && message.length === 12) {

                const presetId = message[8];
                console.log(`📡 Mixer HW Recall Detected -> Preset #${presetId}`);

                // Smart Logic: Update UI from Cache if possible, skip requests
                this.recallEQ(this.state.selectedChannel, presetId, true);
            }

            // C: Bulk Dump Handling (Channel Names & EQ Lib)
            // LM signature check (Generic)
            if (message[0] === 0xF0 && message[1] === 0x43 && message[7] === 0x4C && message[8] === 0x4D) { // LM signature
                const typeHex = message[15].toString(16).toUpperCase();
                console.log(`[BULK] LM SysEx detected! Type: 0x${typeHex} (Q=51, R=52)`);
                this.handleBulkDump(message);
                changed = true;
            }
        }

        // 2. CC HANDLING (Fallback)
        if (status >= 0xB0 && status <= 0xBF && message[0] !== 0xF0) {
            // Processing for mutes/faders if user enables CC TX again...
            // (Optional, simplified for now)
        }

        // Separate callbacks for meters vs other state changes
        if (meterChanged && this.onMeterChange) this.onMeterChange(this.state);

        if (changed && this.onStateChange) {
            if (!this._stateThrottle) {
                this._stateThrottle = setTimeout(() => {
                    this.onStateChange(this.state);
                    this._stateThrottle = null;
                }, 100);
            }
        }
    }

    handleBulkDump(msg) {
        // Detect "LM  8C93 R" block (Remote/Names)
        const signature = String.fromCharCode(...msg.slice(7, 15));
        const type = msg[15];

        if (signature === "LM  8C93" && type === 0x52) { // 'R' block
            console.log('Bulk Dump Received: Analyzing Channel Names...');
            const rawData = [];
            // Remove Bit-Bytes (every 8th byte in Yamaha LM format)
            // Header is 20 bytes (0..19), actual data starts at 20.
            for (let i = 20; i < msg.length - 1; i++) {
                if ((i - 20) % 8 === 0) continue; // Skip bit-bytes
                rawData.push(msg[i]);
            }

            // Names start at internal offset 320 (0x140) in the "R" block. 
            // Yamaha interleaves characters: [All char 1s, All char 2s, ...]
            // Buffer size is usually 32 or 64 per char block.
            const BLOCK_SIZE = 32;
            const OFFSET = 320;

            for (let ch = 0; ch < BLOCK_SIZE; ch++) {
                let name = "";
                for (let charPos = 0; charPos < 8; charPos++) {
                    const idx = OFFSET + (charPos * BLOCK_SIZE) + ch;
                    const charCode = rawData[idx];
                    if (charCode > 32 && charCode < 127) {
                        name += String.fromCharCode(charCode);
                    }
                }

                if (name.trim().length > 0 && this.state.channels[ch]) {
                    this.state.channels[ch].name = name.trim();
                }
            }
            console.log(`Names updated from Mixer: ${this.state.channels.slice(0, 6).map(c => c.name).join(', ')}...`);
        }

        // Detect "LM  8C93 Q" block (EQ Library)
        if (signature === "LM  8C93" && type === 0x51) {
            console.log(`[BULK] + EQ Library block received (${msg.length} bytes)`);
            this.processEQNames(msg);
        } else {
            console.log(`[BULK] Signature: "${signature}", Type: 0x${type.toString(16)} (not EQ)`);
        }
    }

    processEQNames(msg) {
        // Delegate to eqPresets module
        const result = this.eqPresets.processEQNames(msg);
        if (result) {
            // Sync state from module to controller
            this.state.eqPresets = this.eqPresets.getPresets();
            this.emitEQPresets();
        }
    }

    emitEQPresets() {
        console.log('[EMIT] Sending eqPresets update to frontend...');
        if (this.onStateChange) {
            this.onStateChange({ eqPresets: this.state.eqPresets });
        } else {
            console.warn('[EMIT] No onStateChange callback registered!');
        }
    }

    setSelectedChannel(ch) {
        const newSel = (ch === 'master') ? 'master' : parseInt(ch, 10);
        if (this.state.selectedChannel !== newSel) {
            this.state.selectedChannel = newSel;
        }
    }

    setFader(channel, value) {
        if (!this.connected) return;

        // Fader data: mixer uses 4 bytes [D0 D1 D2 D3]
        // From observation: high 3 bits in D2, low 7 bits in D3
        const dataBytes = [
            0x00, 0x00,          // D0, D1
            (value >> 7) & 0x7F, // D2
            value & 0x7F         // D3
        ];

        let msg;
        if (channel === 'master') {
            msg = [0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x01, 0x4F, 0x00, 0x00, ...dataBytes, 0xF7];
        } else {
            const chInt = parseInt(channel, 10);
            msg = [0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x01, 0x1C, 0x00, chInt - 1, ...dataBytes, 0xF7];
        }

        this.output.sendMessage(msg);
        if (this.onRawMidi) this.onRawMidi(msg, true);

        // Update local state immediately
        if (channel === 'master') {
            this.state.master.fader = value;
        } else {
            const chIdx = parseInt(channel) - 1;
            if (this.state.channels[chIdx]) this.state.channels[chIdx].fader = value;
        }

        console.log(`🎚️ SetFader ${channel} -> ${value}`);
    }

    setMute(channel, isMuted) {
        if (!this.connected) return;

        // On/Off is usually 00 00 00 01 (On) or 00 00 00 00 (Muted)
        // Wait, Yamaha "On" button means NOT muted.
        const dataBytes = [0x00, 0x00, 0x00, isMuted ? 0 : 1];

        let msg;
        if (channel === 'master') {
            msg = [0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x01, 0x4D, 0x00, 0x00, ...dataBytes, 0xF7];
        } else {
            const chInt = parseInt(channel, 10);
            msg = [0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x01, 0x1A, 0x00, chInt - 1, ...dataBytes, 0xF7];
        }
        this.output.sendMessage(msg);
        if (this.onRawMidi) this.onRawMidi(msg, true);

        // Update local state immediately
        if (channel === 'master') {
            this.state.master.mute = isMuted;
        } else {
            const chIdx = parseInt(channel) - 1;
            if (this.state.channels[chIdx]) this.state.channels[chIdx].mute = isMuted;
        }

        console.log(`🔇 SetMute ${channel} -> ${isMuted}`);
    }

    setEQ(channel, band, type, value, silent = false) {
        if (!this.connected) return;

        const chIdx = parseInt(channel) - 1;

        // Corrected based on Logs: Q=1, Freq=2, Gain=3
        const paramMap = {
            'low': { q: 0x01, freq: 0x02, gain: 0x03 },
            'lmid': { q: 0x05, freq: 0x06, gain: 0x07 },
            'hmid': { q: 0x08, freq: 0x09, gain: 0x0A },
            'high': { q: 0x0B, freq: 0x0C, gain: 0x0D }
        };

        const p1 = paramMap[band]?.[type];
        if (p1 === undefined) {
            console.warn(`Unknown EQ param: ${band}.${type}`);
            return;
        }

        // Gain is signed (-180 to +180 for -18dB to +18dB)
        let dataBytes;
        if (type === 'gain') {
            // Map iPad 0-127 -> Mixer -180 to +180
            const mixerVal = Math.round(((value / 127) * 360) - 180);

            // Yamaha 4-byte 7-bit signed representation
            dataBytes = [
                (mixerVal < 0) ? 0x7F : 0x00,
                (mixerVal < 0) ? 0x7F : 0x00,
                (mixerVal >> 7) & 0x7F,
                mixerVal & 0x7F
            ];
        } else if (type === 'q') {
            // Rescale iPad (0-127) to Mixer (0-39 / 0x27h)
            const scaledQ = Math.round((value / 127) * 39);
            dataBytes = [0x00, 0x00, 0x00, scaledQ & 0x7F];
        } else {
            // Freq: Keep 0-127 for now
            dataBytes = [0x00, 0x00, 0x00, value & 0x7F];
        }

        const msg = [0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x01, 0x20, p1, chIdx, ...dataBytes, 0xF7];
        this.output.sendMessage(msg);
        if (this.onRawMidi) this.onRawMidi(msg, true);

        // Update local state immediately
        const channelIdx = parseInt(channel) - 1;
        if (this.state.channels[channelIdx] && this.state.channels[channelIdx].eq[band]) {
            this.state.channels[channelIdx].eq[band][type] = value;
            if (!silent && this.onStateChange) this.onStateChange(this.state);
        }

        console.log(`🎛️ EQ ${channel} ${band}.${type} -> ${value}`);
    }

    setPan(channel, value) {
        if (!this.connected) return;

        const mixerVal = value - 64;
        const chIdx = parseInt(channel) - 1;

        let dataBytes = [0x00, 0x00, 0x00, mixerVal & 0x7F];
        if (mixerVal < 0) {
            dataBytes = [0x7F, 0x7F, 0x7F, (128 + mixerVal) & 0x7F];
        }

        const msg = [0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x01, 0x1B, 0x00, chIdx, ...dataBytes, 0xF7];
        this.output.sendMessage(msg);
        if (this.onRawMidi) this.onRawMidi(msg, true);

        // Update local state immediately
        if (this.state.channels[chIdx]) {
            this.state.channels[chIdx].pan = value;
        }

        console.log(`↔️ Pan ${channel} -> ${mixerVal}`);
    }

    setEQOn(channel, isOn) {
        if (!this.connected) return;
        const chIdx = (channel === 'master') ? 56 : (parseInt(channel) - 1);

        const msg = [0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x01, 0x20, 0x0F, chIdx, 0x00, 0x00, 0x00, isOn ? 1 : 0, 0xF7];
        this.output.sendMessage(msg);
        if (this.onRawMidi) this.onRawMidi(msg, true);

        // Update local state immediately
        if (channel === 'master') {
            this.state.master.eqOn = isOn; // Assuming master has eqOn too
        } else {
            const chIdx_ = parseInt(channel) - 1;
            if (this.state.channels[chIdx_]) this.state.channels[chIdx_].eqOn = isOn;
        }

        console.log(`🔌 EQ ON/OFF ${channel} -> ${isOn}`);
    }

    setAttenuation(channel, value) {
        if (!this.connected) return;
        const chIdx = (channel === 'master') ? 56 : (parseInt(channel) - 1);

        // Map UI (0-127) to Mixer Signed Decibels (-960 to +120)
        // 0.1dB steps. -96.0dB = -960, +12.0dB = +120
        const mixerVal = Math.round((value / 127) * 1080) - 960;

        let d2, d3;
        if (mixerVal >= 0) {
            d2 = (mixerVal >> 7) & 0x7F;
            d3 = mixerVal & 0x7F;
            const msg = [0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x01, 0x1D, 0x00, chIdx, 0x00, 0x00, d2, d3, 0xF7];
            this.output.sendMessage(msg);
        } else {
            // Negative value encoding (7F 7F D2 D3)
            const absVal = Math.abs(mixerVal);
            d2 = 127 - Math.floor((absVal - 1) / 128);
            d3 = 128 - ((absVal - 1) % 128 + 1);
            const msg = [0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x01, 0x1D, 0x00, chIdx, 0x7F, 0x7F, d2, d3, 0xF7];
            this.output.sendMessage(msg);
        }

        // Update local state immediately
        const channelIdx_ = (channel === 'master') ? 'master' : (parseInt(channel) - 1);
        if (channelIdx_ !== 'master' && this.state.channels[channelIdx_]) {
            this.state.channels[channelIdx_].att = value;
        }

        console.log(`📉 Attenuation ${channel} -> ${mixerVal / 10} dB (Mixer Raw: ${mixerVal})`);
    }

    setEQType(channel, type) {
        if (!this.connected) return;
        const chIdx = (channel === 'master') ? 56 : (parseInt(channel) - 1);
        const msg = [0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x01, 0x20, 0x00, chIdx, 0x00, 0x00, 0x00, type, 0xF7];
        this.output.sendMessage(msg);
        if (this.onRawMidi) this.onRawMidi(msg, true);

        // Update local state immediately
        const chIdx_ = (channel === 'master') ? 'master' : (parseInt(channel) - 1);
        if (chIdx_ === 'master') {
            // master eq type not tracked?
        } else if (this.state.channels[chIdx_]) {
            this.state.channels[chIdx_].eqType = type;
        }

        console.log(`🎚️ EQ Type ${channel} -> ${type}`);
    }

    setSelectedChannel(channel) {
        if (!this.connected) return;

        // Value: 0-31 for channels, 56 (0x38) for Master
        const val = (channel === 'master') ? 56 : (parseInt(channel) - 1);
        const msg = [0xF0, 0x43, 0x10, 0x3E, 0x0D, 0x04, 0x09, 0x18, 0x00, 0x00, 0x00, 0x00, val, 0xF7];

        this.output.sendMessage(msg);
        if (this.onRawMidi) this.onRawMidi(msg, true);

        console.log(`🔵 SEL Channel -> ${channel} (Valve: ${val})`);
    }

    resetEQ(channel) {
        if (!this.connected) return;

        // Reference Neutral Values (iPad Units 0-127)
        // Gain: 64 (0dB), Q: 115 (~1.0), Freqs: Standard bands
        const neutralSettings = [
            { band: 'low', q: 115, f: 23, g: 64 },
            { band: 'lmid', q: 115, f: 46, g: 64 },
            { band: 'hmid', q: 115, f: 79, g: 64 },
            { band: 'high', q: 115, f: 114, g: 64 }
        ];

        console.log(`🧹 Setting NEUTRAL EQ for Channel ${channel}...`);

        (async () => {
            for (const s of neutralSettings) {
                this.setEQ(channel, s.band, 'q', s.q, true);
                await new Promise(r => setTimeout(r, 40));
                this.setEQ(channel, s.band, 'freq', s.f, true);
                await new Promise(r => setTimeout(r, 40));
                this.setEQ(channel, s.band, 'gain', s.g, true);
                await new Promise(r => setTimeout(r, 40));
            }
            // Push final state update after all changes
            if (this.onStateChange) this.onStateChange(this.state);
        })();
    }

    recallEQ(channel, pIdx, skipMidi = false) {
        if (!this.connected) return;

        const presetIdx = parseInt(pIdx);
        const hasCache = !!this.state.eqLibrary[presetIdx];

        // 1. Instant UI update from DB if available (Smart Cache)
        if (hasCache) {
            const presetBody = this.state.eqLibrary[presetIdx];
            const chIdx = channel - 1;
            const ch = this.state.channels[chIdx];
            if (ch) {
                ch.eqType = presetBody.type;
                ch.att = presetBody.att;
                ch.eq = JSON.parse(JSON.stringify(presetBody.eq));
                console.log(`[DB] Instant UI recall applied for Preset #${presetIdx}`);
            }
        }

        // 2. Tell the mixer to switch (Always needed for audio)
        if (!skipMidi) {
            this.eqPresets.recallEQ(channel, presetIdx);
        }

        // 3. Request Logic (The "Spam Filter")
        // If we have it in Cache, we updated the UI in step 1 and the mixer is switching.
        // We skip verification to enable "Zero-Latency" switching for BOTH Factory and User presets.
        if (hasCache) {
            console.log(`[DB] Preset #${presetIdx} is cached - skipping verification sync.`);
            if (this.onStateChange) this.onStateChange(this.state);
            return;
        }

        // 4. Verification Sync (Only for unknown presets)
        console.log(`[DB] Unknown Preset #${presetIdx} - Triggering discovery sync...`);
        if (this.onSyncStatus) this.onSyncStatus('start-eq');

        // Give the mixer enough time to load the preset into its DSP (600ms is usually safe)
        setTimeout(async () => {
            console.log(`[SYNC] Fetching parameters for Preset #${presetIdx} on Ch ${channel}`);
            await this.syncEQForChannel(channel);

            // Save new discovery to DB
            const chIdx = channel - 1;
            const ch = this.state.channels[chIdx];
            if (ch) {
                const presetData = {
                    id: presetIdx,
                    name: this.state.eqPresets[presetIdx] || `PRESET ${presetIdx}`,
                    type: ch.eqType,
                    att: ch.att,
                    eq: JSON.parse(JSON.stringify(ch.eq))
                };
                await db.savePreset(presetData);
                this.state.eqLibrary[presetIdx] = presetData;
                console.log(`[DB] Learned and cached Preset #${presetIdx} to library.`);
            }
            if (this.onStateChange) this.onStateChange(this.state);
            if (this.onSyncStatus) this.onSyncStatus('end-eq');
        }, 800);
    }

    async syncEQForChannel(channel) {
        if (!this.connected) return;
        const chIdx = channel - 1;
        console.log(`[SYNC] Requesting EQ Parameters for Channel ${channel}...`);

        const eqElements = [
            { id: 0x20, p1: 0x00 }, // EQ Type
            { id: 0x20, p1: 0x0F }, // EQ Toggle
            { id: 0x1D, p1: 0x00 }, // Attenuation
        ];
        // 12 EQ Params (Q, Freq, Gain x 4 bands)
        for (let p = 1; p <= 13; p++) {
            eqElements.push({ id: 0x20, p1: p });
        }

        for (const el of eqElements) {
            const msg = [0xF0, 0x43, 0x30, 0x3E, 0x7F, 0x01, el.id, el.p1, chIdx, 0xF7];
            this.output.sendMessage(msg);
            await new Promise(r => setTimeout(r, 15)); // Fast sync for just one channel
        }

        console.log(`[SYNC] EQ for Channel ${channel} complete.`);
        if (this.onSyncStatus) this.onSyncStatus('end-eq');
    }

    async saveEQ(channel, presetIdx, name) {
        if (!this.connected) return;

        // 1. Save to mixer
        this.eqPresets.saveEQ(channel, presetIdx, name);

        // 2. Sync state locally
        this.state.eqPresets[presetIdx] = name;

        // 3. Save to DB (Full parameters of the source channel)
        const ch = this.state.channels[channel - 1];
        if (ch) {
            const presetData = {
                id: presetIdx,
                name: name,
                type: ch.eqType,
                att: ch.att,
                eq: JSON.parse(JSON.stringify(ch.eq))
            };
            await db.savePreset(presetData);
            this.state.eqLibrary[presetIdx] = presetData;
            console.log(`[DB] Saved user preset #${presetIdx} "${name}" to library.`);
        }

        if (this.onStateChange) this.onStateChange(this.state);
    }

    async deepSync() {
        if (!this.connected) return;
        console.log('Starting Full Deep Sync...');
        if (this.onSyncStatus) this.onSyncStatus('start');

        // Request Names (Bulk R)
        this.output.sendMessage([0xF0, 0x43, 0x20, 0x3E, 0x0E, 0x00, 0xF7]);
        await new Promise(r => setTimeout(r, 200));

        // Request EQ Library Names (Bulk Q)
        console.log('Requesting EQ Library Bulk...');
        this.output.sendMessage([0xF0, 0x43, 0x20, 0x3E, 0x0E, 0x02, 0xF7]);
        await new Promise(r => setTimeout(r, 200));

        const elements = [
            { id: 0x1C, name: 'Fader', count: 32, p1: 0x00 },
            { id: 0x1A, name: 'Mute', count: 32, p1: 0x00 },
            { id: 0x1B, name: 'Pan', count: 32, p1: 0x00 },
            { id: 0x1D, name: 'Att', count: 32, p1: 0x00 }, // Attenuation
            { id: 0x20, name: 'EQType', count: 32, p1: 0x00 }, // EQ Type 1/2
            { id: 0x20, name: 'EQToggle', count: 32, p1: 0x0F }, // EQ On/Off
        ];

        // Add all 12 EQ Parameters per channel
        for (let p = 1; p <= 12; p++) {
            elements.push({ id: 0x20, name: `EQ_P${p}`, count: 32, p1: p });
        }

        // Add Masters
        elements.push({ id: 0x4F, name: 'MasterFader', count: 1, p1: 0x00 });
        elements.push({ id: 0x4D, name: 'MasterMute', count: 1, p1: 0x00 });

        for (const el of elements) {
            for (let i = 0; i < el.count; i++) {
                const msg = [0xF0, 0x43, 0x30, 0x3E, 0x7F, 0x01, el.id, el.p1, i, 0xF7];
                this.output.sendMessage(msg);
                await new Promise(r => setTimeout(r, 50)); // Increased to 50ms for reliability
            }
        }

        console.log("Deep Sync Complete");
        if (this.onSyncStatus) this.onSyncStatus('end');
    }

    async scanPresets() {
        if (!this.connected) return;
        console.log('========================================');
        console.log('[SCAN] Starting Full Library Sync to DB...');
        console.log('[SCAN] This will capture all EQ parameters for 128 presets.');
        console.log('========================================');

        const SCAN_CHANNEL = 32; // Use CH32 as scratchpad
        let count = 0;

        for (let presetId = 1; presetId <= 128; presetId++) {
            console.log(`[SCAN] Processing Preset #${presetId}/128...`);

            // 1. Recall on CH32
            this.eqPresets.recallEQ(SCAN_CHANNEL, presetId);

            // 2. Wait for Recall (Mixer delay)
            await new Promise(r => setTimeout(r, 600));

            // 3. Sync EQ for this channel
            await this.syncEQForChannel(SCAN_CHANNEL);

            // 4. Extract data and save to DB
            const ch = this.state.channels[SCAN_CHANNEL - 1];
            if (ch) {
                const name = this.state.eqPresets[presetId] || `PRESET ${presetId}`;
                const presetData = {
                    id: presetId,
                    name: name,
                    type: ch.eqType,
                    att: ch.att,
                    eq: ch.eq
                };
                await db.savePreset(presetData);
                this.state.eqLibrary[presetId] = presetData;
                count++;
            }

            // Small breather
            await new Promise(r => setTimeout(r, 50));
        }

        console.log('========================================');
        console.log(`[SCAN] Complete! Saved ${count} presets to SQLite DB.`);
        console.log('========================================');
    }

    disconnect() {
        if (this.meterInterval) clearInterval(this.meterInterval);
        if (this.connected) {
            this.output.closePort();
            this.input.closePort();
            this.connected = false;
        }
    }
}

module.exports = Yamaha01V96Controller;
