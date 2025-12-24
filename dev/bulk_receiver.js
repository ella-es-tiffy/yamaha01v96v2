const midi = require('midi');
const fs = require('fs');

const input = new midi.Input();
for (let i = 0; i < input.getPortCount(); i++) {
    if (input.getPortName(i).includes('Port1')) {
        input.openPort(i);
        break;
    }
}

console.log("📥 Ready to receive Bulk Dump from Mixer... (Trigger it on the console now!)");
console.log("Looking for 'test' in the stream...");

const dumpFile = 'dev/manual_bulk_capture.txt';
const fd = fs.openSync(dumpFile, 'w');

input.on('message', (delta, msg) => {
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    fs.writeSync(fd, hex + '\n');

    // Check for "test"
    const ascii = msg.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
    if (ascii.toLowerCase().includes('test')) {
        console.log(`\n🎯 FOUND "test"!`);
        console.log(`Msg: ${hex}`);
        if (msg[6] === 0x4C && msg[7] === 0x4D) {
            console.log(`ID Byte (16): ${msg[16]} -> Nr: ${msg[16] + 1}`);
        }
    }
});

// Keep alive for 60s
setTimeout(() => {
    console.log("Timeout. Closing capture.");
    fs.closeSync(fd);
    process.exit(0);
}, 60000);
