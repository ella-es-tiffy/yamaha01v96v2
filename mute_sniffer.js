
const midi = require('midi');

console.log('=== YAMAHA 01V96 - MUTE/ON BUTTON SNIFFER ===');

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

input.ignoreTypes(false, false, false);

input.on('message', (deltaTime, message) => {
    const hex = message.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    // Skip regular Fader messages (1C 00) and Noise (0D 7F) to focus on Mute Buttons
    if (hex.includes('1C 00') || hex === 'F0 43 10 3E 0D 7F F7') {
        return;
    }

    console.log(`[${new Date().toLocaleTimeString()}] >> ${hex}`);
});

input.openPort(yamahaPort);

console.log(`✓ Listening for Mute/ON buttons on [${yamahaPort}] ${input.getPortName(yamahaPort)}`);
console.log('Please press the ON buttons for Ch 1, 2, 3 and 4 now!');

setInterval(() => { }, 1000);
