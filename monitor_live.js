// Live MIDI Monitor for Yamaha 01V96 V2
// Monitors ALL 8 ports simultaneously and decodes MIDI messages

const midi = require('midi');

console.log('=== YAMAHA 01V96 V2 - LIVE MIDI MONITOR ===\n');

// Create inputs for all 8 ports
const inputs = [];
const outputs = [];

// Setup all 8 input ports
for (let port = 0; port < 8; port++) {
    const input = new midi.Input();
    const portName = input.getPortName(port);

    if (portName && portName.includes('YAMAHA 01V96')) {
        input.openPort(port);
        inputs.push({ port, input, name: portName });
        console.log(`✓ Listening on ${portName}`);

        // Setup message handler
        input.on('message', (deltaTime, message) => {
            decodeMidiMessage(port + 1, message, deltaTime);
        });
    }

    // Setup output port
    const output = new midi.Output();
    if (output.getPortName(port) && output.getPortName(port).includes('YAMAHA 01V96')) {
        outputs.push({ port, output });
    }
}

console.log('\n--- Move faders, turn knobs, or press buttons on the console ---');
console.log('--- Press Ctrl+C to stop ---\n');

// MIDI Message Decoder
function decodeMidiMessage(portNum, message, deltaTime) {
    const [status, data1, data2] = message;
    const statusType = status & 0xF0;
    const channel = (status & 0x0F) + 1;

    let decoded = '';

    switch (statusType) {
        case 0x80: // Note Off
            decoded = `Note OFF: ${data1} (velocity: ${data2})`;
            break;
        case 0x90: // Note On
            decoded = `Note ON: ${data1} (velocity: ${data2})`;
            break;
        case 0xB0: // Control Change
            decoded = `CC: #${data1} = ${data2} (${getControlName(data1)})`;
            break;
        case 0xC0: // Program Change
            decoded = `Program Change: ${data1}`;
            break;
        case 0xE0: // Pitch Bend
            const pitchValue = (data2 << 7) | data1;
            decoded = `Pitch Bend: ${pitchValue} (${pitchValue - 8192})`;
            break;
        case 0xF0: // System messages
            if (status === 0xF0) {
                decoded = `SysEx: [${message.join(', ')}]`;
            } else {
                decoded = `System: 0x${status.toString(16).toUpperCase()}`;
            }
            break;
        default:
            decoded = `Unknown: 0x${status.toString(16).toUpperCase()}`;
    }

    const timestamp = new Date().toLocaleTimeString();
    const hex = message.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    console.log(`[${timestamp}] Port ${portNum} | Ch ${channel} | ${decoded}`);
    console.log(`           Raw: ${hex} | Δt: ${deltaTime.toFixed(2)}ms\n`);
}

// Control Change names (common MIDI CC)
function getControlName(cc) {
    const ccNames = {
        1: 'Modulation',
        7: 'Volume',
        10: 'Pan',
        11: 'Expression',
        64: 'Sustain Pedal',
        71: 'Resonance',
        72: 'Release Time',
        73: 'Attack Time',
        74: 'Cutoff',
        91: 'Reverb',
        93: 'Chorus',
    };
    return ccNames[cc] || `Controller ${cc}`;
}

// Test: Send a query to get current state
if (outputs.length > 0) {
    console.log('Sending parameter request to Port 1...\n');
    outputs[0].output.openPort(0);

    // Request current fader positions (this is mixer-specific, might not work)
    // Yamaha uses NRPN for parameter access
    // We'll try to request some basic info

    outputs[0].output.closePort();
}

// Keep process running
process.on('SIGINT', () => {
    console.log('\n\n=== Shutting down ===');
    inputs.forEach(({ input }) => input.closePort());
    outputs.forEach(({ output }) => {
        try {
            output.closePort();
        } catch (e) {}
    });
    process.exit(0);
});
