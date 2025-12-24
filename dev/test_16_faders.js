
const midi = require('midi');

console.log('=== YAMAHA 01V96 - ALL 16 FADERS MONITOR ===');

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

const faders = new Array(17).fill(0); // 1-16 + Master

input.on('message', (deltaTime, message) => {
    // Pattern: F0 43 10 3E 7F 01 1C 00 [CH] 00 00 [VAL_HI] [VAL_LO] F7
    if (message.length >= 13 &&
        message[0] === 0xF0 &&
        message[1] === 0x43 &&
        message[3] === 0x3E &&
        message[6] === 0x1C) {

        const channel = message[8];
        const valHi = message[11];
        const valLo = message[12];
        const absoluteValue = (valHi << 7) | valLo;

        // Map channel to index (0-15 = Faders 1-16, 16 = Stereo Master)
        // Note: We need to verify the Stereo Master address later, but usually it's in the same block
        if (channel <= 16) {
            faders[channel] = absoluteValue;
            renderFaders();
        }
    }
});

function renderFaders() {
    process.stdout.write('\x1b[H\x1b[2J'); // Clear screen
    console.log('=== YAMAHA 01V96 FADER MONITOR (1-16) ===\n');

    for (let i = 0; i < 16; i++) {
        const val = faders[i] || 0;
        const barLen = Math.round((val / 1023) * 30);
        const bar = '#'.repeat(barLen).padEnd(30);
        console.log(`Ch ${String(i + 1).padStart(2)}: [${bar}] ${String(val).padStart(4)}`);
    }
    console.log(`\nMaster: [${'#'.repeat(Math.round((faders[16] || 0) / 1023 * 30)).padEnd(30)}] ${faders[16] || 0}`);
    console.log('\nPress Ctrl+C to exit');
}

input.openPort(yamahaPort);

console.log(`✓ Monitoring: [${yamahaPort}] ${input.getPortName(yamahaPort)}`);
renderFaders();

setInterval(() => { }, 1000);
