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

console.log("Requesting Individual Library Slots (41-50)...");

input.on('message', (delta, msg) => {
    // Look for LM  8C93Q (EQ Library)
    if (msg.length > 20 && msg[6] === 0x4C && msg[7] === 0x4D && msg[14] === 0x51) {
        const id = msg[16];
        const nameBytes = msg.slice(20, 40);
        const name = nameBytes.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '').join('').trim();
        console.log(`🎯 FOUND EQ PRESET: ID=${id} (Nr=${id + 1}) Name="${name}"`);
    } else if (msg.length > 10) {
        // Log short summary of other packets
        // console.log("Recv:", msg.length, "bytes");
    }
});

// Recall is F0 43 1n 3E 12 [Slot] [Idx] F7
// Request is F0 43 10 3E 02 [Slot] [Idx] F7
for (let i = 40; i < 50; i++) {
    // 0x02 is EQ Slot
    const req = [0xF0, 0x43, 0x10, 0x3E, 0x02, 0x02, i, 0xF7];
    output.sendMessage(req);
}

setTimeout(() => {
    console.log("Done.");
    process.exit(0);
}, 3000);
