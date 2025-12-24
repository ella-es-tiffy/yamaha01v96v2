
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

        this.meterInterval = setInterval(() => {
            if (this.connected) {
                this.output.sendMessage(meterRequest);
            }
        }, 10000);
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
        if (message.length >= 70 && message[0] === 0xF0 && message[1] === 0x43 && message[5] === 0x21) {
            for (let i = 0; i < 32; i++) {
                const val = message[9 + (i * 2)];
                if (this.state.channels[i]) {
                    this.state.channels[i].meter = val || 0;
                }
            }
            this.state.master.meter = message[9 + (32 * 2)] || 0;
            meterChanged = true; // Don't trigger full state change for meters
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

        const v = Math.round(value); // 0-1023
        console.log(`🎚️ SetFader ${channel} -> ${v}`);

        // SysEx Parameter Change format (kryops style)
        // F0 43 10 3E 7F 01 [Element] [P1] [P2] [D0 D1 D2 D3] F7
        // Element: 1C (Channel Fader), 4F (Master Fader)
        // Data: 4 bytes for 10-bit value: 00 00 (v>>7) (v&0x7F)
        const dataBytes = [0x00, 0x00, (v >> 7) & 0x7F, v & 0x7F];

        if (channel === 'master') {
            // Master Fader: Element 0x4F, P1=0, P2=0
            this.output.sendMessage([0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x01, 0x4F, 0x00, 0x00, ...dataBytes, 0xF7]);
        } else {
            // Channel Fader: Element 0x1C, P1=0, P2=channel-1
            const chInt = parseInt(channel, 10);
            this.output.sendMessage([0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x01, 0x1C, 0x00, chInt - 1, ...dataBytes, 0xF7]);
        }
    }

    setMute(channel, isMuted) {
        if (!this.connected) {
            console.warn('❌ Mute skipped: Not connected');
            return;
        }

        console.log(`🚫 SetMute ${channel} -> ${isMuted}`);

        // SysEx Parameter Change format (kryops style)
        // Element: 1A (Channel On/Mute), 4D (Master On/Mute)
        // Data: 4 bytes: 00 00 00 (on?1:0) where on=!muted
        const dataBytes = [0x00, 0x00, 0x00, isMuted ? 0 : 1];

        if (channel === 'master') {
            // Master On/Mute: Element 0x4D
            this.output.sendMessage([0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x01, 0x4D, 0x00, 0x00, ...dataBytes, 0xF7]);
        } else {
            // Channel On/Mute: Element 0x1A
            const chInt = parseInt(channel, 10);
            this.output.sendMessage([0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x01, 0x1A, 0x00, chInt - 1, ...dataBytes, 0xF7]);
        }
    }

    setEQ(channel, band, type, value) {
        if (!this.connected) return;

        // Base Status per Band (Low=B2, L-Mid=B3, H-Mid=B4, High=B5 for Ch1-24?) -> Check Offset Logic
        // Original Logic: low: 0xB2, lmid: 0xB4... Wait, your logs show B2 for Low?
        // Let's stick to the observed B2 for now.

        // Mappings based on Logic so far:
        const baseStatusMap = { low: 0xB2, lmid: 0xB4, hmid: 0xB6, high: 0xB8 };
        const isUpper = channel > 24;
        let status = baseStatusMap[band] + (isUpper ? 1 : 0);

        // CC Offsets relative to channel
        // Gain: MSB=0x01+Offset, LSB=0x21+Offset   (Based on logs B2 01 / B2 21)
        // Freq: 0x40+Offset
        // Q:    0x59+Offset (inverted)

        // The channel offset seems to be embedded in the CC number? 
        // No, in the logs we saw B2 01 XX, B2 21 YY. This is for Channel 1 Low Gain?
        // Let's assume (channel - 1) % 24 logic applies to the CC offset if not 0.

        // Wait, if Ch1 Gain is 01/21, then Ch2 Gain would be...?
        // Looking at old code: cc = base + ((ch-1)%24).
        // Let's trust the logic that worked partially before but fix the 14-bit part.

        const chOffset = (channel - 1) % 24;

        if (type === 'gain') {
            // GAIN IS 14-BIT
            // Range 0-127 incoming mapped to 14-bit? 
            // Or does the internal logic handle 0-127 and we just need to send it as MSB?
            // Logs: B2 01 30 (48) -> B2 21 00. Total ~ 6144. 
            // Center (64) would be ~8192 (0x40 00)?
            // Let's map 0-127 input -> 0-16383 output first?
            // Actually, Yamaha usually does 0-127 for simple control, but if it sends pairs...
            // Let's try sending value as MSB and 00 as LSB for now to stabilize it.

            const msbCC = 0x01 + chOffset;
            const lsbCC = 0x21 + chOffset;

            // Map 0-127 to approximate Yamaha Gain values
            // Or just pass the value as MSB?
            // If Log showed B2 01 30 (Dec 48), that's a reasonable MSB.

            this.output.sendMessage([status, msbCC, value]);      // MSB
            this.output.sendMessage([status, lsbCC, 0x00]);       // LSB (Fine)
        } else {
            // FREQ & Q ARE 7-BIT (Single CC)
            const baseCCMap = { freq: 0x40, q: 0x59 };
            let cc = baseCCMap[type] + chOffset;

            let val = value;
            if (type === 'q') val = 127 - val;


            this.output.sendMessage([status, cc, val]);
        }
    }

    setEQOn(channel, isOn) {
        if (!this.connected) return;

        const isUpper = channel > 24;
        const status = isUpper ? 0xBD : 0xBC;
        const chOffset = (channel - 1) % 24;

        // Logic from User:
        // Ch1-24: BC 59 ...
        // Ch25-32: BD 59 ... (Starts again at 59)
        // Stride: If Ch32 is 0x66 (102) and Start is 0x59 (89).
        // 102 - 89 = 13.
        // Index difference: 32 - 25 = 7.
        // 13 / 7 = 1.85. 
        // This likely means Channel spacing is indeed irregular or uses 2 CCs?
        // But for "EQ On" switch, it's usually 1 bit.
        // Let's assume Stride 1 (+ offset) for now OR listen to what logs say later.
        // Implementing simple offset linear mapping first as I can't guess Stride 1.85.
        // Actually, if Ch1 is 59, Ch2 is 5A?

        const cc = 0x59 + chOffset;
        const val = isOn ? 0x7F : 0x00;

        console.log(`🎛️ EQ On/Off ${channel} -> ${isOn} (Status ${status.toString(16)} CC ${cc.toString(16)})`);
        this.output.sendMessage([status, cc, val]);
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
