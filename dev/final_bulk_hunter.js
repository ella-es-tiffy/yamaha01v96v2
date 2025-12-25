const midi = require('midi');
const fs = require('fs');

const input = new midi.Input();
const output = new midi.Output();

// Logic from yamaha_controller.js connect()
let portIndex = -1;
const portCount = input.getPortCount();
for (let i = 0; i < portCount; i++) {
    const name = input.getPortName(i);
    console.log(`Checking Port ${i}: ${name}`);
    if (name.includes('Port1') || name.includes('01V96 Port1')) {
        portIndex = i;
        break;
    }
}

if (portIndex === -1) {
    console.log("❌ Port 1 NOT found. Using Port 0 as fallback.");
    portIndex = 0;
}

console.log(`📡 Opening Port ${portIndex} for Bulk Dump Capture...`);
input.openPort(portIndex);
// Don't ignore SysEx! (types: Sysex, Time, Sensing)
input.ignoreTypes(false, false, false);

const dumpFile = 'dev/final_bulk_capture.txt';
const fd = fs.openSync(dumpFile, 'w');

console.log("🟢 READY! Please trigger 'Transmit' on the Mixer now.");
console.log("   (Waiting for 'test' in the stream...)");

let found = false;

input.on('message', (delta, msg) => {
    // Log hex to file
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    fs.writeSync(fd, hex + '\n');

    // Parse for "test"
    const ascii = msg.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
    if (ascii.toLowerCase().includes('test')) {
        console.log(`\n🔥 MATCH FOUND! "test" detected!`);
        console.log(`   Length: ${msg.length}`);

        // Check for Yamaha LM signature (Header: F0 43 00 7E ... 4C 4D ...)
        // The LM header "LM  8C93Q" is typical for EQ.
        // Q = 0x51.

        // Scan for the name "test" in the message and backtrack to find the ID
        // In these dumps, the ID is often at a fixed offset relative to the name.
        // For EQ Library: Header is 20 bytes. Name starts at offset 20. ID is at offset 16.
        // Let's print the relevant bytes.

        // Usually: F0 43 [ID] 7E [Count] [Type] L M [ver] 8 C 9 3 [TypeChar] [Sw] [ID_High?] [ID_Low/UserNum] ...
        // If it's the standard bulk format:
        // Byte 16 (0-indexed) is often the Preset Number (0-based) for User Banks.

        if (msg.length > 20) {
            const potentialID = msg[16];
            const headerSig = msg.slice(6, 8); // Should be 4C 4D (LM)
            console.log(`   Header Sig (bytes 6-7): ${headerSig.map(b => b.toString(16)).join(' ')}`);
            console.log(`   Potential ID at Byte 16: 0x${potentialID.toString(16).toUpperCase()} (${potentialID})`);
            console.log(`   -> This would be Preset Number: ${potentialID + 1}`);
        }
        found = true;
    }
});

// Auto-exit after 60s
setTimeout(() => {
    console.log(found ? "\n✅ Capture finished. 'test' was found!" : "\n❌ Timeout. 'test' not seen.");
    fs.closeSync(fd);
    process.exit(0);
}, 60000);
