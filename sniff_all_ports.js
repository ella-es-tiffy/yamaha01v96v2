
const midi = require('midi');

const inputs = [];
const portCount = new midi.Input().getPortCount();

console.log('=== YAMAHA 01V96 - ALL PORT METER SNIFFER ===');
console.log(`Checking ${portCount} ports...`);

for (let i = 0; i < portCount; i++) {
    const name = new midi.Input().getPortName(i);
    if (name.includes('YAMAHA')) {
        const input = new midi.Input();
        input.openPort(i);
        input.ignoreTypes(false, false, false);

        input.on('message', (delta, msg) => {
            if (msg[0] === 0xFE) return;
            const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
            // Filter heartbeat
            if (hex.includes('0D 7F F7')) return;

            console.log(`\n🚨 DATA ON [Port ${i + 1}] ${name}:`);
            console.log(hex);
        });

        inputs.push(input);
        console.log(`✓ Listening on [Port ${i + 1}] ${name}`);
    }
}

console.log('\nBITTE JETZT AM MISCHER DAS "METER" MENÜ ÖFFNEN ODER AUDIO ABSPIELEN!');

setInterval(() => { }, 1000);
