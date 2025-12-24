const midi = require('midi');
const out = new midi.Output();
const inp = new midi.Input();

// Find Port 1
let port = -1;
for (let i = 0; i < out.getPortCount(); i++) {
    if (out.getPortName(i).includes('Port1')) {
        port = i;
        break;
    }
}

if (port === -1) {
    console.log('Port not found');
    process.exit(1);
}

out.openPort(port);
inp.openPort(port);
inp.ignoreTypes(false, false, false);

console.log('✓ Listening on Port 1...');

inp.on('message', (dt, msg) => {
    if (msg[0] === 0xF0) {
        console.log('SYSEX RX:', msg.map(b => b.toString(16).padStart(2, '0')).join(' '));
    }
});

// Try different meter request variants
const requests = [
    // Original
    [0xF0, 0x43, 0x30, 0x3E, 0x0D, 0x21, 0x00, 0x00, 0x00, 0x00, 0x20, 0xF7],
    // Try different addresses
    [0xF0, 0x43, 0x30, 0x3E, 0x0D, 0x21, 0x00, 0x00, 0x00, 0x00, 0x40, 0xF7],
    [0xF0, 0x43, 0x30, 0x3E, 0x0D, 0x21, 0x01, 0x00, 0x00, 0x00, 0x20, 0xF7],
    // Try device-specific command
    [0xF0, 0x43, 0x10, 0x3E, 0x0D, 0x21, 0x00, 0x00, 0x00, 0x00, 0x20, 0xF7],
];

async function tryRequests() {
    for (let i = 0; i < requests.length; i++) {
        console.log(`\nTrying variant ${i + 1}:`, requests[i].map(b => b.toString(16)).join(' '));
        out.sendMessage(requests[i]);
        await new Promise(r => setTimeout(r, 500));
    }

    console.log('\nDone. Waiting 5s for any response...');
    await new Promise(r => setTimeout(r, 5000));
    process.exit(0);
}

tryRequests();
