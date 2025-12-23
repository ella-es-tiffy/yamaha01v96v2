// Test ALL Yamaha Ports simultaneously
// Listen on ALL 8 ports at once

const midi = require('midi');

console.log('=== YAMAHA 01V96 V2 - TEST ALL PORTS ===\n');

// Find all Yamaha ports
const ports = [];
const output = new midi.Output();

console.log('Available MIDI ports:');
for (let i = 0; i < output.getPortCount(); i++) {
    const name = output.getPortName(i);
    if (name.includes('YAMAHA')) {
        ports.push({ index: i, name: name });
        console.log(`  ✓ [${i}] ${name}`);
    }
}

if (ports.length === 0) {
    console.error('\n❌ No Yamaha ports found!');
    process.exit(1);
}

console.log(`\n✓ Found ${ports.length} Yamaha ports\n`);

// Open ALL ports
const inputs = [];
const portMap = {};

ports.forEach(port => {
    const input = new midi.Input();
    try {
        input.openPort(port.index);
        inputs.push(input);
        portMap[port.index] = port.name;
        console.log(`✓ Opened input: ${port.name}`);

        // Setup listener for this port
        input.on('message', (deltaTime, message) => {
            const hex = message.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
            const time = new Date().toLocaleTimeString();
            console.log(`[${time}] PORT ${port.index} (${port.name}): ${hex}`);
        });
    } catch (error) {
        console.error(`❌ Failed to open port ${port.index}: ${error.message}`);
    }
});

console.log(`\n═══════════════════════════════════════════════════════════`);
console.log('Now move faders and press buttons on the Yamaha console');
console.log('Messages from ANY port will show up below:');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Listening on all ports... (Press Ctrl+C to stop)\n');

let messageCount = 0;
const originalLog = console.log;
const logWrapper = function(...args) {
    if (args[0] && args[0].includes('PORT')) {
        messageCount++;
    }
    originalLog.apply(console, args);
};
console.log = logWrapper;

process.on('SIGINT', () => {
    console.log = originalLog;
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log(`Total messages: ${messageCount}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    if (messageCount === 0) {
        console.log('❌ No MIDI messages received on any port!');
        console.log('\nThis means:');
        console.log('1. The Yamaha is not transmitting MIDI data');
        console.log('2. Or the USB connection has an issue');
        console.log('3. Or the PARAMETER CHANGE transmission is disabled\n');
        console.log('Check on the Yamaha:');
        console.log('- SETUP → MIDI/HOST');
        console.log('- Make sure PARAMETER CHANGE is ON');
        console.log('- Check if Tx PORT is correctly set\n');
    } else {
        console.log(`✓ Received ${messageCount} messages!`);
        console.log('The Yamaha is communicating successfully!\n');
    }

    inputs.forEach(input => {
        try {
            input.closePort();
        } catch (e) {}
    });

    process.exit(0);
});
