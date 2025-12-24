const midi = require('midi');
const input = new midi.Input();
const output = new midi.Output();

let port = -1;
for (let i = 0; i < input.getPortCount(); i++) {
    if (input.getPortName(i).includes('Port1')) {
        port = i;
        break;
    }
}

if (port === -1) {
    console.log('Port not found');
    process.exit(1);
}

input.openPort(port);
output.openPort(port);
input.ignoreTypes(false, false, false);

console.log('=== MIDI SCANNER ACTIVE ===');
console.log('Listening on Port 1...\n');

let messageCount = 0;

input.on('message', (dt, msg) => {
    messageCount++;
    const hex = msg.map(b => b.toString(16).padStart(2, '0')).join(' ');

    // Check for meter data
    if (msg[0] === 0xF0 && msg[5] === 0x21) {
        console.log(`\n[${messageCount}] ⚡ METER DATA! Len:${msg.length}`);
        console.log(`    ${hex.slice(0, 100)}${msg.length > 30 ? '...' : ''}`);
    }
    // Other SysEx
    else if (msg[0] === 0xF0) {
        console.log(`\n[${messageCount}] [SYSEX] Len:${msg.length}`);
        console.log(`    ${hex.slice(0, 100)}${msg.length > 30 ? '...' : ''}`);
    }
    // Control Change
    else if ((msg[0] & 0xF0) === 0xB0) {
        console.log(`[${messageCount}] [CC] ${hex}`);
    }
    // Other
    else if (msg[0] !== 0xFE) { // Ignore Active Sensing
        console.log(`[${messageCount}] ${hex}`);
    }
});

// Send meter request every 5 seconds
const meterReq = [0xF0, 0x43, 0x30, 0x3E, 0x0D, 0x21, 0x00, 0x00, 0x00, 0x00, 32, 0xF7];
console.log('Sending meter request...\n');
output.sendMessage(meterReq);

setInterval(() => {
    output.sendMessage(meterReq);
}, 5000);
