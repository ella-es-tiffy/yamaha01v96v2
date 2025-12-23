
const midi = require('midi');

console.log('=== YAMAHA 01V96 - ULTRA METER SNIFFER (ALL PORTS) ===');
console.log('Meter-Seite ist am Pult geöffnet, CH1-3 haben Pegel');

const inputs = [];
const messageFreq = {}; // Track frequency of messages

for (let i = 0; i < 8; i++) {
    try {
        const input = new midi.Input();
        const portName = input.getPortName(i);

        if (portName.includes('YAMAHA')) {
            input.openPort(i);
            input.ignoreTypes(false, false, false);

            input.on('message', (delta, msg) => {
                // Skip MIDI Clock
                if (msg[0] === 0xF8 || msg[0] === 0xFE) return;

                const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

                // Skip known heartbeat
                if (hex === 'F0 43 10 3E 0D 7F F7') return;

                // Track message frequency
                if (!messageFreq[hex]) {
                    messageFreq[hex] = { count: 0, port: i + 1, lastSeen: Date.now() };
                }
                messageFreq[hex].count++;
                messageFreq[hex].lastSeen = Date.now();

                // Highlight high-frequency messages (likely meters!)
                if (messageFreq[hex].count > 5) {
                    console.log(`\n🔥🔥🔥 HIGH-FREQUENCY DATA ON PORT ${i + 1} (${messageFreq[hex].count}x):`);
                    console.log(hex);

                    // Decode if it looks like meter data
                    if (msg[0] === 0xF0 && msg[1] === 0x43) {
                        console.log(`   CMD: 0x${msg[4].toString(16).toUpperCase()}`);
                        if (msg.length > 10) {
                            const levels = msg.slice(6, 16).map(b => b.toString(10).padStart(3, ' ')).join(' ');
                            console.log(`   VALS: ${levels}`);
                        }
                    }
                } else {
                    console.log(`[Port ${i + 1}] ${hex}`);
                }
            });

            inputs.push(input);
            console.log(`✓ Port ${i + 1}: ${portName}`);
        }
    } catch (e) { }
}

console.log('\n🎤 BITTE JETZT AUDIO AUF CH1-3 ABSPIELEN UND PEGEL BEOBACHTEN!');
console.log('Watching for rapid meter updates...\n');

// Report statistics every 5 seconds
setInterval(() => {
    const now = Date.now();
    const recent = Object.entries(messageFreq)
        .filter(([hex, data]) => (now - data.lastSeen) < 5000)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3);

    if (recent.length > 0) {
        console.log('\n📊 Top 3 frequent messages (last 5s):');
        recent.forEach(([hex, data]) => {
            console.log(`   Port ${data.port}: ${hex.substring(0, 30)}... (${data.count}x)`);
        });
    }
}, 5000);

setInterval(() => { }, 1000);
