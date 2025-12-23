
const midi = require('midi');
const fs = require('fs');

const input = new midi.Input();
let port = -1;
for (let i = 0; i < input.getPortCount(); i++) {
    if (input.getPortName(i).includes('YAMAHA 01V96 Port1')) port = i;
}

if (port === -1) {
    console.error("❌ Port1 nicht gefunden!");
    process.exit(1);
}

const logFile = 'aggressive_dump.txt';
if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

console.log("🔥 AGGRESSIVE LISTENER ACTIVE (No Filters)");
console.log(`📡 Listening on: ${input.getPortName(port)}`);
console.log(`💾 Writing to: ${logFile}`);

input.openPort(port);
// Deaktiviere alle Filter (sysex, timing, active sensing -> false bedeutet FILTER AUS)
input.ignoreTypes(false, false, false);

input.on('message', (delta, msg) => {
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    // Logge ALLES in die Datei (ohne Kürzung)
    fs.appendFileSync(logFile, hex + '\n');

    // Konsole nur kurze Info um Performance nicht zu killen
    if (msg[0] === 0xF0) {
        console.log(`[SYS] Sysex (${msg.length} bytes)`);
    } else {
        console.log(`[MID] ${hex}`);
    }
});

console.log("🚀 START DUMP NOW!");

setTimeout(() => {
    console.log("🏁 Fertig. Datei: aggressive_dump.txt");
    process.exit(0);
}, 120000); // 120 Sekunden
