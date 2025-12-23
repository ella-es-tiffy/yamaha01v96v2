
const midi = require('midi');

console.log('=== YAMAHA 01V96 UNFILTERED MONITOR ===');

const input = new midi.Input();
const portCount = input.getPortCount();

let yamahaPort = -1;
for (let i = 0; i < portCount; i++) {
    const name = input.getPortName(i);
    if (name.includes('YAMAHA') && name.includes('Port1')) {
        yamahaPort = i;
        break;
    }
}

if (yamahaPort === -1) {
    console.error('Yamaha Port 1 not found');
    process.exit(1);
}

// IMPORTANT: Disable filtering of Sysex, Timing, and Active Sensing
// ignoreTypes(sysex, timing, activeSensing)
input.ignoreTypes(false, false, false);

input.on('message', (deltaTime, message) => {
    const hex = message.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    console.log(`[${new Date().toLocaleTimeString()}] RECEIVED: ${hex}`);
});

input.openPort(yamahaPort);

console.log(`✓ Listening on [${yamahaPort}] ${input.getPortName(yamahaPort)}`);
console.log('IgnoreTypes is OFF. You should at least see "FE" (Active Sensing) every few hundred ms.');
console.log('If you see NOTHING, then the driver is genuinely not delivering bytes to this process.');

setInterval(() => { }, 1000);
