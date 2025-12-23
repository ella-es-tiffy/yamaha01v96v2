
const midi = require('midi');

console.log('=== YAMAHA 01V96 - CH8 MUTE TOGGLE DEBUG ===');

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

    // Ignore Active Sensing
    if (hex === 'F0 43 10 3E 0D 7F F7') return;

    // Monitor everything, but highlight Channel 8 (0x07) Address 1A
    if (hex.includes('01 1A 00 07')) {
        console.log(`\n🚨 CH8 MUTE ACTION:`);
        console.log(`DATA: ${hex}`);
        console.log(`VAL : ${message[12]} (${message[12] === 1 ? 'ON/LIT' : 'MUTE/UNLIT'})\n`);
    } else {
        console.log(`[MIDI] ${hex}`);
    }
});

input.openPort(yamahaPort);

console.log(`✓ Listening on [${yamahaPort}] ${input.getPortName(yamahaPort)}`);
console.log('BITTE JETZT KANAL 8 EIN- UND AUSSCHALTEN!');

setInterval(() => { }, 1000);
