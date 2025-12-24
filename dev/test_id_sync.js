const midi = require('midi');
const output = new midi.Output();
const input = new midi.Input();

let portIdx = -1;
for (let i = 0; i < output.getPortCount(); i++) {
    if (output.getPortName(i).includes('01V96')) { portIdx = i; break; }
}
if (portIdx === -1) process.exit();

output.openPort(portIdx);
input.openPort(portIdx);
input.ignoreTypes(false, false, false);

input.on('message', (deltaTime, message) => {
    console.log(`📥 RX: ${message.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
});

console.log("Versuche Parameter Request mit Device ID 0 (Header 43 30)...");
// Laut deinem Dump (F0 43 00 7E) ist das Pult ID 0 oder 1.
// Request Header für Parameter ist 43 3n.
const msg = [0xF0, 0x43, 0x30, 0x3E, 0x7F, 0x01, 0x1C, 0x00, 0x00, 0xF7];
output.sendMessage(msg);

setTimeout(() => {
    console.log("\nVersuche alternative Device ID (Header 43 3D)...");
    output.sendMessage([0xF0, 0x43, 0x3D, 0x3E, 0x7F, 0x01, 0x1C, 0x00, 0x00, 0xF7]);
}, 1000);

setTimeout(() => {
    console.log("\nVersuche Bulk Request für Kanal Namen (Block 'Q')...");
    // F0 43 20 7E 4C 4D 20 20 38 43 39 33 51 F7
    output.sendMessage([0xF0, 0x43, 0x20, 0x7E, 0x4C, 0x4D, 0x20, 0x20, 0x38, 0x43, 0x39, 0x33, 0x51, 0xF7]);
}, 2000);

setTimeout(() => {
    output.closePort();
    input.closePort();
    console.log("\nTest beendet.");
}, 5000);
