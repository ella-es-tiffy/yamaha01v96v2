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

const file = 'dev/bulk_dump_new_test.txt';
const fd = fs.openSync(file, 'w');

input.on('message', (delta, msg) => {
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    fs.writeSync(fd, hex + '\n');

    // Check for "test"
    const ascii = msg.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
    if (ascii.toLowerCase().includes('test')) {
        console.log(`🎯 FOUND "test" in stream! Len: ${msg.length}`);
        if (msg[6] === 0x4C && msg[7] === 0x4D) {
            console.log(`ID: ${msg[16]} (Nr: ${msg[16] + 1})`);
        }
    }
});

// Trigger FULL Bulk Dump
// Identity Request first
output.sendMessage([0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7]);
// Sequence of probe requests
setTimeout(() => output.sendMessage([0xF0, 0x43, 0x20, 0x7E, 0x4C, 0x4D, 0x20, 0x20, 0x38, 0x43, 0x39, 0x33, 0x53, 0x00, 0x00, 0xF7]), 500);
setTimeout(() => output.sendMessage([0xF0, 0x43, 0x20, 0x7E, 0x4C, 0x4D, 0x20, 0x20, 0x38, 0x43, 0x39, 0x33, 0x51, 0x00, 0x00, 0xF7]), 1500); // EQ Lib
setTimeout(() => output.sendMessage([0xF0, 0x43, 0x30, 0x7E, 0x4C, 0x4D, 0x20, 0x20, 0x38, 0x43, 0x39, 0x33, 0x51, 0x00, 0x00, 0xF7]), 2500); // EQ Lib V2

setTimeout(() => {
    fs.closeSync(fd);
    console.log("Done.");
    process.exit(0);
}, 20000);
