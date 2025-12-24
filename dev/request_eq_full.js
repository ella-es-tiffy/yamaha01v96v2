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

console.log("🚀 Requesting FULL EQ LIBRARY DUMP... (Wait 15s)");

const logFile = 'dev/full_eq_dump_raw.txt';
const fd = fs.openSync(logFile, 'w');

input.on('message', (delta, msg) => {
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    fs.writeSync(fd, hex + '\n');

    // Quick ASCII detection
    const ascii = msg.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
    if (ascii.toLowerCase().includes('test')) {
        console.log(`\n🎯 FOUND "test" in message! Len: ${msg.length}`);
        console.log(`Msg: ${hex}`);
        if (msg[6] === 0x4C && msg[7] === 0x4D) { // LM block
            const id = msg[16];
            console.log(`ID Byte (pos 16): ${id} (Nr: ${id + 1})`);
        }
    }
});

// Try several request variants
const requests = [
    [0xF0, 0x43, 0x20, 0x3E, 0x0E, 0x02, 0x7F, 0xF7], // Request All EQ (Standard 01V96)
    [0xF0, 0x43, 0x00, 0x7E, 0x00, 0x21, 0x4C, 0x4D, 0x20, 0x20, 0x38, 0x43, 0x39, 0x33, 0x51, 0x00, 0x7F, 0xF7], // LM Request EQ All
    [0xF0, 0x43, 0x20, 0x3E, 0x02, 0x02, 0xF7] // Generic 0x02 request
];

requests.forEach((req, idx) => {
    setTimeout(() => {
        console.log(`📤 Sending Request Variation ${idx + 1}...`);
        output.sendMessage(req);
    }, idx * 2000);
});

setTimeout(() => {
    fs.closeSync(fd);
    console.log(`\n✅ Done. Log saved to ${logFile}`);
    process.exit(0);
}, 20000);
