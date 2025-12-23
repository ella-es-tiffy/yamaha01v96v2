const midi = require('midi');
const input = new midi.Input();
const output = new midi.Output();

const portName = 'YAMAHA 01V96 Port1';
let portIdx = -1;

for (let i = 0; i < output.getPortCount(); i++) {
    if (output.getPortName(i).includes(portName)) portIdx = i;
}

if (portIdx === -1) {
    console.log('❌ Port not found!');
    process.exit(1);
}

try {
    input.openPort(portIdx);
    output.openPort(portIdx);
    input.ignoreTypes(false, false, false);
    console.log('✅ Port opened on index:', portIdx);

    input.on('message', (t, msg) => {
        console.log('RX:', msg.map(b => b.toString(16).padStart(2, '0')).join(' '));
    });

    console.log('📤 Trying 10-byte request (Area 00)...');
    output.sendMessage([0xF0, 0x43, 0x30, 0x3E, 0x7F, 0x01, 0x00, 0x00, 0x1C, 0xF7]);

    setTimeout(() => {
        console.log('📤 Trying 11-byte request (Area 01)...');
        output.sendMessage([0xF0, 0x43, 0x30, 0x3E, 0x7F, 0x01, 0x01, 0x00, 0x00, 0x1C, 0xF7]);
    }, 500);

    setTimeout(() => {
        console.log('Done.');
        process.exit(0);
    }, 2000);
} catch (e) {
    console.error('❌ Error:', e.message);
}
