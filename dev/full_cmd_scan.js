
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

console.log('=== YAMAHA 01V96 - FULL COMMAND SCAN (00-7F) ===');

input.on('message', (delta, msg) => {
    if (msg[0] === 0xFE) return;
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    if (msg.length > 7) {
        console.log(`\nFound Response for CMD 0x${msg[4].toString(16).toUpperCase()}:`);
        console.log(hex);
    }
});

async function scan() {
    for (let cmd = 0x00; cmd <= 0x7E; cmd++) {
        // Skip 0x0D (known)
        if (cmd === 0x0D) continue;

        console.log(`Scanning CMD 0x${cmd.toString(16).toUpperCase()}...`);
        output.sendMessage([0xF0, 0x43, 0x10, 0x3E, cmd, 0x01, 0x01, 0xF7]);
        await new Promise(r => setTimeout(r, 100));
    }
}

scan();
