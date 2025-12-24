const midi = require('midi');

async function findPortWithIdentity() {
    const inputs = [];
    const outputs = [];
    const identityReq = [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7];

    for (let i = 0; i < 8; i++) {
        const out = new midi.Output();
        try {
            out.openPort(i);
            outputs.push(out);

            const inp = new midi.Input();
            inp.openPort(i);
            inp.ignoreTypes(false, false, false);
            inp.on('message', (dt, msg) => {
                console.log(`[PORT ${i}] RX: ${msg.map(b => b.toString(16)).join(' ')}`);
            });
            inputs.push(inp);
        } catch (e) { }
    }

    console.log('Sending Universal Identity Request to all ports...');
    outputs.forEach(out => out.sendMessage(identityReq));

    await new Promise(r => setTimeout(r, 2000));
    console.log('Done.');
    process.exit(0);
}

findPortWithIdentity();
