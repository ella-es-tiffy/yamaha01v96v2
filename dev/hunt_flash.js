const midi = require('midi');
const fs = require('fs');

const input = new midi.Input();
const output = new midi.Output();

let portName = "";
for (let i = 0; i < input.getPortCount(); i++) {
    if (input.getPortName(i).includes('Port1')) {
        input.openPort(i);
        output.openPort(i);
        portName = input.getPortName(i);
        break;
    }
}

if (!portName) {
    console.error("❌ Port 1 not found!");
    process.exit(1);
}

console.log(`📡 Connected to ${portName}. Requesting Library Dump...`);

const dumpFile = 'dev/flash_hunt_dump.txt';
const fd = fs.openSync(dumpFile, 'w');

input.on('message', (delta, msg) => {
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    fs.writeSync(fd, hex + '\n');

    // Quick check for "flash" in the stream
    const decoded = msg.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
    if (decoded.toLowerCase().includes('flash')) {
        console.log(`\n🎯 FOUND "flash" in stream!`);
        console.log(`Hex: ${hex}`);
        // Extract ID (usually around byte 15-18 in LM blocks)
        if (msg.length > 20 && msg[6] === 0x4C && msg[7] === 0x4D) {
            console.log(`Potentielle ID (Byte 16): ${msg[16]} (Display: ${msg[16] + 1})`);
            console.log(`Potentielle ID (Byte 17): ${msg[17]} (Display: ${msg[17] + 1})`);
        }
    }
});

// Request EQ Library Dump
// Slot 0x02 = EQ
const request = [0xF0, 0x43, 0x30, 0x3E, 0x02, 0x02, 0xF7];
output.sendMessage(request);

console.log("⏳ Waiting 10 seconds for dump data...");
setTimeout(() => {
    fs.closeSync(fd);
    console.log(`\n✅ Dump finished. Saved to ${dumpFile}`);
    process.exit(0);
}, 10000);
