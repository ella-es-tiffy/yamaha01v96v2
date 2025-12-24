const midi = require('midi');
const output = new midi.Output();
const input = new midi.Input();

let portIdx = -1;
for (let i = 0; i < output.getPortCount(); i++) {
    const name = output.getPortName(i);
    if (name.includes('01V96')) {
        portIdx = i;
        break;
    }
}

if (portIdx === -1) {
    console.log("No 01V96 found");
    process.exit();
}

output.openPort(portIdx);
input.openPort(portIdx);
input.ignoreTypes(false, false, false);

input.on('message', (deltaTime, message) => {
    console.log(`📥 [${new Date().toLocaleTimeString()}] RECEIVED: ${message.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
});

const elements = {
    fader: 0x1C,
    on: 0x1A,
    pan: 0x1B
};

async function syncAll() {
    console.log("Starting Sync Loop for faders 1-32...");
    for (let i = 0; i < 32; i++) {
        // Parameter Request: F0 43 30 3E 7F 01 [Element] [P1] [P2] F7
        const msg = [0xF0, 0x43, 0x30, 0x3E, 0x7F, 0x01, elements.fader, 0x00, i, 0xF7];
        output.sendMessage(msg);
        await new Promise(r => setTimeout(r, 40)); // 40ms delay, don't spam too hard
    }

    console.log("Starting Sync Loop for Mutes 1-32...");
    for (let i = 0; i < 32; i++) {
        const msg = [0xF0, 0x43, 0x30, 0x3E, 0x7F, 0x01, elements.on, 0x00, i, 0xF7];
        output.sendMessage(msg);
        await new Promise(r => setTimeout(r, 40));
    }

    console.log("Sync Loop Finished. Waiting for responses...");
}

syncAll();

setTimeout(() => {
    output.closePort();
    input.closePort();
}, 10000);
