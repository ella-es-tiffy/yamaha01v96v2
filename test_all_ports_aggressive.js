
const midi = require('midi');

console.log('=== GLOBAL MIDI DETECTIVE ===');

const MAX_PORTS = 16;
const inputs = [];

// Open EVERYTHING that looks like Yamaha
const input = new midi.Input();
const portCount = input.getPortCount();

console.log(`Scanning ${portCount} ports...`);

for (let i = 0; i < portCount; i++) {
    const name = input.getPortName(i);
    // Open everything to be safe
    if (name.includes('YAMAHA') || name.includes('01V96')) {
        try {
            const freshInput = new midi.Input();
            freshInput.openPort(i);

            freshInput.on('message', (deltaTime, message) => {
                const hex = message.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
                console.log(` 🔥 DATA on Port [${i}] ${name}: ${hex}`);
            });

            inputs.push(freshInput);
            console.log(`✅ Opened listening ear on: [${i}] ${name}`);
        } catch (e) {
            console.log(`❌ Failed to open [${i}]: ${e.message}`);
        }
    }
}

if (inputs.length === 0) {
    console.log('No Yamaha ports found at all!');
    process.exit(1);
}

console.log('\n👂 LISTENING ON ALL CHANNELS NOW...');
console.log('Please move a fader. If you see nothing below, NO DATA IS REACHING NODE.JS');

setInterval(() => {
    // Keep alive
}, 1000);
