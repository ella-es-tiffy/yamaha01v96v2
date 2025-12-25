const midi = require('midi');
const fs = require('fs');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║        YAMAHA STUDIO MANAGER MIDI SNIFFER v1.0             ║');
console.log('║  Captures ALL MIDI traffic to reverse engineer commands   ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const input = new midi.Input();
const logFile = '/Users/tiffy/html/neko/yamaha_midi/dev/studio_manager_sniff.log';
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Find 01V96 port
let portIdx = -1;
for (let i = 0; i < input.getPortCount(); i++) {
    const name = input.getPortName(i);
    if (name.includes('01V96') || name.includes('Port1')) {
        portIdx = i;
        console.log(`✓ Found mixer: ${name}`);
        break;
    }
}

if (portIdx === -1) {
    console.error('✗ No 01V96 MIDI port found!');
    process.exit(1);
}

console.log(`✓ Logging to: ${logFile}`);
console.log('\n┌─ INSTRUCTIONS ──────────────────────────────────────────┐');
console.log('│ 1. Start Yamaha Studio Manager                          │');
console.log('│ 2. Connect Studio Manager to the 01V96                   │');
console.log('│ 3. Use Studio Manager to browse EQ Library              │');
console.log('│ 4. Watch MIDI messages appear below in REAL-TIME        │');
console.log('│ 5. Press CTRL+C when done                               │');
console.log('└──────────────────────────────────────────────────────────┘\n');

const startTime = Date.now();
let msgCount = 0;

function log(msg) {
    console.log(msg);
    logStream.write(msg + '\n');
}

log(`\n=== SESSION START: ${new Date().toISOString()} ===\n`);

input.on('message', (deltaTime, message) => {
    msgCount++;
    const timestamp = ((Date.now() - startTime) / 1000).toFixed(3);
    const hex = message.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

    // Detect message type
    let type = 'DATA';
    if (message[0] === 0xF0) {
        type = 'SYSEX';

        // Detect specific SysEx types
        if (message.length > 6 && message[1] === 0x43 && message[3] === 0x3E) {
            const cmd = message[4];
            if (cmd === 0x0E) type = 'SYSEX-BULK-REQ';
            if (cmd === 0x7F) type = 'SYSEX-PARAM';
            if (cmd === 0x0D) type = 'SYSEX-KEY';
        }

        // Detect LM (Library) messages
        if (message.length > 8 && message[7] === 0x4C && message[8] === 0x4D) {
            type = 'SYSEX-LIBRARY';

            // Try to extract name if it's a Q block
            if (message[15] === 0x51) {
                const id = message[17];
                let name = '';
                for (let i = 20; i < 36 && i < message.length; i++) {
                    const c = message[i];
                    if (c >= 32 && c < 127) name += String.fromCharCode(c);
                }
                name = name.trim();
                type = `SYSEX-EQ-PRESET[${id + 1}="${name}"]`;
            }
        }
    }

    const logLine = `[${timestamp.padStart(8, '0')}s] [${msgCount.toString().padStart(4, '0')}] ${type.padEnd(30, ' ')} | ${hex}`;
    log(logLine);

    // Highlight important messages
    if (type.includes('BULK-REQ')) {
        console.log('  ↑ BULK REQUEST - CHECK THIS! May trigger library dump');
    }
    if (type.includes('EQ-PRESET')) {
        console.log('  ↑ EQ PRESET FOUND - This is what we want!');
    }
});

input.openPort(portIdx);

console.log('🎧 LISTENING... (Press CTRL+C to stop)\n');

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n┌─ SESSION SUMMARY ───────────────────────────────────────┐');
    console.log(`│ Total messages captured: ${msgCount.toString().padStart(4, ' ')}                          │`);
    console.log(`│ Session duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s                               │`);
    console.log(`│ Log saved to: studio_manager_sniff.log              │`);
    console.log('└──────────────────────────────────────────────────────────┘\n');
    log(`\n=== SESSION END: ${new Date().toISOString()} ===\n`);
    logStream.end();
    input.closePort();
    process.exit(0);
});
