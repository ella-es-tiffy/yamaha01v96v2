const midi = require('midi');

const input1 = new midi.Input();
const input2 = new midi.Input();

try {
    input1.openPort(0);
    input1.ignoreTypes(false, false, false);
    console.log('✓ Monitoring Port 1 (Index 0)');
    input1.on('message', (dt, msg) => {
        console.log(`[P1] RX: ${msg.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    });
} catch (e) { console.log('Err P1:', e.message); }

try {
    input2.openPort(1);
    input2.ignoreTypes(false, false, false);
    console.log('✓ Monitoring Port 2 (Index 1)');
    input2.on('message', (dt, msg) => {
        console.log(`[P2] RX: ${msg.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    });
} catch (e) { console.log('Err P2:', e.message); }

console.log('--- Sniffer Active ---');
console.log('BITTE JETZT FADER AN KANAL 1 BEWEGEN!');

setTimeout(() => {
    console.log('Timeout. No data?');
    process.exit(0);
}, 20000);
