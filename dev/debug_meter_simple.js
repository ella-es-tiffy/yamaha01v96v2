console.log('--- START METER DEBUG ---');
const midi = require('midi');
const output = new midi.Output();
const input = new midi.Input();

let portIndex = -1;
for (let i = 0; i < output.getPortCount(); i++) {
    if (output.getPortName(i).includes('YAMAHA 01V96 Port1')) {
        portIndex = i;
        break;
    }
}

if (portIndex === -1) {
    console.error('Port not found');
    process.exit(1);
}

output.openPort(portIndex);
input.openPort(portIndex);
input.ignoreTypes(false, false, false);

input.on('message', (dt, msg) => {
    // Filter for Meter Message: F0 43 10/30 3E 0D 21
    if (msg[0] === 0xF0 && msg[3] === 0x3E && msg[5] === 0x21) {
        console.log('METER DATA RECEIVED:', msg.length, 'bytes');
        console.log(msg.map(b => b.toString(16).padStart(2,'0')).join(' '));
    }
});

// Send Meter Request
const req = [0xF0, 0x43, 0x30, 0x3E, 0x0D, 0x21, 0x00, 0x00, 0x00, 0x00, 0x20, 0xF7];
console.log('Sending request...');
output.sendMessage(req);

setInterval(() => {
    output.sendMessage(req);
}, 100);

