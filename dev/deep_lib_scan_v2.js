const midi = require('midi');

const input = new midi.Input();
const output = new midi.Output();

for (let i = 0; i < input.getPortCount(); i++) {
    if (input.getPortName(i).includes('Port1')) {
        input.openPort(i);
        output.openPort(i);
        break;
    }
}

console.log("🔍 Deep Library Scan V2 (ID 30)...");

input.on('message', (delta, msg) => {
    const ascii = msg.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
    const clean = ascii.replace(/\./g, '').replace('LM  8C93', '').trim();
    if (clean.length > 2) {
        console.log(`🎯 Recv [${msg.length}] "${clean}" | ID=${msg[16] || '?'} (Nr=${(msg[16] || 0) + 1})`);
    }
});

async function run() {
    for (let i = 0; i < 128; i++) {
        output.sendMessage([0xF0, 0x43, 0x30, 0x3E, 0x0E, 0x02, i, 0xF7]);
        await new Promise(r => setTimeout(r, 60));
    }
    console.log("Requests sent.");
    await new Promise(r => setTimeout(r, 5000));
    process.exit(0);
}

run();
