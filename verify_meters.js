
const midi = require('midi');

const input = new midi.Input();
input.openPort(0); // Port 1
input.ignoreTypes(false, false, false);

console.log('=== YAMAHA 01V96 - METER VERIFICATION ===');
console.log('Verifiziere ob Address 0x01 0x4F = Audio-Pegel\n');

const channels = new Array(32).fill(null).map(() => ({ peak: 0, lastUpdate: 0 }));

input.on('message', (delta, msg) => {
    if (msg[0] === 0xFE) return;

    // Check for Meter Data: F0 43 10 3E 7F 01 4F ...
    if (msg[0] === 0xF0 && msg[1] === 0x43 && msg[4] === 0x7F && msg[5] === 0x01 && msg[6] === 0x4F) {
        const chHi = msg[7];
        const chLo = msg[8];
        const valHi = msg[11];
        const valLo = msg[12];
        const level = (valHi << 7) | valLo;

        // Decode channel
        // 00 00 = Master-L, 00 01 = Master-R
        // 00 02 = CH1-L, 00 03 = CH1-R
        // 00 04 = CH2-L, 00 05 = CH2-R, etc.

        let chName = '';
        if (chHi === 0x00) {
            if (chLo === 0x00) chName = 'MASTER-L';
            else if (chLo === 0x01) chName = 'MASTER-R';
            else {
                const channelPair = Math.floor((chLo - 2) / 2) + 1;
                const side = ((chLo - 2) % 2) === 0 ? 'L' : 'R';
                chName = `CH${channelPair.toString().padStart(2, '0')}-${side}`;
            }
        }

        // Update peak
        const idx = chLo;
        if (idx < 32) {
            channels[idx].peak = Math.max(channels[idx].peak, level);
            channels[idx].lastUpdate = Date.now();
        }

        // Sample output
        if (level > 100 && Math.random() < 0.02) { // Show only significant levels
            const bar = '█'.repeat(Math.floor(level / 100));
            console.log(`${chName.padEnd(10)} | ${level.toString().padStart(4)} | ${bar}`);
        }
    }
});

// Print statistics every 2 seconds
setInterval(() => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 PEAK LEVELS (Last 2s):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const now = Date.now();
    let hasActivity = false;

    // Show Master
    if (channels[0] && channels[0].peak > 0 && (now - channels[0].lastUpdate) < 2000) {
        const masterPeak = Math.max(channels[0].peak, channels[1].peak);
        const bar = '█'.repeat(Math.floor(masterPeak / 50));
        console.log(`  MASTER:  ${masterPeak.toString().padStart(4)} ${bar}`);
        hasActivity = true;
        channels[0].peak = 0;
        channels[1].peak = 0;
    }

    // Show Channels 1-8
    for (let ch = 1; ch <= 8; ch++) {
        const idxL = (ch - 1) * 2 + 2;
        const idxR = idxL + 1;

        if (channels[idxL] && channels[idxL].peak > 0 && (now - channels[idxL].lastUpdate) < 2000) {
            const chPeak = Math.max(channels[idxL].peak, channels[idxR].peak);
            const bar = '█'.repeat(Math.floor(chPeak / 50));
            console.log(`  CH ${ch.toString().padStart(2)}:   ${chPeak.toString().padStart(4)} ${bar}`);
            hasActivity = true;
            channels[idxL].peak = 0;
            channels[idxR].peak = 0;
        }
    }

    if (!hasActivity) {
        console.log('  ⚠️  KEINE METER-DATEN!');
        console.log('  → Gehe am Pult zur METER-Page');
        console.log('  → Spiel Audio ab');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}, 2000);

console.log('🎤 BITTE JETZT:');
console.log('  1. Am Pult zur METER-Page gehen');
console.log('  2. Audio auf CH1-3 abspielen');
console.log('  3. Pegel am Pult beobachten');
console.log('  4. Vergleichen ob die Werte hier korrelieren!\n');

setInterval(() => { }, 1000);
