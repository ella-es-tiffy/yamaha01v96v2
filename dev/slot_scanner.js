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

console.log("🔍 Scanning EQ Library Slots 41-70 individually...");

input.on('message', (delta, msg) => {
    const ascii = msg.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
    if (ascii.toLowerCase().includes('test')) {
        const h = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
        console.log(`\n🎯 TARGET FOUND!`);
        console.log(`Msg: ${h}`);
        // LM block detected? pos 6,7 = L M
        if (msg[6] === 0x4C && msg[7] === 0x4D) {
            const id = msg[16];
            console.log(`ID Byte: 0x${id.toString(16).toUpperCase()} (${id}) -> Library Nr: ${id + 1}`);
        }
    }
});

async function run() {
    for (let i = 40; i < 70; i++) {
        // Request Single Entry
        // Variant 1: F0 43 20 3E 0E 02 [Idx] F7
        output.sendMessage([0xF0, 0x43, 0x20, 0x3E, 0x0E, 0x02, i, 0xF7]);

        // Variant 2: F0 43 00 7E 00 21 4C 4D 20 20 38 43 39 33 51 00 [Idx] F7
        output.sendMessage([0xF0, 0x43, 0x00, 0x7E, 0x00, 0x21, 0x4C, 0x4D, 0x20, 0x20, 0x38, 0x43, 0x39, 0x33, 0x51, 0x00, i, 0xF7]);

        await new Promise(r => setTimeout(r, 200));
    }
    console.log("Scan request sent. Waiting for responses...");
    await new Promise(r => setTimeout(r, 5000));
    process.exit(0);
}

run();
