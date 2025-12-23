// Test MIDI Connection to Yamaha 01V96 V2
// Verifies bidirectional MIDI communication

const midi = require('midi');

console.log('=== YAMAHA 01V96 V2 MIDI Connection Test ===\n');

// Create input and output
const input = new midi.Input();
const output = new midi.Output();

// Find Yamaha port
let yamahaPort = -1;
console.log('Available MIDI ports:');
for (let i = 0; i < output.getPortCount(); i++) {
    const name = output.getPortName(i);
    console.log(`  [${i}] ${name}`);
    if (name.includes('YAMAHA')) {
        yamahaPort = i;
    }
}

if (yamahaPort === -1) {
    console.error('\n❌ ERROR: Yamaha not found!');
    process.exit(1);
}

console.log(`\n✓ Found Yamaha on port ${yamahaPort}\n`);

// Open ports
try {
    output.openPort(yamahaPort);
    input.openPort(yamahaPort);
    console.log('✓ Ports opened successfully\n');
} catch (error) {
    console.error('❌ Failed to open ports:', error.message);
    process.exit(1);
}

// Setup input listener
let messageCount = 0;
const messageLog = [];

input.on('message', (deltaTime, message) => {
    messageCount++;
    const timestamp = new Date().toLocaleTimeString();
    const hex = message.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    const line = `[${timestamp}] ${hex}`;

    messageLog.push(line);
    console.log(`📨 MIDI IN: ${line}`);

    // Keep last 50 messages
    if (messageLog.length > 50) {
        messageLog.shift();
    }
});

console.log('🎚️ TEST PROCEDURE:');
console.log('1. Move a fader on the Yamaha 01V96 V2');
console.log('2. Watch for incoming MIDI messages below');
console.log('3. Press Ctrl+C to stop\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('LISTENING FOR INCOMING MIDI MESSAGES...');
console.log('═══════════════════════════════════════════════════════════\n');

// Send a test message to Yamaha
console.log('Sending test CC message (CC#7 Volume = 100)...\n');
const testMsg = [0xB0, 0x07, 0x64]; // Channel 1, Volume CC, value 100
output.sendMessage(testMsg);
const hex = testMsg.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
console.log(`📤 MIDI OUT: ${hex}\n`);

// Status updates
setInterval(() => {
    console.log(`📊 Status: ${messageCount} messages received\n`);
}, 5000);

// Cleanup
process.on('SIGINT', () => {
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('TEST COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`Total messages received: ${messageCount}\n`);

    if (messageCount > 0) {
        console.log('✓ SUCCESS: Yamaha is sending MIDI data!\n');
        console.log('Last 10 messages:');
        messageLog.slice(-10).forEach(msg => console.log('  ' + msg));
    } else {
        console.log('❌ No messages received. Possible issues:');
        console.log('   1. Yamaha not sending MIDI data');
        console.log('   2. Yamaha MIDI output not configured');
        console.log('   3. USB connection issue');
        console.log('   4. VirtualHere bridge problem\n');

        console.log('Troubleshooting:');
        console.log('- Check Yamaha MIDI settings (MIDI/HOST setup)');
        console.log('- Verify Tx PORT is set to 1');
        console.log('- Check if VirtualHere is properly connected');
        console.log('- Try moving multiple faders on the console\n');
    }

    console.log('═══════════════════════════════════════════════════════════\n');

    input.closePort();
    output.closePort();
    process.exit(0);
});
