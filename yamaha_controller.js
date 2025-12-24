
const midi = require('midi');

class Yamaha01V96Controller {
    constructor(portNumber = 0) {
        this.input = new midi.Input();
        this.output = new midi.Output();
        this.portNumber = portNumber;
        this.connected = false;
        this.onStateChange = null;
        this.onRawMidi = null;

        this.state = {
            selectedChannel: 1,
            channels: Array(32).fill(null).map((_, i) => ({
                number: i + 1,
                fader: 0,
                mute: false,
                eq: {
                    low: { gain: 64, freq: 64, q: 64 },
                    lmid: { gain: 64, freq: 64, q: 64 },
                    hmid: { gain: 64, freq: 64, q: 64 },
                    high: { gain: 64, freq: 64, q: 64 }
                }
            })),
            master: { fader: 0, mute: false }
        };
    }

    startMetering() {
        if (this.meterInterval) clearInterval(this.meterInterval);

        const meterRequest = [0xF0, 0x43, 0x30, 0x3E, 0x0D, 0x21, 0x00, 0x00, 0x00, 0x00, 32, 0xF7];

        if (this.connected) {
            this.output.sendMessage(meterRequest);
            console.log('📊 Sent initial Remote Meter Request');
        }

        // Increased to 30s for stability (kryops used 10s, but causes freezes)
        this.meterInterval = setInterval(() => {
            if (this.connected) {
                this.output.sendMessage(meterRequest);
            }
        }, 30000);
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
        console.log('📥 Skipping Deep Sync - Mixer does not respond to parameter requests');
        // The 01V96 does not respond to parameter request SysEx messages.
        // It only sends live updates when controls are physically moved.
        // Therefore, initial sync is not possible via MIDI.
        // Faders will update as soon as they are moved on the mixer.
    }

    handleMidiMessage(deltaTime, message) {
        if (!message || message.length < 3) return;

        const status = message[0];
        const data1 = message[1];
        const data2 = message[2];
        let changed = false;
        let meterChanged = false;

        // METER DATA PARSING
        // Accepts both device IDs (43 10 and 43 30)
        // message[5] == 0x21, length >= 70
        // Data at index 9 with stride 2
        // Structure: 32 channels, then 8 bus, 8 aux, then stereo master L/R
        if (message.length >= 70 && message[0] === 0xF0 && message[1] === 0x43 && message[5] === 0x21) {
            // Parse 32 channel meters
            for (let i = 0; i < 32; i++) {
                const val = message[9 + (i * 2)];
                if (this.state.channels[i]) {
                    this.state.channels[i].meter = val || 0;
                }
            }

            // Master L/R is after: 32 channels + 8 bus + 8 aux = 48 meters
            // Position: 9 + (48 * 2) = 105 for L, 107 for R
            const masterL = message[9 + (48 * 2)] || 0;
            const masterR = message[9 + (49 * 2)] || 0;

            // Use average or max for single master meter
            this.state.master.meter = Math.max(masterL, masterR);
            this.state.master.meterL = masterL;
            this.state.master.meterR = masterR;

            meterChanged = true;
        }


        // 1. LIVE CC HANDLING
        const bandBaseMap = {
            0xB2: 'low', 0xB3: 'low', 0xB4: 'lmid', 0xB5: 'lmid',
            0xB6: 'hmid', 0xB7: 'hmid', 0xB8: 'high', 0xB9: 'high',
            0xBC: 'low', 0xBD: 'low'
        };

        if (bandBaseMap[status]) {
            const band = bandBaseMap[status];
            let type = ''; let chOffset = -1;
            if (data1 >= 0x21 && data1 <= 0x38) { type = 'gain'; chOffset = data1 - 0x21; }
            else if (data1 >= 0x40 && data1 <= 0x57) { type = 'freq'; chOffset = data1 - 0x40; }
            else if (data1 >= 0x59 && data1 <= 0x70) { type = 'q'; chOffset = data1 - 0x59; }

            if (status === 0xBC) chOffset = data1 - 0x21;
            if (status === 0xBD) chOffset = (data1 - 0x21) + 24;

            if (chOffset >= 0 && chOffset < 32) {
                const val = (type === 'q' ? 127 - data2 : data2);
                this.state.channels[chOffset].eq[band][type] = val;
                changed = true;
            }
        }

        // 2. SYSEX SYNC HANDLING (Answers to Requests)
        // Format: [F0 43 1n 3E 7F 01 Area AddrH AddrM AddrL ... Val ... F7]
        if (message[0] === 0xF0 && message[1] === 0x43 && message[3] === 0x3E) {
            const area = message[6];
            const addrH = message[7];
            const addrM = message[8];
            const addrL = message[9];

            let val = 0;
            if (message.length === 13) {
                // 14-bit value: [ValH ValL]
                val = (message[10] << 7) | message[11];
            } else if (message.length === 12) {
                // 7-bit value: [Val]
                val = message[10];
            }

            // Input Channels (Area 0x01)
            if (area === 0x01) {
                const chIdx = addrM;
                if (chIdx >= 0 && chIdx < 32) {
                    const ch = this.state.channels[chIdx];
                    if (addrL === 0x1C) { ch.fader = val; changed = true; }
                    else if (addrL === 0x1A) { ch.mute = (val === 0); changed = true; }
                    else if (addrL >= 0x00 && addrL <= 0x0F) {
                        const bandIdx = Math.floor(addrL / 4);
                        const paramIdx = addrL % 4;
                        const bands = ['high', 'hmid', 'lmid', 'low'];
                        const types = ['gain', 'freq', 'q', 'mode'];
                        const band = bands[bandIdx];
                        const type = types[paramIdx];

                        if (type !== 'mode' && band) {
                            let fVal = val & 0x7F;
                            if (type === 'q') fVal = 127 - fVal;
                            ch.eq[band][type] = fVal;
                            changed = true;
                        }
                    } else if (addrL === 0x0F) { // EQ On/Off
                        ch.eqOn = (val === 1);
                        changed = true;
                    }
                }
            }
            // Master (Area 0x00)
            else if (area === 0x00) {
                if (addrH === 0x4F) { this.state.master.fader = val; changed = true; }
                else if (addrH === 0x4D) { this.state.master.mute = (val === 0); changed = true; }
            }
        }

        // Separate callbacks for meters vs other state changes
        if (meterChanged && this.onMeterChange) {
            this.onMeterChange(this.state);
        }

        if (changed && this.onStateChange) {
            this.onStateChange(this.state);
        }
    }

    setFader(channel, value) {
        if (!this.connected) {
            console.warn('❌ Fader skipped: Not connected');
            return;
        }

        if (!this.connected) return;

        // Fader data: mixer uses 4 bytes
        const dataBytes = [
            (value >> 7) & 0x07, // High bits (usually very small for 10-bit)
            (value >> 0) & 0x7F, // Middle bits
            0x00, 0x00           // Padding
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
        console.log(`🔇 SetMute ${channel} -> ${isMuted}`);
    }

    setEQ(channel, band, type, value) {
        if (!this.connected) return;

        const chIdx = parseInt(channel) - 1;

        // Corrected based on Logs: Q=1, Freq=2, Gain=3
        const paramMap = {
            'low': { q: 0x01, freq: 0x02, gain: 0x03 },
            'lmid': { q: 0x04, freq: 0x05, gain: 0x06 },
            'hmid': { q: 0x07, freq: 0x08, gain: 0x09 },
            'high': { q: 0x0A, freq: 0x0B, gain: 0x0C }
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
        console.log(`↔️ Pan ${channel} -> ${mixerVal}`);
    }

    setEQOn(channel, isOn) {
        if (!this.connected) return;
        const chIdx = parseInt(channel) - 1;

        const msg = [0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x01, 0x20, 0x0F, chIdx, 0x00, 0x00, 0x00, isOn ? 1 : 0, 0xF7];
        this.output.sendMessage(msg);
        if (this.onRawMidi) this.onRawMidi(msg, true);

        console.log(`🔌 EQ ON/OFF ${channel} -> ${isOn}`);
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
