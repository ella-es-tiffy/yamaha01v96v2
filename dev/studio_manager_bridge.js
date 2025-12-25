const midi = require('midi');
const fs = require('fs');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║     YAMAHA STUDIO MANAGER MIDI BRIDGE SNIFFER v2.0         ║');
console.log('║          Creates Virtual Port for Sniffing                 ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Create virtual MIDI ports
const virtualIn = new midi.Input();
const virtualOut = new midi.Output();

// Real mixer ports
const mixerOut = new midi.Output();
const mixerIn = new midi.Input();

const logFile = '/Users/tiffy/html/neko/yamaha_midi/dev/studio_manager_sniff.log';
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Find real 01V96 port
let portIdx = -1;
for (let i = 0; i < mixerOut.getPortCount(); i++) {
    const name = mixerOut.getPortName(i);
    if (name.includes('01V96') || name.includes('Port1')) {
        portIdx = i;
        console.log(`✓ Found real mixer: ${name}`);
        break;
    }
}

if (portIdx === -1) {
    console.error('✗ No 01V96 MIDI port found!');
    process.exit(1);
}

// Open connection to real mixer
mixerOut.openPort(portIdx);
mixerIn.openPort(portIdx);

// Create virtual ports
console.log('✓ Creating virtual MIDI ports...');
virtualOut.openVirtualPort('FROM SNIFFER (SM Input)'); // SM connects its INPUT here
virtualIn.openVirtualPort('TO SNIFFER (SM Output)');   // SM connects its OUTPUT here

console.log('✓ Logging to:', logFile);
console.log('\n┌─ SETUP INSTRUCTIONS ────────────────────────────────────┐');
console.log('│ 1. In Studio Manager MIDI settings:                     │');
console.log('│    - Input Port:  "FROM SNIFFER (SM Input)"             │');
console.log('│    - Output Port: "TO SNIFFER (SM Output)"              │');
console.log('│ 2. Browse EQ Library in Studio Manager                  │');
console.log('│ 3. ALL MIDI traffic will be logged here!                │');
console.log('│ 4. Press CTRL+C when done                               │');
console.log('└──────────────────────────────────────────────────────────┘\n');

const startTime = Date.now();
let msgCount = 0;

function log(msg) {
    console.log(msg);
    logStream.write(msg + '\n');
}

log(`\n=== SESSION START: ${new Date().toISOString()} ===\n`);

// SM → Virtual IN → Forward to Mixer OUT
virtualIn.on('message', (deltaTime, message) => {
    msgCount++;
    const timestamp = ((Date.now() - startTime) / 1000).toFixed(3);
    const hex = message.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

    let type = 'SM→MX';
    let annotation = '';

    if (message[0] === 0xF0 && message.length > 6) {
        if (message[4] === 0x0E) {
            type = 'SM→MX BULK-REQ ⚡';
            annotation = ' ← CHECK THIS!';
        }
        if (message[4] === 0x7F) type = 'SM→MX PARAM';
    }

    const logLine = `[${timestamp.padStart(8, '0')}s] ${type.padEnd(20, ' ')} | ${hex}${annotation}`;
    log(logLine);

    // Forward to real mixer
    mixerOut.sendMessage(message);
});

// Mixer → Virtual OUT → Forward to SM
mixerIn.on('message', (deltaTime, message) => {
    msgCount++;
    const timestamp = ((Date.now() - startTime) / 1000).toFixed(3);
    const hex = message.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

    let type = 'MX→SM';
    let annotation = '';

    if (message[0] === 0xF0 && message.length > 8) {
        if (message[7] === 0x4C && message[8] === 0x4D && message[15] === 0x51) {
            const id = message[17];
            let name = '';
            for (let i = 20; i < 36 && i < message.length; i++) {
                const c = message[i];
                if (c >= 32 && c < 127) name += String.fromCharCode(c);
            }
            name = name.trim();
            type = `MX→SM EQ#${id + 1} ✓`;
            annotation = ` [${name}]`;
        }
    }

    const logLine = `[${timestamp.padStart(8, '0')}s] ${type.padEnd(20, ' ')} | ${hex}${annotation}`;
    log(logLine);

    // Forward to Studio Manager
    virtualOut.sendMessage(message);
});

console.log('🎧 BRIDGE ACTIVE... Waiting for Studio Manager connection\n');

process.on('SIGINT', () => {
    console.log('\n\n┌─ SESSION SUMMARY ───────────────────────────────────────┐');
    console.log(`│ Total messages: ${msgCount.toString().padStart(4, ' ')}                                    │`);
    console.log(`│ Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s                                       │`);
    console.log('└──────────────────────────────────────────────────────────┘\n');
    log(`\n=== SESSION END: ${new Date().toISOString()} ===\n`);
    logStream.end();
    virtualIn.closePort();
    virtualOut.closePort();
    mixerIn.closePort();
    mixerOut.closePort();
    process.exit(0);
});
