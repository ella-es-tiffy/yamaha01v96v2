
const midi = require('midi');

console.log('=== YAMAHA 01V96 PORT 1 TEST ===');

const input = new midi.Input();
const output = new midi.Output();

// Find Port 1 specifically
let portIndex = -1;
for (let i = 0; i < input.getPortCount(); i++) {
    const name = input.getPortName(i);
    // Looking for the first port generally named 'YAMAHA 01V96 Port1'
    if (name.includes('YAMAHA') && name.includes('Port1')) {
        portIndex = i;
        console.log(`Matched Port: [${i}] ${name}`);
        break;
    }
}

if (portIndex === -1) {
    // Fallback search
    for (let i = 0; i < input.getPortCount(); i++) {
        if (input.getPortName(i).includes('YAMAHA')) {
            portIndex = i;
            console.log(`Fallback Port: [${i}] ${input.getPortName(i)}`);
            break;
        }
    }
}

if (portIndex === -1) {
    console.error('No Yamaha port found.');
    process.exit(1);
}

// Open
input.openPort(portIndex);
output.openPort(portIndex); // Assuming input/output indices match (usually do on CoreMidi)

console.log('✓ Ports opened. Sending Universal Mystery Sysex (Identity Request)...');

// Universal Identity Request
output.sendMessage([0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7]);

console.log('Waiting for data... (Move a fader now!)');

input.on('message', (deltaTime, message) => {
    const hex = message.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    console.log(`DATA RECEIVED: ${hex}`);
});

// Force keep alive
setInterval(() => {}, 1000);
