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

console.log("📡 Requesting EQ Library Bulk... (Waiting for LM blocks)");

const dumpFile = 'dev/full_eq_lib_capture.txt';
const fd = fs.openSync(dumpFile, 'w');

input.on('message', (delta, msg) => {
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    fs.writeSync(fd, hex + '\n');

    // Decode LM header
    if (msg.length > 20 && msg[6] === 0x4C && msg[7] === 0x4D && msg[14] === 0x51) {
        const id = msg[16];
        // Interleaved name extraction logic
        let name = "";
        // Header usually 20 bytes. Let's look for ASCII in the data.
        for (let j = 20; j < 40; j++) {
            if (msg[j] >= 32 && msg[j] < 127) name += String.fromCharCode(msg[j]);
        }
        name = name.trim();
        if (name) {
            console.log(`🎯 Found Library Entry: ID=${id} (Nr=${id + 1}) Name="${name}"`);
        }
    }
});

// Yamaha Bulk Request for ALL EQ Library
// F0 43 20 3E 02 02 F7 (20 = Request, 3E = 01V96, 02 02 = EQ Library)
// Also trying F0 43 30 3E 02 02 F7 (30 = ID)
const requests = [
    [0xF0, 0x43, 0x20, 0x3E, 0x02, 0x02, 0xF7],
    [0xF0, 0x43, 0x30, 0x3E, 0x02, 0x02, 0xF7],
    [0xF0, 0x43, 0x10, 0x3E, 0x02, 0x02, 0xF7]
];

requests.forEach((req, i) => {
    setTimeout(() => {
        console.log(`📤 Sending Request ${i + 1}: ${req.map(b => b.toString(16).toUpperCase()).join(' ')}`);
        output.sendMessage(req);
    }, i * 1000);
});

setTimeout(() => {
    fs.closeSync(fd);
    console.log(`\n✅ Scan finished. Results in ${dumpFile}`);
    process.exit(0);
}, 10000);
