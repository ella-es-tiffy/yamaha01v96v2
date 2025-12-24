
const midi = require('midi');

console.log('🔴🔴🔴 TOTAL RAW SNIFFER - ABSOLUTELY EVERYTHING 🔴🔴🔴');
console.log('NO FILTERS, NO GROUPING, EVERY SINGLE BYTE!\n');

const inputs = [];

for (let i = 0; i < 8; i++) {
    try {
        const input = new midi.Input();
        const portName = input.getPortName(i);

        if (portName.includes('YAMAHA')) {
            input.openPort(i);
            input.ignoreTypes(false, false, false); // Show EVERYTHING

            input.on('message', (delta, msg) => {
                const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
                const dec = msg.map(b => b.toString(10).padStart(3, ' ')).join(' ');
                console.log(`[P${i + 1}] ${hex}   | DEC: ${dec}`);
            });

            inputs.push(input);
            console.log(`✓ Port ${i + 1}: ${portName}`);
        }
    } catch (e) { }
}

console.log('\n🎤 ABSOLUT ALLES WIRD GELOGGT!');
console.log('Starte jetzt Audio am Pult und bewege Fader!\n');

setInterval(() => { }, 1000);
