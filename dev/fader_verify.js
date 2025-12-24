
const midi = require('midi');
const output = new midi.Output();
let port = -1;
for (let i = 0; i < output.getPortCount(); i++) if (output.getPortName(i).includes('Port1')) port = i;
if (port === -1) process.exit(1);
output.openPort(port);

// Confirming Method 2 (B2 11/31) by moving Fader 1 UP then DOWN
console.log('Sending UP via B2 11/31...');
// UP (Value ~ 900)
// 900 >> 7 = 7
// 900 & 7F = 4
output.sendMessage([0xB2, 0x11, 7]);
output.sendMessage([0xB2, 0x31, 4]);

setTimeout(() => {
    console.log('Sending DOWN via B2 11/31...');
    // DOWN (Value 0)
    output.sendMessage([0xB2, 0x11, 0]);
    output.sendMessage([0xB2, 0x31, 0]);
}, 1000);

setTimeout(() => {
    console.log('Checking MUTE via B2 0D (Example for Ch1?)...');
    // If Logic holds:
    // GainCC=01, FaderCC=11 (Diff 16?)
    // EQ OnCC=59.
    // Let's try MUTE. If Fader is 17 (0x11), maybe Mute is 10 (0x0A)? 
    // Or maybe Mute is SysEx only?
    // Let's try sending Mute Ch1 Off/On via SysEx (maybe param ID was wrong)
    // SysEx Mute: 0x1A?
    output.sendMessage([0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x01, 0x01, 0x00, 0x00, 0x1A, 0x00, 0x01, 0xF7]); // Mute OFF? (1=On?)

    // Also try CC Mute? Maybe CC 10?
    // output.sendMessage([0xB2, 0x0A, 127]);
}, 2000);

setTimeout(() => Promise.resolve(output.closePort()), 3000);
