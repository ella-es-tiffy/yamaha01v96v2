
const midi = require('midi');

const input = new midi.Input();
const portCount = input.getPortCount();
let yamahaPort = -1;

for (let i = 0; i < portCount; i++) {
    if (input.getPortName(i).includes('YAMAHA') && input.getPortName(i).includes('Port1')) {
        yamahaPort = i;
        break;
    }
}

if (yamahaPort === -1) process.exit(1);

input.openPort(yamahaPort);
input.ignoreTypes(false, false, false);

console.log('=== YAMAHA 01V96 - TOTAL MIDI SNIFFER ===');
console.log('Waiting for ANY data. Please play audio and switch to METER page on the 01V96.');

input.on('message', (delta, msg) => {
    if (msg[0] === 0xFE) return; // Ignore Active Sensing

    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    // Specifically watch for command bytes (4th byte in Yamaha SysEx)
    if (msg[0] === 0xF0 && msg[1] === 0x43) {
        const cmd = msg[4];
        // 0D = Param Change, 7F = Bulk?
        if (cmd === 0x0D || cmd === 0x7F) return; // Ignore standard traffic to find the peak spikes

        console.log(`\n🚨 DETECTED COMMAND 0x${cmd.toString(16).toUpperCase()}:`);
        console.log(hex);
    } else {
        // If it's not SysEx but something else (CC, Note)
        console.log(`[RAW] ${hex}`);
    }
});

setInterval(() => { }, 1000);
