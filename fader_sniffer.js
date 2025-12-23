
const midi = require('midi');

console.log('=== YAMAHA 01V96 FADER SNIFFER (3 & 4) ===');

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

// Disable filtering
input.ignoreTypes(false, false, false);

input.on('message', (deltaTime, message) => {
    // F0 43 10 3E 0D 7F F7 is likely Active Sensing or a keep-alive
    // We want to see EVERYTHING ELSE
    const hex = message.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    if (hex === 'F0 43 10 3E 0D 7F F7') {
        // Skip the noise if you want, but maybe let's see if it CHANGES when moving a fader
        // console.log('.'); 
        return;
    }

    console.log(`[${new Date().toLocaleTimeString()}] >> ${hex}`);
});

input.openPort(yamahaPort);

console.log(`✓ Listening on [${yamahaPort}] ${input.getPortName(yamahaPort)}`);
console.log('Noise filter active (skipping F0 43 10 3E 0D 7F F7)');
console.log('Please move FADER 3 and FADER 4 now!');

setInterval(() => { }, 1000);
