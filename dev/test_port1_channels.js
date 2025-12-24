// Test Port 1 with detailed channel monitoring
// The 8 "ports" might actually be 8 MIDI channels on a single USB endpoint

const midi = require('midi');

console.log('=== YAMAHA 01V96 V2 - PORT 1 DEEP DIVE ===\n');

const input = new midi.Input();
const output = new midi.Output();

// Get all ports
const ports = [];
for (let i = 0; i < output.getPortCount(); i++) {
    const name = output.getPortName(i);
    if (name.includes('YAMAHA')) {
        ports.push({ index: i, name: name });
    }
}

console.log('Available Yamaha ports:');
ports.forEach(p => console.log(`  [${p.index}] ${p.name}`));

// We want PORT 1 - that's index 0 or 1?
// Let's try BOTH interpretations

console.log('\n✓ Opening Port 1 (index 0 - YAMAHA 01V96 Port1)');
input.openPort(0);
output.openPort(0);

console.log('\n═══════════════════════════════════════════════════════════');
console.log('Monitoring ALL MIDI messages on Port 1 with ALL info');
console.log('═══════════════════════════════════════════════════════════\n');

let messageCount = 0;
const messages = [];

input.on('message', (deltaTime, message) => {
    messageCount++;
    const [status, data1, data2] = message;
    const channel = (status & 0x0F) + 1;
    const statusType = status & 0xF0;
    const hex = message.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    const time = new Date().toLocaleTimeString();

    const info = {
        number: messageCount,
        time: time,
        raw: hex,
        channel: channel,
        statusType: `0x${statusType.toString(16).toUpperCase()}`,
        data1: data1,
        data2: data2,
        deltaTime: deltaTime
    };

    messages.push(info);

    // Decode message type
    let type = '?';
    if (statusType === 0x80) type = 'NOTE_OFF';
    else if (statusType === 0x90) type = 'NOTE_ON';
    else if (statusType === 0xB0) type = 'CC';
    else if (statusType === 0xC0) type = 'PROG_CHANGE';
    else if (statusType === 0xE0) type = 'PITCH_BEND';
    else if (statusType === 0xD0) type = 'CHANNEL_PRESSURE';
    else if (statusType === 0xF0) type = 'SYSEX';

    console.log(`[${time}] #${messageCount.toString().padStart(3)} | Ch${channel.toString().padStart(2)} | ${type.padEnd(12)} | ${hex}`);
    if (type === 'CC') {
        console.log(`           └─ CC #${data1.toString().padStart(3)} = ${data2.toString().padStart(3)}`);
    }
});

console.log('Move faders and buttons on the console... Press Ctrl+C when done\n');

let startTime = Date.now();

process.on('SIGINT', () => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log(`Results after ${elapsed}s`);
    console.log('═══════════════════════════════════════════════════════════\n');

    if (messageCount === 0) {
        console.log('❌ NO MESSAGES RECEIVED\n');
        console.log('This could mean:');
        console.log('1. The Yamaha is not transmitting on this port');
        console.log('2. Try opening a different port index (1, 2, 3, etc.)');
        console.log('3. The data might be on a different MIDI channel');
        console.log('4. USB connection issue\n');

        console.log('Next: Try running with different port indices or check USB directly');
    } else {
        console.log(`✓ ${messageCount} messages received!\n`);
        console.log('Message Summary:');

        // Group by channel
        const byChannel = {};
        messages.forEach(m => {
            if (!byChannel[m.channel]) byChannel[m.channel] = 0;
            byChannel[m.channel]++;
        });

        console.log('By MIDI Channel:');
        Object.keys(byChannel).sort((a, b) => a - b).forEach(ch => {
            console.log(`  Channel ${ch}: ${byChannel[ch]} messages`);
        });

        console.log('\nFirst 10 messages:');
        messages.slice(0, 10).forEach(m => {
            console.log(`  #${m.number} Ch${m.channel} ${m.statusType} ${m.raw}`);
        });

        console.log('\nLast 10 messages:');
        messages.slice(-10).forEach(m => {
            console.log(`  #${m.number} Ch${m.channel} ${m.statusType} ${m.raw}`);
        });
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');

    input.closePort();
    output.closePort();
    process.exit(0);
});

// Also test sending data
console.log('Sending test message in 2 seconds...\n');
setTimeout(() => {
    console.log('📤 Sending CC #7 (Volume) = 100 on Channel 1');
    output.sendMessage([0xB0, 0x07, 100]);
}, 2000);
