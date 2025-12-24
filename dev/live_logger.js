const midi = require('midi');

const input = new midi.Input();
let port = -1;
for (let i = 0; i < input.getPortCount(); i++) {
    if (input.getPortName(i).includes('Port1')) port = i;
}

if (port === -1) { process.exit(1); }

input.openPort(port);
input.ignoreTypes(false, false, false);

console.log('🎤 LIVE LOGGER - Waiting for input...');

input.on('message', (delta, msg) => {
    if (msg[0] >= 0xF8) return; // Ignore Clock
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    console.log(`[MIDI] ${hex}`);
});
