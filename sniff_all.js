const midi = require('midi');
for (let i = 0; i < 8; i++) {
    const input = new midi.Input();
    try {
        console.log(`Testing Port ${i}: ${input.getPortName(i)}`);
        input.openPort(i);
        input.ignoreTypes(false, false, false);
        input.on('message', (t, msg) => {
            console.log(`[Port ${i}] RX:`, msg.map(b => b.toString(16).padStart(2, '0')).join(' '));
        } );
    } catch(e) {}
}
setTimeout(() => process.exit(0), 5000);
