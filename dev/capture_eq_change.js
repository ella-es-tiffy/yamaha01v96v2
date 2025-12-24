
const midi = require('midi');
const input = new midi.Input();
let port = -1;
for (let i = 0; i < input.getPortCount(); i++) {
    if (input.getPortName(i).includes('Port1')) port = i;
}
if (port === -1) process.exit(1);

input.openPort(port);
input.ignoreTypes(false, false, false);

console.log("Listening for any Sysex... Move a knob on the desk!");

input.on('message', (delta, msg) => {
    if (msg[0] === 0xF0) {
        const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
        console.log(`[SYS] ${hex} (Len: ${msg.length})`);
    } else {
        const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
        console.log(`[MID] ${hex}`);
    }
});

setTimeout(() => {
    console.log("Listen timeout.");
    process.exit(0);
}, 10000);
