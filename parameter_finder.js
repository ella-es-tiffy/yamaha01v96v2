const midi = require('midi');

const input = new midi.Input();
let port = -1;
for (let i = 0; i < input.getPortCount(); i++) {
    if (input.getPortName(i).includes('Port1')) port = i;
}

if (port === -1) { process.exit(1); }

input.openPort(port);
input.ignoreTypes(false, false, false);

console.log('🕵️‍♂️ PARAMETER FINDER DETECTIVE');
console.log('Bitte bewege Knoepfe fuer EQ, SEL, etc.');

input.on('message', (delta, msg) => {
    // Filter Active Sense & Clock
    if (msg[0] >= 0xF8) return;

    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    // Parameter Change (F0 43 10 3E ...)
    // Wir schauen auf Byte 5 und 6 (Adresse)
    let info = '';
    if (msg.length > 8 && msg[0] === 0xF0 && msg[4] === 0x10) { // Command 10 = Change (Receive side uses 10? Or sends 10?)
        // Pult sendet meistens Command 10 wenn man dreht
        const addrHi = msg[5];
        const addrLo = msg[6];
        const valHi = msg[11]; // Bei Standard Param Change

        // Kleine Heuristik
        if (addrHi === 0x01) {
            info = ' -> Fader/Mute Area';
        } else if (addrHi === 0x00) {
            info = ' -> Channel Parameters?';
        }
    }

    console.log(`[RX] ${hex} ${info}`);
});
