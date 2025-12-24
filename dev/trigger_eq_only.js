const midi = require('midi');
const fs = require('fs');

const output = new midi.Output();
let portFound = false;

for (let i = 0; i < output.getPortCount(); i++) {
    if (output.getPortName(i).includes('Port1')) {
        output.openPort(i);
        portFound = true;
        break;
    }
}

if (!portFound) {
    console.error("❌ Port 1 not found!");
    process.exit(1);
}

// Request EQ Library Bulk Dump (Generic Request)
// F0 43 30 3E 02 02 F7
const msg = [0xF0, 0x43, 0x30, 0x3E, 0x02, 0x02, 0xF7];
console.log("📤 Sending EQ Library Dump Request:", msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' '));
output.sendMessage(msg);
output.closePort();
console.log("✅ Request sent.");
