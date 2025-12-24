const midi = require('midi');
const input = new midi.Input();

for (let i = 0; i < input.getPortCount(); i++) {
    if (input.getPortName(i).includes('Port1')) {
        input.openPort(i);
        break;
    }
}

console.log("Listening for ANYTHING on Port 1... (Scroll/Recall on Mixer now!)");
input.on('message', (delta, msg) => {
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    const decoded = msg.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
    console.log(`[${msg.length}] ${hex} | ${decoded}`);
});

setTimeout(() => {
    console.log("Timeout.");
    process.exit(0);
}, 20000);
