
const midi = require('midi');

const input = new midi.Input();
const output = new midi.Output();
let port = -1;

for (let i = 0; i < output.getPortCount(); i++) {
    if (output.getPortName(i).includes('YAMAHA 01V96 Port1')) {
        port = i; break;
    }
}

if (port === -1) {
    console.log("01V96 Port1 not found.");
    process.exit(1);
}

input.openPort(port);
output.openPort(port);
input.ignoreTypes(false, false, false);

console.log("Listening for Sync responses...");

input.on('message', (delta, msg) => {
    if (msg[0] === 0xF0 && msg[1] === 0x43) {
        const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
        console.log(`[SYS] ${hex}`);
    }
});

// Request Ch 1 Fader (just to confirm communication)
console.log("Requesting Ch 1 Fader...");
output.sendMessage([0xF0, 0x43, 0x30, 0x3E, 0x7F, 0x01, 0x00, 0x00, 0x1C, 0xF7]);

// Request Ch 1 EQ Low Gain
console.log("Requesting Ch 1 EQ Low Gain...");
output.sendMessage([0xF0, 0x43, 0x30, 0x3E, 0x7F, 0x01, 0x00, 0x00, 0x21, 0xF7]);

setTimeout(() => {
    console.log("Done.");
    process.exit(0);
}, 2000);
