
const midi = require('midi');
const input = new midi.Input();
const output = new midi.Output();
const portCount = input.getPortCount();
let yamahaPort = -1;
for (let i = 0; i < portCount; i++) {
    if (input.getPortName(i).includes('YAMAHA') && input.getPortName(i).includes('Port1')) {
        yamahaPort = i; break;
    }
}
if (yamahaPort === -1) process.exit(1);
input.openPort(yamahaPort);
output.openPort(yamahaPort);
input.ignoreTypes(false, false, false);

console.log('=== YAMAHA 01V96 - BROADCAST METER REQUEST ===');

input.on('message', (delta, msg) => {
    if (msg[0] === 0xFE) return;
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    if (msg[4] !== 0x0D && msg[4] !== 0x7F) {
        console.log(`[RECV] CMD=0x${msg[4].toString(16).toUpperCase()} DATA=${hex}`);
    }
});

// Try Broadcasting Meter Request (Device ID 0x30 = All)
// Request Type 01 (Input 1-16) and Type 05 (Input 1-32 / All)
const reqs = [
    [0xF0, 0x43, 0x30, 0x3E, 0x0F, 0x01, 0x01, 0xF7],
    [0xF0, 0x43, 0x10, 0x3E, 0x21, 0x01, 0x01, 0xF7], // Version 2 style?
    [0xF0, 0x43, 0x10, 0x3E, 0x0C, 0x00, 0xF7],       // Mode Request
];

let idx = 0;
setInterval(() => {
    console.log(`Sending ${reqs[idx].map(b => b.toString(16).toUpperCase()).join(' ')}`);
    output.sendMessage(reqs[idx]);
    idx = (idx + 1) % reqs.length;
}, 1000);
