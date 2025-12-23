
const midi = require('midi');

const output = new midi.Output();
const input = new midi.Input();

// Find Yamaha Port 1
let port = -1;
for (let i = 0; i < output.getPortCount(); i++) {
    if (output.getPortName(i).includes('Port1')) {
        port = i;
        break;
    }
}

if (port === -1) {
    console.log('Yamaha Port 1 not found');
    process.exit(1);
}

console.log(`Connecting to Port ${port}: ${output.getPortName(port)}`);
output.openPort(port);
input.openPort(port);

input.on('message', (deltaTime, message) => {
    console.log('RECEIVED:', message.map(b => '0x' + b.toString(16).toUpperCase()).join(' '));
});

console.log('Attempting to move Fader 1 via NRPN...');
// NRPN for Fader 1 (Common 01V96 mapping: MSB 0x1C, LSB 0x00)
// Message: 0xB0 0x63 MSB, 0xB0 0x62 LSB, 0xB0 0x06 DataMSB, 0xB0 0x26 DataLSB
const channel = 0; // MIDI Channel 1
const base = 0xB0 | channel;

function sendNRPN(msb, lsb, valMsb, valLsb) {
    output.sendMessage([base, 0x63, msb]);
    output.sendMessage([base, 0x62, lsb]);
    output.sendMessage([base, 0x06, valMsb]);
    output.sendMessage([base, 0x26, valLsb]);
}

// Try to set Fader 1 to -oo (0)
console.log('Sending Fader 1 -> 0');
sendNRPN(0x1C, 0x00, 0x00, 0x00);

setTimeout(() => {
    // Try to set Fader 1 to 0dB (around 823 for 10-bit?)
    console.log('Sending Fader 1 -> 800');
    sendNRPN(0x1C, 0x00, 0x06, 0x20); // 0x06 << 7 | 0x20 = 768 + 32 = 800
}, 1000);

setTimeout(() => {
    console.log('Closing ports. Check if fader moved!');
    output.closePort();
    input.closePort();
    process.exit(0);
}, 3000);
