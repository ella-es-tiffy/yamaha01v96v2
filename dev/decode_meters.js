
const midi = require('midi');

const input = new midi.Input();
input.openPort(0); // Port 1
input.ignoreTypes(false, false, false);

console.log('=== YAMAHA 01V96 - METER DATA DECODER ===');
console.log('Decoding Address 0x01 0x4F (Meter Data)\n');

const channels = new Array(32).fill(0);

input.on('message', (delta, msg) => {
    if (msg[0] === 0xFE) return;

    // Check for Meter Data: F0 43 10 3E 7F 01 4F ...
    if (msg[0] === 0xF0 && msg[1] === 0x43 && msg[4] === 0x7F && msg[5] === 0x01 && msg[6] === 0x4F) {
        // Byte 7-8: Channel address (00 00 = CH1 L, 00 01 = CH1 R, etc.)
        const addrHi = msg[7];
        const addrLo = msg[8];

        // Byte 11-12: Level value (7-bit pairs)
        const valHi = msg[11];
        const valLo = msg[12];
        const level = (valHi << 7) | valLo;

        // Calculate channel number
        // Pattern: 00 00 = CH1-L, 00 01 = CH1-R, 00 02 = CH2-L, 00 03 = CH2-R...
        const channelPair = addrLo >> 1; // Divide by 2 to get channel number
        const side = addrLo & 1 ? 'R' : 'L';
        const ch = channelPair + 1;

        // Store max value for this channel
        channels[ch - 1] = Math.max(channels[ch - 1], level);

        // Print every few updates
        if (Math.random() < 0.05) { // Sample 5% of messages
            console.log(`CH${ch.toString().padStart(2, ' ')}-${side}: Level=${level.toString().padStart(4, ' ')} (0x${level.toString(16).toUpperCase().padStart(3, '0')})`);
        }
    }
});

// Print statistics every 2 seconds
setInterval(() => {
    console.log('\n📊 Peak Levels (Last 2s):');
    for (let i = 0; i < 8; i++) {
        if (channels[i] > 0) {
            const bars = '█'.repeat(Math.floor(channels[i] / 100));
            console.log(`  CH${(i + 1).toString().padStart(2, ' ')}: ${channels[i].toString().padStart(4, ' ')} ${bars}`);
        }
    }
    // Reset peaks
    channels.fill(0);
}, 2000);

setInterval(() => { }, 1000);
