
const midi = require('midi');

console.log('=== YAMAHA 01V96 - METER DATA SNIFFER ===');
console.log('Searching for high-frequency level data...');

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

if (yamahaPort === -1) {
    console.error('Yamaha Port 1 not found');
    process.exit(1);
}

input.openPort(yamahaPort);
output.openPort(yamahaPort);
input.ignoreTypes(false, false, false);

// Known messages to ignore
const IGNORE_PATTERNS = [
    'F0 43 10 3E 0D 7F F7', // Active Sensing
    'F0 43 10 3E 7F 01 1C', // Fader moves
    'F0 43 10 3E 7F 01 1A', // Mute moves
];

input.on('message', (deltaTime, message) => {
    const hex = message.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    // Ignore known patterns
    if (IGNORE_PATTERNS.some(p => hex.startsWith(p))) return;

    // Ignore Active Sensing (Byte FE)
    if (message[0] === 0xFE) return;

    console.log(`[RECV] ${hex}`);
});

// Try to trigger Metering
// Standard Yamaha 01V96 Meter Request: F0 43 10 3E 0F 00 F7
console.log('Sende Meter-Request: F0 43 10 3E 0F 00 F7...');
output.sendMessage([0xF0, 0x43, 0x10, 0x3E, 0x0F, 0x00, 0xF7]);

console.log('✓ Sniffer active. Bitte sorge dafür, dass Pegel (Musik/Mikro) am Pult anliegt!');
console.log('Drücke Strg+C zum Beenden.');

setInterval(() => {
    // Keep alive or re-request every 5 seconds if needed
    // output.sendMessage([0xF0, 0x43, 0x10, 0x3E, 0x0F, 0x00, 0xF7]);
}, 5000);
