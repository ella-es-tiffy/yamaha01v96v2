
const midi = require('midi');

const input = new midi.Input();
const output = new midi.Output();
const portCount = input.getPortCount();
let yamahaPort = -1;

for (let i = 0; i < portCount; i++) {
    if (input.getPortName(i).includes('YAMAHA') && input.getPortName(i).includes('Port1')) {
        yamahaPort = i;
        break;
    }
}

if (yamahaPort === -1) process.exit(1);

input.openPort(yamahaPort);
output.openPort(yamahaPort);
input.ignoreTypes(false, false, false);

console.log('Sending various Meter Requests for 01V96...');

// Types of requests to try
const requests = [
    [0xF0, 0x43, 0x10, 0x3E, 0x0F, 0x01, 0xF7], // Meter Request Type 1
    [0xF0, 0x43, 0x10, 0x3E, 0x0F, 0x21, 0xF7], // Input Meters 
    [0xF0, 0x43, 0x10, 0x3E, 0x0F, 0x22, 0xF7], // Output/Master Meters
];

input.on('message', (delta, msg) => {
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    if (msg[0] === 0xFE) return;
    if (hex.startsWith('F0 43 10 3E 0D 7F')) return; // Active sense sysex
    console.log(`[LEVEL?] ${hex}`);
});

let idx = 0;
setInterval(() => {
    console.log(`Trying request variation ${idx}...`);
    output.sendMessage(requests[idx]);
    idx = (idx + 1) % requests.length;
}, 2000);

console.log('Watching for level responses. PLEASE ENSURE AUDIO IS PLAYING ON CHANNEL 1-8!');
