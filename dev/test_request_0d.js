const midi = require('midi');
const output = new midi.Output();
const input = new midi.Input();

let portIdx = -1;
for (let i = 0; i < output.getPortCount(); i++) {
    const name = output.getPortName(i);
    if (name.includes('01V96')) {
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
input.ignoreTypes(false, false, false);

input.on('message', (deltaTime, message) => {
    console.log(`📥 RECEIVED: ${message.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
});

console.log("Trying Parameter Request with Device ID 0D (13)...");
// Request: F0 43 30 3E 0D 01 [Element] [P1] [P2] F7
const msg = [0xF0, 0x43, 0x30, 0x3E, 0x0D, 0x01, 0x1C, 0x00, 0x00, 0xF7];
output.sendMessage(msg);

setTimeout(() => {
    console.log("Trying with P1=0x01 (maybe?)");
    output.sendMessage([0xF0, 0x43, 0x30, 0x3E, 0x0D, 0x01, 0x1C, 0x01, 0x00, 0xF7]);
}, 1000);

setTimeout(() => {
    output.closePort();
    input.closePort();
}, 4000);
