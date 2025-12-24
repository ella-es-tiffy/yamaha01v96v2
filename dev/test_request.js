const midi = require('midi');
const output = new midi.Output();
const input = new midi.Input();

// Find Yamaha Port
let portIdx = -1;
for (let i = 0; i < output.getPortCount(); i++) {
    if (output.getPortName(i).includes('01V96')) {
        portIdx = i;
        break;
    }
}

if (portIdx === -1) {
    console.log("No 01V96 found");
    process.exit();
}

output.openPort(portIdx);
input.openPort(portIdx);

input.on('message', (deltaTime, message) => {
    console.log(`📥 RECEIVED: ${message.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
});

console.log("Sending Parameter Request for Ch1 Fader (Element 0x1C)...");
// Request Header: F0 43 30 3E
// Element: 1C, P1: 00, P2: 00
const msg = [0xF0, 0x43, 0x30, 0x3E, 0x7F, 0x01, 0x1C, 0x00, 0x00, 0xF7];
output.sendMessage(msg);

setTimeout(() => {
    console.log("Sending Parameter Request for Ch1 Mute (Element 0x1A)...");
    output.sendMessage([0xF0, 0x43, 0x30, 0x3E, 0x7F, 0x01, 0x1A, 0x00, 0x00, 0xF7]);
}, 1000);

setTimeout(() => {
    console.log("Done. Waiting for responses...");
}, 2000);

setTimeout(() => {
    output.closePort();
    input.closePort();
}, 5000);
