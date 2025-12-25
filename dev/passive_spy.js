const midi = require('midi');

console.log('🕵️‍♀️ PASSIVE MIDI SPY - Listening on Port 1... (Press CTRL+C to stop)');

const input = new midi.Input();
let portIdx = -1;

for (let i = 0; i < input.getPortCount(); i++) {
    const name = input.getPortName(i);
    if (name.includes('01V96') || name.includes('Port1')) {
        portIdx = i;
        console.log(`Target: ${name}`);
        break;
    }
}

if (portIdx === -1) {
    console.log('No 01V96 found.');
    process.exit(1);
}

try {
    input.openPort(portIdx);
    console.log('✅ Port opened successfully! (Driver is Multi-Client)');
} catch (e) {
    console.error('❌ Failed to open port. Driver is Single-Client only.');
    console.error('   You MUST use the Bridge method if Studio Manager is running.');
    process.exit(1);
}

input.on('message', (dt, msg) => {
    // Only show SysEx (F0 ...)
    if (msg[0] === 0xF0) {
        console.log('SYSEX:', msg.map(b => b.toString(16).padStart(2, '0')).join(' '));
    }
});

// Keep alive
setInterval(() => { }, 1000);
