
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

console.log('=== YAMAHA 01V96 - LONG MESSAGE PROBE ===');

input.on('message', (delta, msg) => {
    if (msg[0] === 0xFE) return;
    if (msg.length > 10) {
        const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
        console.log(`\n💎 LONG MESSAGE DETECTED (${msg.length} bytes):`);
        console.log(hex);
    }
});

// Try Common "Start Metering" Commands
const probes = [
    [0xF0, 0x43, 0x10, 0x3E, 0x0F, 0x01, 0x01, 0xF7], // Type 1, Int 1
    [0xF0, 0x43, 0x10, 0x3E, 0x12, 0x01, 0x01, 0xF7], // Command 12
    [0xF0, 0x43, 0x10, 0x3E, 0x21, 0x01, 0x01, 0xF7], // Command 21
];

let pIdx = 0;
setInterval(() => {
    console.log(`Probing with ${probes[pIdx].map(b => b.toString(16).toUpperCase()).join(' ')}...`);
    output.sendMessage(probes[pIdx]);
    pIdx = (pIdx + 1) % probes.length;
}, 2000);
