const midi = require('midi');

const input = new midi.Input();
const output = new midi.Output();

let portIndex = -1;
for (let i = 0; i < output.getPortCount(); i++) {
    if (output.getPortName(i).includes('YAMAHA 01V96 Port1')) {
        portIndex = i;
        console.log('✓ Found MIDI Port:', output.getPortName(i));
        break;
    }
}

if (portIndex === -1) {
    console.error('❌ YAMAHA 01V96 Port1 not found');
    process.exit(1);
}

output.openPort(portIndex);
input.openPort(portIndex);
input.ignoreTypes(false, false, false);

let meterCount = 0;
let otherCount = 0;

input.on('message', (dt, msg) => {
    // Check for meter data: message[5] === 0x21
    if (msg[0] === 0xF0 && msg[5] === 0x21) {
        meterCount++;
        console.log(`📊 METER DATA #${meterCount} - Length: ${msg.length} bytes`);
        console.log('   First 20 bytes:', msg.slice(0, 20).map(b => b.toString(16).padStart(2, '0')).join(' '));
        if (msg.length >= 71) {
            console.log('   ✓ Length OK (>=71)');
            // Show first 5 channel values
            for (let i = 0; i < 5; i++) {
                const val = msg[9 + (i * 2)];
                console.log(`   Ch${i + 1}: ${val}`);
            }
        } else {
            console.log('   ⚠️  Too short (echo?)');
        }
    } else {
        otherCount++;
        if (otherCount % 10 === 0) {
            console.log(`📨 Other messages: ${otherCount}`);
        }
    }
});

// Send meter request
const meterRequest = [0xF0, 0x43, 0x30, 0x3E, 0x0D, 0x21, 0x00, 0x00, 0x00, 0x00, 0x20, 0xF7];
console.log('📤 Sending meter request...');
output.sendMessage(meterRequest);

// Continue sending every 100ms
setInterval(() => {
    output.sendMessage(meterRequest);
}, 100);

console.log('🎧 Listening for meter data... (Ctrl+C to stop)');
console.log('    Make some noise on the mixer!');
