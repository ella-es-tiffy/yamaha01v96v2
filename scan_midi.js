// MIDI Port Scanner for Yamaha 01V96 V2
// This script scans for available MIDI devices and shows detailed information

const midi = require('midi');

console.log('=== MIDI INPUT PORTS ===');
const midiIn = new midi.Input();
const inputCount = midiIn.getPortCount();
console.log(`Found ${inputCount} MIDI input port(s):\n`);

for (let i = 0; i < inputCount; i++) {
    const portName = midiIn.getPortName(i);
    console.log(`[${i}] ${portName}`);
}

console.log('\n=== MIDI OUTPUT PORTS ===');
const midiOut = new midi.Output();
const outputCount = midiOut.getPortCount();
console.log(`Found ${outputCount} MIDI output port(s):\n`);

for (let i = 0; i < outputCount; i++) {
    const portName = midiOut.getPortName(i);
    console.log(`[${i}] ${portName}`);
}

// Test connection to Yamaha if found
console.log('\n=== SEARCHING FOR YAMAHA 01V96 ===');
let yamahaInputPort = -1;
let yamahaOutputPort = -1;

for (let i = 0; i < inputCount; i++) {
    const portName = midiIn.getPortName(i);
    if (portName.toLowerCase().includes('yamaha') || portName.toLowerCase().includes('01v96')) {
        yamahaInputPort = i;
        console.log(`✓ Found Yamaha INPUT on port ${i}: ${portName}`);
    }
}

for (let i = 0; i < outputCount; i++) {
    const portName = midiOut.getPortName(i);
    if (portName.toLowerCase().includes('yamaha') || portName.toLowerCase().includes('01v96')) {
        yamahaOutputPort = i;
        console.log(`✓ Found Yamaha OUTPUT on port ${i}: ${portName}`);
    }
}

if (yamahaInputPort === -1 && yamahaOutputPort === -1) {
    console.log('⚠ No Yamaha 01V96 MIDI ports detected');
    console.log('Make sure the device is connected and recognized by macOS Audio MIDI Setup');
} else {
    console.log('\n=== CONNECTION TEST ===');
    if (yamahaOutputPort !== -1) {
        console.log('Opening MIDI connection to Yamaha...');
        midiOut.openPort(yamahaOutputPort);

        // Send identity request (Universal SysEx)
        const identityRequest = [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7];
        console.log('Sending Identity Request:', identityRequest.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' '));
        midiOut.sendMessage(identityRequest);

        console.log('✓ Message sent successfully');
        midiOut.closePort();
    }

    if (yamahaInputPort !== -1) {
        console.log('Opening MIDI input for monitoring...');
        midiIn.openPort(yamahaInputPort);

        console.log('Listening for MIDI messages (5 seconds)...');
        console.log('Try moving a fader or pressing a button on the console...\n');

        midiIn.on('message', (deltaTime, message) => {
            console.log(`MIDI Message: [${message.join(', ')}] (0x${message.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' 0x')}) at t+${deltaTime}ms`);
        });

        setTimeout(() => {
            console.log('\n✓ Monitoring complete');
            midiIn.closePort();
            process.exit(0);
        }, 5000);
    } else {
        process.exit(0);
    }
}
