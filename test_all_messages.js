// Test - Capture ALL MIDI messages from Yamaha
// Shows exactly what the console sends

const midi = require('midi');

console.log('=== YAMAHA 01V96 V2 - ALL MIDI MESSAGES ===\n');

const input = new midi.Input();
const output = new midi.Output();

// Find Yamaha
let port = -1;
for (let i = 0; i < output.getPortCount(); i++) {
    if (output.getPortName(i).includes('YAMAHA')) {
        port = i;
        break;
    }
}

if (port === -1) {
    console.error('❌ Yamaha not found');
    process.exit(1);
}

input.openPort(port);
output.openPort(port);

console.log('✓ Connected to Yamaha on port', port);
console.log('\n🎚️ Move faders, press buttons on the console...');
console.log('All incoming messages will be decoded below:\n');
console.log('═══════════════════════════════════════════════════════════\n');

let count = 0;

input.on('message', (deltaTime, message) => {
    count++;
    const [status, data1, data2] = message;
    const statusType = status & 0xF0;
    const channel = (status & 0x0F) + 1;
    const hex = message.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    const time = new Date().toLocaleTimeString();

    let decoded = '';

    // Decode message type
    switch (statusType) {
        case 0x80: // Note Off
            decoded = `NOTE OFF ch${channel} note:${data1} vel:${data2}`;
            break;
        case 0x90: // Note On
            decoded = `NOTE ON ch${channel} note:${data1} vel:${data2}`;
            break;
        case 0xA0: // Poly Pressure
            decoded = `POLY PRESSURE ch${channel} note:${data1} pressure:${data2}`;
            break;
        case 0xB0: // Control Change
            decoded = `CC ch${channel} #${data1} = ${data2}`;
            break;
        case 0xC0: // Program Change
            decoded = `PROG CHANGE ch${channel} program:${data1}`;
            break;
        case 0xD0: // Channel Pressure
            decoded = `CHANNEL PRESSURE ch${channel} pressure:${data1}`;
            break;
        case 0xE0: // Pitch Bend
            decoded = `PITCH BEND ch${channel} value:${((data2 << 7) | data1)}`;
            break;
        case 0xF0: // System message
            if (status === 0xF0) {
                decoded = `SYSEX [${message.length} bytes]`;
            } else if (status === 0xF1) {
                decoded = `TIME CODE QUARTER FRAME`;
            } else if (status === 0xF2) {
                decoded = `SONG POSITION POINTER`;
            } else if (status === 0xF3) {
                decoded = `SONG SELECT`;
            } else if (status === 0xF6) {
                decoded = `TUNE REQUEST`;
            } else if (status === 0xF8) {
                decoded = `TIMING CLOCK`;
            } else if (status === 0xFA) {
                decoded = `START`;
            } else if (status === 0xFB) {
                decoded = `CONTINUE`;
            } else if (status === 0xFC) {
                decoded = `STOP`;
            } else if (status === 0xFE) {
                decoded = `ACTIVE SENSING`;
            } else if (status === 0xFF) {
                decoded = `SYSTEM RESET`;
            } else {
                decoded = `SYSTEM 0x${status.toString(16).toUpperCase()}`;
            }
            break;
        default:
            decoded = `UNKNOWN 0x${status.toString(16).toUpperCase()}`;
    }

    console.log(`[${time}] #${count.toString().padStart(3)} | ${hex.padEnd(20)} | ${decoded}`);
});

console.log('Press Ctrl+C to stop\n');

process.on('SIGINT', () => {
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log(`Total messages: ${count}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    if (count === 0) {
        console.log('❌ No messages received!');
        console.log('\nPossible reasons:');
        console.log('1. PARAMETER CHANGE might be OFF (need to turn it ON)');
        console.log('2. Console not sending data');
        console.log('3. Wrong port selected\n');
    } else {
        console.log('✓ Messages received! Check the types above.');
        console.log('   If you see CC messages, CONTROL CHANGE is working.');
        console.log('   If you see other types (PROG, NOTE, etc), that\'s what we need to listen for.\n');
    }

    input.closePort();
    output.closePort();
    process.exit(0);
});
