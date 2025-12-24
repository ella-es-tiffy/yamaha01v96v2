const midi = require('midi');
const fs = require('fs');

const input = new midi.Input();
const output = new midi.Output();

let portFound = false;
for (let i = 0; i < input.getPortCount(); i++) {
    const name = input.getPortName(i);
    if (name.includes('Port1')) {
        input.openPort(i);
        output.openPort(i);
        portFound = true;
        console.log(`Listening on ${name}`);
        break;
    }
}

if (!portFound) {
    console.log("Port 1 not found.");
    process.exit(1);
}

console.log("Searching for 'test' preset...");

input.on('message', (delta, msg) => {
    // Check for LM signature for EQ (8C93Q or similar)
    // We'll look for the name "test" specifically in the data payload
    if (msg.length > 20) {
        // Extract basic ASCII to see if we spot "test"
        const ascii = msg.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
        if (ascii.toLowerCase().includes('test')) {
            console.log(`\nPotential Match! Length: ${msg.length}`);
            console.log(`ASCII: ${ascii}`);
            console.log(`Hex: ${msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);

            // Try to extract ID
            // In LM blocks, ID is often at index 16
            if (msg[6] === 0x4C && msg[7] === 0x4D) {
                console.log(`Possible ID at index 16: ${msg[16]} (Decimal: ${msg[16]}) -> Preset #: ${msg[16] + 1}`);
            }
        }
    }
});

// Send Bulk Dump Request for EQ Library
// Format: F0 43 0n 3E 02 02 F7  (n = device ID, usually 0 or 2 for requests?)
// User logs showed F0 43 10 ... for incoming.
// Try variations.
const requests = [
    [0xF0, 0x43, 0x10, 0x3E, 0x02, 0x02, 0xF7],
    [0xF0, 0x43, 0x30, 0x3E, 0x02, 0x02, 0xF7],
    [0xF0, 0x43, 0x20, 0x3E, 0x02, 0x02, 0xF7],
    // Also try specific slot requests around where user presets usually are (41+)
    // F0 43 10 3E 0E 02 [ID] F7
];

requests.forEach((req, idx) => {
    setTimeout(() => {
        console.log(`Sending Req ${idx}: ${req.map(b => b.toString(16)).join(' ')}`);
        output.sendMessage(req);
    }, idx * 1000);
});

// Scan slots 41-60 individually
setTimeout(() => {
    console.log("Scanning individual slots 41-70...");
    for (let i = 40; i < 70; i++) {
        output.sendMessage([0xF0, 0x43, 0x10, 0x3E, 0x0E, 0x02, i, 0xF7]);
    }
}, 4000);

setTimeout(() => {
    console.log("Done listening.");
    process.exit(0);
}, 10000);
