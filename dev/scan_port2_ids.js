
const midi = require('midi');
const input = new midi.Input();
const output = new midi.Output();
const portCount = input.getPortCount();
let port2Idx = -1;
for (let i = 0; i < portCount; i++) {
    if (input.getPortName(i).includes('YAMAHA') && input.getPortName(i).includes('Port2')) {
        port2Idx = i; break;
    }
}
if (port2Idx === -1) process.exit(1);
input.openPort(port2Idx);
output.openPort(port2Idx);
input.ignoreTypes(false, false, false);

console.log('=== YAMAHA 01V96 PORT 2 ID SCAN ===');

input.on('message', (delta, msg) => {
    if (msg[0] === 0xFE) return;
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    console.log(`[PORT2 ANS] ${hex}`);
});

async function scan() {
    for (let id = 0x10; id <= 0x1F; id++) {
        console.log(`Testing Handshake with Device ID 0x${id.toString(16).toUpperCase()}...`);
        output.sendMessage([0xF0, 0x43, id, 0x3E, 0x19, 0x00, 0xF7]);
        await new Promise(r => setTimeout(r, 200));
    }
    // Also try Broadcast 0x30
    console.log('Testing Broadcast ID 0x30...');
    output.sendMessage([0xF0, 0x43, 0x30, 0x3E, 0x19, 0x00, 0xF7]);
}

scan();
