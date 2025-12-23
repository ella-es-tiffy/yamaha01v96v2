
const midi = require('midi');

const out1 = new midi.Output();
out1.openPort(0); // Port 1
const out2 = new midi.Output();
out2.openPort(1); // Port 2

const input = new midi.Input();
input.openPort(0);
input.ignoreTypes(false, false, false);

console.log('=== YAMAHA 01V96 - CLOCK & SYSEX PROBE ===');

input.on('message', (delta, msg) => {
    if (msg[0] === 0xFE || msg[0] === 0xF8) return;
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    if (hex.includes('0D 7F F7')) return;
    console.log(`[RECV] ${hex}`);
});

// Send MIDI CLOCK periodically (simulate heart)
setInterval(() => {
    out1.sendMessage([0xF8]);
    out2.sendMessage([0xF8]);
}, 40); // 24 pulses per quarter note at 60bpm is about 40ms

// Send Meter Request
setInterval(() => {
    out1.sendMessage([0xF0, 0x43, 0x10, 0x3E, 0x0F, 0x01, 0x01, 0xF7]);
    out2.sendMessage([0xF0, 0x43, 0x10, 0x3E, 0x0F, 0x01, 0x01, 0xF7]);
}, 2000);

setInterval(() => { }, 1000);
