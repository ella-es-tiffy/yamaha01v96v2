const midi = require('midi');
const fs = require('fs');

const input = new midi.Input();
const output = new midi.Output();

let found = false;
for (let i = 0; i < input.getPortCount(); i++) {
    if (input.getPortName(i).includes('Port1')) {
        input.openPort(i);
        output.openPort(i);
        found = true;
        break;
    }
}

if (!found) process.exit(1);

console.log("Listening for LM blocks... (Press Ctrl+C to stop)");

input.on('message', (delta, msg) => {
    // Look for LM  8C93Q (EQ Library)
    if (msg.length > 20 && msg[6] === 0x4C && msg[7] === 0x4D && msg[14] === 0x51) {
        const id = msg[16];
        const nameBytes = msg.slice(20, 40);
        const name = nameBytes.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '').join('').trim();
        console.log(`🎯 FOUND EQ PRESET: ID=${id} (Nr=${id + 1}) Name="${name}"`);
    }
});

// Request ALL EQ Presets one by one or via bulk
// We try the bulk request again, but maybe with 0x10 instead of 0x30
output.sendMessage([0xF0, 0x43, 0x10, 0x3E, 0x02, 0x02, 0xF7]);
// And the 0x30 variant
output.sendMessage([0xF0, 0x43, 0x30, 0x3E, 0x02, 0x02, 0xF7]);

setTimeout(() => {
    console.log("No more data. Closing.");
    process.exit(0);
}, 5000);
