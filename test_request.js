const midi = require('midi');
const input = new midi.Input();
const output = new midi.Output();

let portName = 'YAMAHA 01V96 Port1';
let inPort = -1, outPort = -1;

for (let i = 0; i < input.getPortCount(); i++) {
    if (input.getPortName(i).includes(portName)) inPort = i;
}
for (let i = 0; i < output.getPortCount(); i++) {
    if (output.getPortName(i).includes(portName)) outPort = i;
}

if (inPort === -1 || outPort === -1) {
    console.log("Port not found");
    process.exit();
}

input.openPort(inPort);
output.openPort(outPort);

input.on('message', (deltaTime, message) => {
    console.log('RX:', message.map(b => b.toString(16).padStart(2, '0')).join(' '));
});

// Request Ch1 Fader
console.log("Requesting Ch1 Fader...");
output.sendMessage([0xF0, 0x43, 0x30, 0x3E, 0x7F, 0x01, 0x01, 0x00, 0x00, 0x1C, 0xF7]);

setTimeout(() => {
    // Request Ch1 EQ High Gain
    console.log("Requesting Ch1 EQ High Gain...");
    output.sendMessage([0xF0, 0x43, 0x30, 0x3E, 0x7F, 0x01, 0x01, 0x00, 0x00, 0x00, 0xF7]);
}, 500);

setTimeout(() => process.exit(), 2000);
