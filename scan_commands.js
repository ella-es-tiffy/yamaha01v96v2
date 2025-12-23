
const midi = require('midi');
const input = new midi.Input();
const output = new midi.Output();
const portCount = input.getPortCount();
let yamahaPort = -1;
for (let i = 0; i < portCount; i++) {
    if (input.getPortName(i).includes('YAMAHA') && input.getPortName(i).includes('Port1')) {
        yamahaPort = i; break;
    }
}
if (yamahaPort === -1) process.exit(1);
input.openPort(yamahaPort);
output.openPort(yamahaPort);
input.ignoreTypes(false, false, false);

console.log('=== YAMAHA 01V96 COMMAND SCANNER ===');

input.on('message', (delta, msg) => {
    if (msg[0] === 0xFE) return;
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    console.log(`[ANS] ${hex}`);
});

async function scan() {
    for (let cmd = 0; cmd < 32; cmd++) {
        console.log(`Testing Header Byte 0x${cmd.toString(16).toUpperCase()}...`);
        // We try F0 43 10 3E [CMD] 01 01 F7
        output.sendMessage([0xF0, 0x43, 0x10, 0x3E, cmd, 0x01, 0x01, 0xF7]);
        await new Promise(r => setTimeout(r, 200));
    }
}

scan();
