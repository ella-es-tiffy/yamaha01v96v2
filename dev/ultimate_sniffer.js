
const midi = require('midi');

console.log('🔥🔥🔥 YAMAHA 01V96 - ULTIMATE SNIFFER 🔥🔥🔥');
console.log('Kategorisiert ALLE MIDI-Daten vom Pult\n');

const inputs = [];
const stats = {
    byAddress: {},
    byCommand: {},
    total: 0
};

for (let i = 0; i < 8; i++) {
    try {
        const input = new midi.Input();
        const portName = input.getPortName(i);

        if (portName.includes('YAMAHA')) {
            input.openPort(i);
            input.ignoreTypes(false, false, false);

            input.on('message', (delta, msg) => {
                if (msg[0] === 0xFE || msg[0] === 0xF8) return; // Skip clock/active sense

                const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

                // Parse Yamaha SysEx
                if (msg[0] === 0xF0 && msg[1] === 0x43 && msg[3] === 0x3E && msg.length >= 7) {
                    const cmd = msg[4];
                    const addr1 = msg[5];
                    const addr2 = msg[6];
                    const addrKey = `${cmd.toString(16).toUpperCase()} ${addr1.toString(16).toUpperCase()} ${addr2.toString(16).toUpperCase()}`;
                    const cmdKey = `CMD_${cmd.toString(16).toUpperCase()}`;

                    // Track by address
                    if (!stats.byAddress[addrKey]) {
                        stats.byAddress[addrKey] = { count: 0, sample: hex, port: i + 1 };
                    }
                    stats.byAddress[addrKey].count++;

                    // Track by command
                    if (!stats.byCommand[cmdKey]) {
                        stats.byCommand[cmdKey] = 0;
                    }
                    stats.byCommand[cmdKey]++;

                    stats.total++;

                    // Show sample if new or rare
                    if (stats.byAddress[addrKey].count <= 3 || Math.random() < 0.01) {
                        console.log(`[Port ${i + 1}] CMD=${cmd.toString(16).toUpperCase()} ADDR=${addr1.toString(16).toUpperCase()} ${addr2.toString(16).toUpperCase()}: ${hex}`);
                    }
                } else {
                    // Non-Yamaha or non-SysEx
                    console.log(`[Port ${i + 1}] OTHER: ${hex}`);
                }
            });

            inputs.push(input);
            console.log(`✓ Monitoring Port ${i + 1}: ${portName}`);
        }
    } catch (e) { }
}

// Report every 5 seconds
setInterval(() => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 ULTIMATE ANALYSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total Messages: ${stats.total}`);

    if (stats.total > 0) {
        console.log('\n🎯 BY COMMAND:');
        Object.entries(stats.byCommand)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([cmd, count]) => {
                const desc = {
                    'CMD_D': 'Parameter Change',
                    'CMD_7F': 'Bulk/Meter Data',
                    'CMD_F': 'Meter Request?',
                    'CMD_E': 'System/Dump'
                }[cmd] || 'Unknown';
                console.log(`  ${cmd.padEnd(10)} ${count.toString().padStart(6)}x  (${desc})`);
            });

        console.log('\n🔍 TOP 10 ADDRESSES:');
        Object.entries(stats.byAddress)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10)
            .forEach(([addr, data]) => {
                console.log(`  ${addr.padEnd(15)} ${data.count.toString().padStart(6)}x  Port ${data.port}`);
            });

        // Check for Meter Data
        const meterAddr = '7F 1 4F';
        if (stats.byAddress[meterAddr]) {
            console.log(`\n🎉🎉🎉 METER DATA DETECTED: ${stats.byAddress[meterAddr].count}x`);
            console.log(`Sample: ${stats.byAddress[meterAddr].sample}`);
        } else {
            console.log(`\n⚠️  NO METER DATA (7F 01 4F) FOUND YET`);
            console.log('   → Gehe am Pult zur METER-Page und spiele Audio ab!');
        }
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}, 5000);

console.log('\n🎤 JETZT:');
console.log('  1. Audio abspielen auf CH1-3');
console.log('  2. Fader bewegen');
console.log('  3. Mute/Unmute drücken');
console.log('  4. Zur METER-Page wechseln');
console.log('  5. Alles mögliche am Pult ausprobieren!\n');

setInterval(() => { }, 1000);
