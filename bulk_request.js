
const midi = require('midi');
const input = new midi.Input();
const output = new midi.Output();

// Finde Port 1
let port = -1;
for (let i = 0; i < input.getPortCount(); i++) {
    if (input.getPortName(i).includes('Port1')) {
        port = i; break;
    }
}
if (port === -1) process.exit(1);

input.openPort(port);
output.openPort(port);
input.ignoreTypes(false, false, false);

console.log('=== YAMAHA 01V96 - BULK METER REQUEST ===');
console.log('Sende verschiedene "GIB MIR DATEN" Befehle...\n');

input.on('message', (delta, msg) => {
    if (msg[0] === 0xFE || msg[0] === 0xF8) return;
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    // Ignoriere typische Heartbeats
    if (hex.includes('0D 7F F7')) return;

    console.log(`[RECV] ${hex}`);
});

const bulkRequests = [
    // Standard Bulk Dump Request
    [0xF0, 0x43, 0x20, 0x3E, 0x0E, 0x00, 0xF7],

    // Meter Request A (oft genutzt)
    [0xF0, 0x43, 0x20, 0x3E, 0x19, 0x04, 0xF7],

    // Meter Request B
    [0xF0, 0x43, 0x20, 0x3E, 0x1A, 0x04, 0xF7],

    // Remote Meter On
    [0xF0, 0x43, 0x30, 0x3E, 0x11, 0x00, 0xF7],
];

let idx = 0;
setInterval(() => {
    if (idx < bulkRequests.length) {
        const req = bulkRequests[idx];
        const hex = req.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
        console.log(`Sending: ${hex}`);
        output.sendMessage(req);
        idx++;
    } else {
        console.log('Alle Requests gesendet. Warte auf Antwort...');
        idx = 0; // Loop again? Maybe once is enough.
    }
}, 2000);

setInterval(() => { }, 1000);
