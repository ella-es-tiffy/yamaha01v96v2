
const midi = require('midi');
const input = new midi.Input();
const output = new midi.Output();
const portCount = input.getPortCount();
let port1Idx = -1;
for (let i = 0; i < portCount; i++) {
    if (input.getPortName(i).includes('YAMAHA') && input.getPortName(i).includes('Port1')) {
        port1Idx = i; break;
    }
}
if (port1Idx === -1) process.exit(1);
input.openPort(port1Idx);
output.openPort(port1Idx);
input.ignoreTypes(false, false, false);

console.log('=== YAMAHA 01V96 PORT 1 ID SCAN (00-0F) ===');

input.on('message', (delta, msg) => {
    if (msg[0] === 0xFE) return;
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    console.log(`[ANS] ${hex}`);
});

async function scan() {
    for (let id = 0x00; id <= 0x0F; id++) {
        console.log(`Testing Handshake with Device ID 0x${id.toString(16).toUpperCase()}...`);
        output.sendMessage([0xF0, 0x43, id, 0x3E, 0x19, 0x00, 0xF7]);
        await new Promise(r => setTimeout(r, 200));
    }
}

scan();
