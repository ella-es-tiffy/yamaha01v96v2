const midi = require('midi');
const fs = require('fs');

const input = new midi.Input();
const output = new midi.Output();

let portFound = false;
for (let i = 0; i < input.getPortCount(); i++) {
    if (input.getPortName(i).includes('Port1')) {
        input.openPort(i);
        output.openPort(i);
        portFound = true;
        break;
    }
}

if (!portFound) {
    console.error("❌ Port 1 not found!");
    process.exit(1);
}

const dumpFile = 'dev/hunt_flash_dump_full.txt';
const fd = fs.openSync(dumpFile, 'w');

console.log(`📡 Connected. Requesting FULL EQ LIBRARY DUMP...`);

input.on('message', (delta, msg) => {
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    fs.writeSync(fd, hex + '\n');

    // Check for LM  8C93Q (EQ Library Block)
    if (msg.length > 20 && msg[6] === 0x4C && msg[7] === 0x4D && msg[14] === 0x51) {
        const id = msg[16];
        const nameBytes = msg.slice(20, 35);
        const name = nameBytes.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '').join('').trim();

        if (name.toLowerCase().includes('flash')) {
            console.log(`\n🎯 TARGET FOUND!`);
            console.log(`Preset Name: "${name}"`);
            console.log(`Mixer ID (Hex): 0x${id.toString(16).toUpperCase().padStart(2, '0')}`);
            console.log(`Mixer ID (Dec): ${id}`);
            console.log(`UI Number: ${id + 1}`);
        } else if (name.length > 0) {
            console.log(`Found Preset: ID=${id} (Nr=${id + 1}) Name="${name}"`);
        }
    }
});

// Trigger EQ Library Bulk Dump Request
// F0 43 10 3E 02 02 F7 (Request Library Slot 0x02 = EQ)
const request = [0xF0, 0x43, 0x10, 0x3E, 0x02, 0x02, 0xF7];
output.sendMessage(request);

console.log("⏳ Waiting 15 seconds for bulk data transfer...");
setTimeout(() => {
    fs.closeSync(fd);
    console.log(`\n✅ Finished. If "flash" was not printed above, it wasn't in the dump.`);
    process.exit(0);
}, 15000);
