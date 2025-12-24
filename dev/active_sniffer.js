
const midi = require('midi');

console.log('🕵️‍♂️ ACTIVE SMART SNIFFER - PROBING & FILTERING 🕵️‍♂️');
console.log('Ignoriere Heartbeats (F0 43 ... 0D 7F F7)');
console.log('Sende "Unlock"-Befehle alle 2 Sekunden...\n');

const inputs = [];
const outputs = [];

// Setup Ports
for (let i = 0; i < 8; i++) {
    try {
        // INPUTS
        const input = new midi.Input();
        const portName = input.getPortName(i);
        if (portName.includes('YAMAHA')) {
            input.openPort(i);
            input.ignoreTypes(false, false, false);

            input.on('message', (delta, msg) => {
                // Filter Clock & Active Sense
                if (msg[0] === 0xF8 || msg[0] === 0xFE) return;

                const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

                // FILTER HEARTBEAT: F0 43 10 3E 0D 7F F7
                if (hex === 'F0 43 10 3E 0D 7F F7') return;

                console.log(`\n🔥 [IN Port ${i + 1}] ${hex}`);

                // METER DECODE GUESS
                if (msg[0] === 0xB0) {
                    console.log(`   -> CC Ch:${msg[0] & 0xF} Ctrl:${msg[1]} Val:${msg[2]}`);
                }
                if (msg[0] === 0xF0) {
                    console.log(`   -> SYSEX Cmd:${msg[4] ? msg[4].toString(16).toUpperCase() : '?'}`);
                }
            });
            inputs.push(input);

            // OUTPUTS (for probing)
            const output = new midi.Output();
            output.openPort(i);
            outputs.push(output);

            console.log(`✓ Port ${i + 1}: ${portName} (In/Out)`);
        }
    } catch (e) { }
}

const probes = [
    [0xF0, 0x43, 0x10, 0x3E, 0x0F, 0x01, 0x01, 0xF7], // Command 0F: Meter Request?
    [0xF0, 0x43, 0x10, 0x3E, 0x19, 0x01, 0xF7],       // Command 19: Handshake?
    [0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x01, 0x4F, 0xF7], // Command 7F: Parameter Request?
];

let probeIdx = 0;

setInterval(() => {
    const msg = probes[probeIdx];
    // Sende Probe-Nachricht an Port 1 & 2 (die wahrscheinlichsten)
    if (outputs[0]) {
        // console.log(`[OUT P1] Sending Probe ${probeIdx}...`); // Zu viel Spam, wir machens still
        outputs[0].sendMessage(msg);
    }
    if (outputs[1]) {
        outputs[1].sendMessage(msg);
    }

    probeIdx = (probeIdx + 1) % probes.length;
}, 2500);

console.log('\n🎤 JETZT BIETET SICH DIE CHANCE:');
console.log('Lass Audio laufen. Wenn Daten kommen, sehen wir sie jetzt!\n');

setInterval(() => { }, 1000);
