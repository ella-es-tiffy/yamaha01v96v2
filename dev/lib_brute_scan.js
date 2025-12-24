const midi = require('midi');
const fs = require('fs');

const input = new midi.Input();
const output = new midi.Output();

for (let i = 0; i < input.getPortCount(); i++) {
    if (input.getPortName(i).includes('Port1')) {
        input.openPort(i);
        output.openPort(i);
        break;
    }
}

console.log("Listening for ALL Library Names (brute force request)...");

input.on('message', (delta, msg) => {
    // Look for LM  8C93Q (EQ Library)
    if (msg.length > 20 && msg[6] === 0x4C && msg[7] === 0x4D && msg[14] === 0x51) {
        const id = msg[16];
        const nameBytes = msg.slice(20, 40);
        const name = nameBytes.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '').join('').trim();
        if (name) {
            console.log(`🎯 ID=${id} (Nr=${id + 1}) Name="${name}"`);
        }
    }
});

// Yamaha Library Request: F0 43 1n 3E 02 [Slot] [Idx] F7
// Slot 0x02 = EQ
const slot = 0x02;

async function run() {
    for (let i = 40; i <= 60; i++) {
        const req = [0xF0, 0x43, 0x10, 0x3E, 0x02, slot, i, 0xF7];
        output.sendMessage(req);
        await new Promise(r => setTimeout(r, 100)); // Short delay to avoid buffer overflow
    }
    await new Promise(r => setTimeout(r, 2000));
    console.log("Scan complete.");
    process.exit(0);
}

run();
