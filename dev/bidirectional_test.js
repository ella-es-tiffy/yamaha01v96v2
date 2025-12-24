
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

console.log('=== YAMAHA 01V96 - BIDIRECTIONAL HEARTBEAT METER TEST ===');

input.on('message', (delta, msg) => {
    if (msg[0] === 0xFE) return;
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    if (hex === 'F0 43 10 3E 0D 7F F7') return;

    console.log(`\n🎉 UNIQUE RESPONSE DETECTED: ${hex}`);
});

// Periodic Heartbeat to the desk
setInterval(() => {
    output.sendMessage([0xF0, 0x43, 0x10, 0x3E, 0x0D, 0x7F, 0xF7]);
}, 2000);

// Meter Request
setInterval(() => {
    console.log('Sending Meter Request...');
    output.sendMessage([0xF0, 0x43, 0x10, 0x3E, 0x0F, 0x01, 0x01, 0xF7]);
}, 3000);
