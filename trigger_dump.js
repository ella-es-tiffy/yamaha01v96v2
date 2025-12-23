const midi = require('midi');

const input = new midi.Input();
const output = new midi.Output();

let port = -1;
for (let i = 0; i < input.getPortCount(); i++) {
    if (input.getPortName(i).includes('Port1')) port = i;
}

if (port === -1) {
    console.log('❌ Port 1 nicht gefunden');
    process.exit(1);
}

input.openPort(port);
output.openPort(port);
input.ignoreTypes(false, false, false);

console.log('🔬 PARAMETER REQUEST SCANNER - Testing Message Lengths...');

input.on('message', (delta, msg) => {
    // Wenn 0x1C (Fader) zurückkommt, haben wir gewonnen!
    // Pattern F0 43 10 3E 7F 01 1C ...
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    if (hex.includes('F0 43 10 3E') && hex.includes('1C')) {
        console.log(`\n🎉 SUCCESS! Response Received: ${hex}`);
    } else if (msg[0] !== 0xFE && msg[0] !== 0xF8) {
        console.log(`[Response] ${hex}`);
    }
});

// Wir testen Request auf Fader Channel 1 (Index 0)
// Basis Header: F0 43 30 3E 7F 01 1C 00 00
const base = [0xF0, 0x43, 0x30, 0x3E, 0x7F, 0x01, 0x1C, 0x00, 0x00];

const variants = [
    [...base, 0xF7], // Ohne Value
    [...base, 0x00, 0xF7], // 1 Byte Padding
    [...base, 0x00, 0x00, 0xF7], // 2 Byte Padding (Standard?)
    [...base, 0x00, 0x00, 0x00, 0xF7], // 3 Byte Padding
    [...base, 0x00, 0x00, 0x00, 0x00, 0xF7], // 4 Byte Padding
];

let idx = 0;

setInterval(() => {
    if (idx >= variants.length) {
        console.log('\n🏁 Alle Varianten getestet.');
        process.exit(0);
    }

    const msg = variants[idx];
    console.log(`\n🔫 [Var ${idx + 1}] Length ${msg.length}: ${msg.map(b => b.toString(16)).join(' ')}`);
    output.sendMessage(msg);
    idx++;

}, 2000);
