const midi = require('midi');
const output = new midi.Output();
const input = new midi.Input();

let portIdx = -1;
for (let i = 0; i < output.getPortCount(); i++) {
    if (output.getPortName(i).includes('01V96')) {
        portIdx = i;
        break;
    }
}

if (portIdx === -1) { process.exit(); }

output.openPort(portIdx);
input.openPort(portIdx);

input.on('message', (deltaTime, message) => {
    console.log(`📥 RECEIVED (${message.length} bytes): ${message.slice(0, 20).map(b => b.toString(16).padStart(2, '0')).join(' ')}...`);
});

console.log("Sending Bulk Dump Request (DMP )...");
const msg = [0xF0, 0x43, 0x20, 0x3E, 0x7F, 0x44, 0x4D, 0x50, 0x20, 0xF7];
output.sendMessage(msg);

setTimeout(() => {
    console.log("Done.");
    output.closePort();
    input.closePort();
}, 5000);
