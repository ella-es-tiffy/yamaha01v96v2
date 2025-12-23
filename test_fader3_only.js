
const midi = require('midi');

console.log('=== YAMAHA 01V96 - FADER 3 LIVE CALIBRATION ===');

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
    const hex = message.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    // Check if it's a Parameter Change for Fader 3
    // Pattern: F0 43 10 3E 7F 01 1C 00 02 00 00 [VAL_HI] [VAL_LO] F7
    if (message.length >= 13 &&
        message[0] === 0xF0 &&
        message[1] === 0x43 &&
        message[3] === 0x3E &&
        message[6] === 0x1C &&
        message[8] === 0x02) {

        const valHi = message[11];
        const valLo = message[12];
        const absoluteValue = (valHi << 7) | valLo; // Yamaha uses 7-bit shifts for Sysex data

        // 01V96 V2 Fader range is typically 0 to 1023
        const percentage = ((absoluteValue / 1023) * 100).toFixed(1);

        console.log(`\x1b[2K\rFader 3: [${'#'.repeat(Math.round(percentage / 5)).padEnd(20)}] ${percentage}% (Raw: ${absoluteValue})`);
    }
});

input.openPort(yamahaPort);

console.log(`✓ Monitoring: [${yamahaPort}] ${input.getPortName(yamahaPort)}`);
console.log('Please move FADER 3 slowy from bottom to top...');
console.log('Press Ctrl+C to exit\n');

setInterval(() => { }, 1000);
