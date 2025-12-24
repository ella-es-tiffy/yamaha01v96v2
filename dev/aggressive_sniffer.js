
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

console.log('=== YAMAHA 01V96 AGGRESSIVE METER SEARCH ===');

// Known 01V96 Meter Request Formats
const requests = [
    [0xF0, 0x43, 0x10, 0x3E, 0x0F, 0x01, 0x01, 0xF7], // Input 1-16, Interval 1
    [0xF0, 0x43, 0x10, 0x3E, 0x0F, 0x21, 0x01, 0xF7], // Input 1-16 (Alternative)
    [0xF0, 0x43, 0x10, 0x3E, 0x0F, 0x00, 0x01, 0xF7], // General Meter Start
    [0xF0, 0x43, 0x10, 0x3E, 0x0E, 0x00, 0xF7],       // Dump Request for Meters?
];

input.on('message', (delta, msg) => {
    if (msg[0] === 0xFE) return; // Ignore Active Sensing

    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    // Ignore parameter feedback (Faders / Mutes)
    if (hex.startsWith('F0 43 10 3E 0D')) return;
    if (hex.startsWith('F0 43 10 3E 7F')) return;

    // Meter data often starts with 0x0F or 0x0E in the type byte
    if (msg[4] === 0x0F || msg[4] === 0x0E || msg[4] === 0x10) {
        console.log(`\n🔥 POSSIBLE METER DATA DETECTED:`);
        console.log(hex);
        // Look for values in the data section (usually after byte 6)
        const levels = msg.slice(6, 14).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`CH1-4? : ${levels}\n`);
    } else {
        console.log(`[OTHER] ${hex}`);
    }
});

let rIdx = 0;
setInterval(() => {
    console.log(`Sending Meter Request Variation ${rIdx}...`);
    output.sendMessage(requests[rIdx]);
    rIdx = (rIdx + 1) % requests.length;
}, 1500);

console.log('Watching... please check if something triggers rapid data flow.');
