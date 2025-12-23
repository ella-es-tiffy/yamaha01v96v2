
const midi = require('midi');
const fs = require('fs');

const input = new midi.Input();
let port = -1;
for (let i = 0; i < input.getPortCount(); i++) {
    if (input.getPortName(i).includes('YAMAHA 01V96 Port1')) port = i;
}

if (port === -1) {
    console.error("❌ Error: YAMAHA 01V96 Port1 not found!");
    process.exit(1);
}

const logFile = 'bulkdump_new.txt';
console.log(`📡 Listener active on ${input.getPortName(port)}...`);
console.log(`💾 Saving data to ${logFile}`);
console.log(`🚀 Start your Dump now!`);

input.openPort(port);
input.ignoreTypes(false, false, false);

input.on('message', (delta, msg) => {
    // Convert to Hex
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    // Log to console (shortened for performance)
    if (msg.length > 20) {
        console.log(`[SYS] Received Sysex (${msg.length} bytes)`);
    } else {
        console.log(`[MID] ${hex}`);
    }

    // Append to file
    fs.appendFileSync(logFile, hex + '\n');
});

// Run for a longer time to allow full dump
setTimeout(() => {
    console.log("🏁 Listener finished. Please check bulkdump_new.txt");
    process.exit(0);
}, 60000); // 60 seconds
