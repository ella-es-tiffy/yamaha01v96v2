
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

console.log('=== YAMAHA 01V96 - BULK METER REQUEST ===');

input.on('message', (delta, msg) => {
    if (msg[0] === 0xFE) return;
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    console.log(`[RECV] ${hex}`);
});

// Request Meter Bulk Dump
// Address for Meters in 3E protocol is often 0x4D or a specific address
console.log('Sending Bulk Request for Meters...');
output.sendMessage([0xF0, 0x43, 0x20, 0x3E, 0x4D, 0x00, 0xF7]); // 0x20 = Bulk Request Device ID

setTimeout(() => {
    console.log('Trying Parameter-style Meter request...');
    // Address 0x21 0x00 0x00 is sometimes Meter data
    output.sendMessage([0xF0, 0x43, 0x30, 0x3E, 0x01, 0x21, 0x00, 0x00, 0xF7]);
}, 2000);

setInterval(() => { }, 1000);
