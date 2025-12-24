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

console.log("🔍 Deep Library Scan (All Slots 1-127)...");

input.on('message', (delta, msg) => {
    if (msg.length > 10) {
        const ascii = msg.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
        // Look for any 3+ char string that isn't just dots or "LM  8C93"
        const clean = ascii.replace(/\./g, '').replace('LM  8C93', '').trim();
        if (clean.length > 2) {
            console.log(`🎯 Recv [${msg.length}] "${clean}" | ID=${msg[16] || '?'} (Nr=${(msg[16] || 0) + 1})`);
            if (clean.toLowerCase().includes('test')) {
                console.log("   --- !!! THIS IS TEST !!! ---");
            }
        }
    }
});

async function run() {
    for (let i = 0; i < 128; i++) {
        // F0 43 20 3E 0E 02 [Idx] F7
        output.sendMessage([0xF0, 0x43, 0x20, 0x3E, 0x0E, 0x02, i, 0xF7]);
        await new Promise(r => setTimeout(r, 60));
    }
    console.log("Requests sent. Waiting 5s...");
    await new Promise(r => setTimeout(r, 5000));
    process.exit(0);
}

run();
