
const midi = require('midi');
const output = new midi.Output();

// Find Yamaha
let port = -1;
for (let i = 0; i < output.getPortCount(); i++) {
    if (output.getPortName(i).includes('Port1')) {
        port = i; break;
    }
}
if (port === -1) { console.log('No Port1 found'); process.exit(1); }

output.openPort(port);
console.log('Sending Test Fader 1 Moves...');

// TEST 1: SysEx ID 10 (Current)
console.log('Test 1: SysEx ID 10 (Current implementation)');
// Fader 1 -> 0dB (~800)
let v = 800;
output.sendMessage([0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x01, 0x01, 0x00, 0x00, 0x1C, (v >> 7) & 0x7F, v & 0x7F, 0xF7]);
setTimeout(() => {
    // TEST 2: CC Pair 17/49 on B2 (Channel 3) - LIKE EQ
    console.log('Test 2: CC Pair 17/49 on B2 (Like EQ Gain)');
    // Fader 1 -> -10dB (lower value)
    v = 600;
    // B2 11 MSB
    // B2 31 LSB
    output.sendMessage([0xB2, 0x11, (v >> 7) & 0x7F]); // MSB
    output.sendMessage([0xB2, 0x31, v & 0x7F]);        // LSB -- NO, 14bit LSB logic usually specific mapping
    // Usually LSB is value & 7F? Or mapped?
    // Let's assume standard MIDI
    output.sendMessage([0xB2, 0x31, 0x00]); // Just to trigger update with coarse
}, 1000);

setTimeout(() => {
    // TEST 3: CC Pair 1/33 on B0 (Channel 1) - Classic MIDI?
    console.log('Test 3: CC 1/33 on B0 (Channel 1)');
    v = 400;
    output.sendMessage([0xB0, 0x01, (v >> 7) & 0x7F]);
    output.sendMessage([0xB0, 0x21, 0x00]);
}, 2000);

setTimeout(() => {
    console.log('Done.');
    output.closePort();
}, 3000);
