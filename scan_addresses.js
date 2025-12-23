
const midi = require('midi');
const input = new midi.Input();
const output = new midi.Output();

// Finde Port 1
let port = -1;
for (let i = 0; i < input.getPortCount(); i++) {
    if (input.getPortName(i).includes('Port1')) {
        port = i; break;
    }
}
if (port === -1) { console.log('P1 nicht gefunden!'); process.exit(1); }

input.openPort(port);
output.openPort(port);
input.ignoreTypes(false, false, false);

console.log('=== YAMAHA 01V96 - ADDRESS SCANNER (CH1) ===');
console.log('Frage Adressen rund um Fader (1C) und Mute (1A) ab...');

input.on('message', (delta, msg) => {
    if (msg[0] === 0xFE || msg[0] === 0xF8) return;
    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    // Antworte nur wenn es KEIN Heartbeat ist
    if (hex !== 'F0 43 10 3E 0D 7F F7') {
        // Filtere Parameter, die wir gerade abfragen
        const addrH = msg[5];
        const addrL = msg[6]; // Bei Command 61/7F ist das meist hier
        console.log(`[RECV] ${hex}`);
    }
});

async function scan() {
    // Yamaha Parameter Request Format:
    // F0 43 30 3E 61 <ADDR_H> <ADDR_L> <CH_H> <CH_L> F7 ??? 
    // Oder eher CMD 10? Yamaha ist tricky.
    // Wir probieren den "Parameter Request" Command (meist 0x61 oder 0x10 mit flag)

    // Wir scannen Adressen 0x01 0x00 bis 0x01 0x7F für Channel 1 (index 0)

    console.log('Starte Scan für Channel 1 (Request)...');

    for (let addr = 0x00; addr <= 0x60; addr++) {
        // Skip bekannte Adressen nur fürs Logging, senden tun wir trotzdem
        let known = '';
        if (addr === 0x1A) known = '(MUTE)';
        if (addr === 0x1C) known = '(FADER)';
        if (addr === 0x4F) known = '(METER?)';

        console.log(`Requesting Addr 0x01 0x${addr.toString(16).toUpperCase()} ${known}...`);

        // Parameter Request Message (Device ID 1, Model 01V96)
        // Format: F0 43 30 3E <CMD> ...
        // Wir nutzen CMD 0x61 (Parameter Request)
        output.sendMessage([0xF0, 0x43, 0x30, 0x3E, 0x61, 0x01, addr, 0x00, 0x00, 0xF7]);

        await new Promise(r => setTimeout(r, 100)); // 100ms warten
    }
}

scan();
