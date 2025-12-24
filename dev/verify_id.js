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

console.log("🔍 Verifying Request for ID 43 (flashstore)...");

input.on('message', (delta, msg) => {
    // Check for LM signature (8C93Q or similar)
    if (msg.length > 20) {
        console.log(`Recv: ${msg.map(b => b.toString(16).toUpperCase()).join(' ')}`);
        const ascii = msg.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
        console.log(`ASCII: ${ascii}`);
    }
});

// Request Slot 43 (0x2B) - flashstore
// F0 43 10 3E 0E 02 2B F7
const req = [0xF0, 0x43, 0x10, 0x3E, 0x0E, 0x02, 0x2B, 0xF7];
console.log(`Sending: ${req.map(b => b.toString(16).toUpperCase()).join(' ')}`);
output.sendMessage(req);

// Try 0x02 0x02 format too
const req2 = [0xF0, 0x43, 0x10, 0x3E, 0x02, 0x02, 0x2B, 0xF7];
// output.sendMessage(req2); 

setTimeout(() => process.exit(0), 2000);
