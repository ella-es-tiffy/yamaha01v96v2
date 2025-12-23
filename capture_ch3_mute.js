
const midi = require('midi');

console.log('=== YAMAHA 01V96 - MUTE CHANNEL 3 CAPTURE ===');

const input = new midi.Input();
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

input.ignoreTypes(false, false, false);

input.on('message', (deltaTime, message) => {
    const hex = message.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    // Ignore Active Sensing noise
    if (hex === 'F0 43 10 3E 0D 7F F7') return;

    // Highlight Parameter Changes (7F 01) at Mute Address (1A 00) for Channel 3 (02)
    if (hex.includes('7F 01 1A 00 02')) {
        console.log(`\n🚨 FOUND CH3 MUTE CHANGE:`);
        console.log(`BYTS: ${hex}`);
        const state = message[12] === 1 ? 'ON (Green)' : 'MUTE (Red)';
        console.log(`STAT: ${state}\n`);
    } else {
        console.log(`[MIDI] ${hex}`);
    }
});

input.openPort(yamahaPort);

console.log(`✓ Listening on [${yamahaPort}] ${input.getPortName(yamahaPort)}`);
console.log('BITTE JETZT KANAL 3 MUTE UND DANN AN DRÜCKEN!');

setInterval(() => { }, 1000);
