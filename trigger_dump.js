
const midi = require('midi');
const input = new midi.Input();
const output = new midi.Output();

let port = -1;
for (let i = 0; i < output.getPortCount(); i++) if (output.getPortName(i).includes('Port1')) port = i;
if (port === -1) { console.log('No Port1'); process.exit(1); }

output.openPort(port);
input.openPort(port);
input.ignoreTypes(false, false, false);

console.log('Listening for Dump response...');
input.on('message', (dt, msg) => {
    if (msg.length > 20) {
        console.log(`BIG MESSAGE (${msg.length} bytes):`, msg.slice(0, 20).map(x => x.toString(16)).join(' '), '...');
    } else {
        // console.log('Small msg:', msg.map(x => x.toString(16)).join(' '));
    }
});

// Try 1: Universal Bulk Dump Request (Identity Request is F0 7E 7F 06 01 F7)
// Yamaha Bulk Dump Request often: F0 43 20 <DevID> 7A <Format> <Addr> ... F7
// DevID = 10 (01V96).
// F0 43 20 10 7A ... ? 
// Let's try some standard ones.

const requests = [
    { name: 'Identity Request', msg: [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7] },
    // "Universal Bulk Dump Request" ??
    // F0 43 0n 7A ...
    // n = 0 (Channel 1)
    { name: 'Yamaha Request 1 (0n 7A)', msg: [0xF0, 0x43, 0x00, 0x7A, 0xF7] },
    { name: 'Yamaha Request 1 ID10 (10 7A)', msg: [0xF0, 0x43, 0x10, 0x7A, 0xF7] },

    // Format 1 Request?
    // F0 43 20 10 7A ...
    { name: 'Yamaha Request 2 (20 10 7A)', msg: [0xF0, 0x43, 0x20, 0x10, 0x7A, 0xF7] },
    // Format 1 Request with Model ID?
    // 01V96 Model ID is often 0x3E (used in param changes F0 43 10 3E...)
    // Try: F0 43 20 3E 7A ...
    { name: 'Yamaha Request 3E (20 3E 7A)', msg: [0xF0, 0x43, 0x20, 0x3E, 0x7A, 0xF7] },
    { name: 'Yamaha Request 3E ID10 (30 3E 7A)', msg: [0xF0, 0x43, 0x30, 0x3E, 0x7A, 0xF7] },

    // Known Bulk Request from similar desks (01V96i ?): 
    // F0 43 0g 7A ...
    // Try F0 43 00 3E 7A ...
    { name: 'Yamaha Request 00 3E 7A', msg: [0xF0, 0x43, 0x00, 0x3E, 0x7A, 0xF7] },
];

async function run() {
    for (const req of requests) {
        console.log(`Sending ${req.name}...`);
        output.sendMessage(req.msg);
        await new Promise(r => setTimeout(r, 1000));
    }
    console.log('Done.');
    process.exit(0);
}

run();
