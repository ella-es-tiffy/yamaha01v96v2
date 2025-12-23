
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

console.log('=== YAMAHA 01V96 - REVERSE ENGINEERING HANDSHAKE (CMD 15) ===');

input.on('message', (delta, msg) => {
    if (msg[0] === 0xFE) return;
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    // Filter heartbeat
    if (hex === 'F0 43 10 3E 0D 7F F7') return;
    console.log(`[RECV] ${hex}`);
});

console.log('Sending CMD 15 Handshake...');
output.sendMessage([0xF0, 0x43, 0x10, 0x3E, 0x15, 0x01, 0xF7]);

setTimeout(() => {
    console.log('Trying CMD 15 Type 0...');
    output.sendMessage([0xF0, 0x43, 0x10, 0x3E, 0x15, 0x00, 0xF7]);
}, 2000);

setInterval(() => { }, 1000);
