
const midi = require('midi');
const fs = require('fs');
const path = require('path');

const input = new midi.Input();
const portCount = input.getPortCount();
let actualPort = -1;

for (let i = 0; i < portCount; i++) {
    if (input.getPortName(i).includes('YAMAHA 01V96 Port1')) {
        actualPort = i;
        break;
    }
}

if (actualPort === -1) {
    console.error('❌ Yamaha Port1 nicht gefunden!');
    process.exit(1);
}

const dumpFile = path.join(__dirname, 'bulkdump_full.txt');
// Datei initialisieren/leeren
fs.writeFileSync(dumpFile, '--- YAMAHA 01V96 FULL BULK DUMP START ---\n');

console.log(`📡 Listener aktiv auf: ${input.getPortName(actualPort)}`);
console.log(`📝 Speichere in: ${dumpFile}`);
console.log('Warte auf Daten... Sende den Bulk-Dump jetzt am Pult ab.');

input.on('message', (deltaTime, message) => {
    const hex = message.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    fs.appendFileSync(dumpFile, hex + '\n');
    process.stdout.write('█'); // Fortschrittsbalken in der Konsole
});

input.openPort(actualPort);
input.ignoreTypes(false, false, false);

// Keep process alive
process.stdin.resume();
