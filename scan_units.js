const midi = require('midi');
const out = new midi.Output();
const inp = new midi.Input();

let port = -1;
for (let i = 0; i < out.getPortCount(); i++) {
    if (out.getPortName(i).includes('Port1')) port = i;
}

out.openPort(port);
inp.openPort(port);
inp.ignoreTypes(false, false, false);

inp.on('message', (dt, msg) => {
    console.log('RX:', msg.map(b => b.toString(16).padStart(2, '0')).join(' '));
});

async function scanUnits() {
    for (let id = 0; id < 16; id++) {
        const unitByte = 0x30 + id;
        console.log(`Scanning Unit ID ${id} (Byte 0x${unitByte.toString(16)})...`);
        const req = [0xF0, 0x43, unitByte, 0x3E, 0x0D, 0x21, 0x00, 0x00, 0x00, 0x00, 0x20, 0xF7];
        out.sendMessage(req);
        await new Promise(r => setTimeout(r, 200));
    }
    console.log('Done scanning units.');
}

scanUnits();
