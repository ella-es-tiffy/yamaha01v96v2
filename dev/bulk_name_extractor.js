const fs = require('fs');
const midi = require('midi');

console.log('=== EQ Library Bulk Name Extractor ===');
console.log('Listening for bulk dumps...');
console.log('Press CTRL+C when done.\n');

const input = new midi.Input();
let portIndex = -1;

for (let i = 0; i < input.getPortCount(); i++) {
    const name = input.getPortName(i);
    if (name.includes('01V96') || name.includes('Port1')) {
        portIndex = i;
        console.log(`Found mixer on port ${i}: ${name}`);
        break;
    }
}

if (portIndex === -1) {
    console.error('No 01V96 MIDI port found!');
    process.exit(1);
}

const foundPresets = {};

input.on('message', (deltaTime, message) => {
    // Check for LM 8C93 Q signature
    if (message[0] === 0xF0 && message[1] === 0x43 &&
        message[7] === 0x4C && message[8] === 0x4D && // LM
        message[15] === 0x51) { // Q (EQ Library)

        const id = message[17]; // Preset ID

        // Remove Bit-Bytes
        const rawData = [];
        for (let i = 20; i < message.length - 1; i++) {
            if ((i - 20) % 8 === 0) continue; // Skip bit-bytes
            rawData.push(message[i]);
        }

        // Extract name (first 16 bytes)
        let name = "";
        for (let i = 0; i < 16 && i < rawData.length; i++) {
            const c = rawData[i];
            if (c >= 32 && c < 127) name += String.fromCharCode(c);
        }
        name = name.trim();

        if (name.length > 0) {
            foundPresets[id + 1] = name;
            console.log(`[${id + 1}] "${name}"`);
        }
    }
});

input.openPort(portIndex);

// Summary on exit
process.on('SIGINT', () => {
    console.log('\n=== SUMMARY ===');
    console.log(`Found ${Object.keys(foundPresets).length} named presets:`);

    Object.keys(foundPresets).sort((a, b) => a - b).forEach(id => {
        console.log(`  Preset ${id.toString().padStart(3, '0')}: "${foundPresets[id]}"`);
    });

    process.exit(0);
});
