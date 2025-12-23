
const midi = require('midi');

const input = new midi.Input();
const output = new midi.Output();
const portCount = input.getPortCount();
let port2Idx = -1;

for (let i = 0; i < portCount; i++) {
    if (input.getPortName(i).includes('YAMAHA') && input.getPortName(i).includes('Port2')) {
        port2Idx = i;
        break;
    }
}

if (port2Idx === -1) {
    console.error('Yamaha Port 2 not found');
    process.exit(1);
}

input.openPort(port2Idx);
output.openPort(port2Idx);
input.ignoreTypes(false, false, false);

console.log(`=== YAMAHA 01V96 - SNIFFING PORT 2 (Editor Protocol) ===`);

input.on('message', (delta, msg) => {
    if (msg[0] === 0xFE) return;
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    console.log(`[PORT2] ${hex}`);
});

// Try Handshake on Port 2
console.log('Sending Studio Manager Handshake to Port 2...');
output.sendMessage([0xF0, 0x43, 0x10, 0x3E, 0x19, 0x00, 0xF7]);

// Try Meter Request on Port 2
setTimeout(() => {
    console.log('Sending Meter Request to Port 2...');
    output.sendMessage([0xF0, 0x43, 0x10, 0x3E, 0x0F, 0x01, 0x01, 0xF7]);
}, 2000);

setInterval(() => { }, 1000);
