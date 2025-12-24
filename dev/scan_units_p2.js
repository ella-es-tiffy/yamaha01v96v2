const midi = require('midi');
const out = new midi.Output();
const inp = new midi.Input();

let port = -1;
for (let i = 0; i < out.getPortCount(); i++) {
    if (out.getPortName(i).includes('Port2')) port = i;
}

if (port === -1) { console.log('Port2 not found'); process.exit(1); }

out.openPort(port);
inp.openPort(port);
inp.ignoreTypes(false, false, false);

inp.on('message', (dt, msg) => {
    console.log('RX Port2:', msg.map(b => b.toString(16).padStart(2, '0')).join(' '));
});

async function scanUnits() {
    for (let id = 0; id < 16; id++) {
        const unitByte = 0x30 + id;
        console.log(`Port2 Scanning Unit ID ${id}...`);
        const req = [0xF0, 0x43, unitByte, 0x3E, 0x0D, 0x21, 0x00, 0x00, 0x00, 0x00, 0x20, 0xF7];
        out.sendMessage(req);
        await new Promise(r => setTimeout(r, 200));
    }
    console.log('Done scanning units on Port 2.');
}

scanUnits();
