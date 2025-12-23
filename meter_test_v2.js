
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

console.log('=== YAMAHA 01V96 METER TEST V2 ===');

input.on('message', (delta, msg) => {
    if (msg[0] === 0xFE) return;
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    // Catch Command 0x0F (Meter)
    if (msg[4] === 0x0F) {
        console.log(`⚡️ DETECTED METER DATA: ${hex}`);
    } else {
        // Log other 3E traffic just in case
        if (msg[4] !== 0x0D) console.log(`[OTHER] ${hex}`);
    }
});

// Request Input 1-16 (Type 01) with Interval 0x10
const meterReq = [0xF0, 0x43, 0x10, 0x3E, 0x0F, 0x01, 0x10, 0xF7];

console.log(`Sending Meter Request: ${meterReq.map(b => b.toString(16).toUpperCase()).join(' ')}`);
output.sendMessage(meterReq);

setInterval(() => {
    // Re-request every 2 seconds
    output.sendMessage(meterReq);
}, 2000);
