const midi = require('midi');

const input = new midi.Input();
const output = new midi.Output();

let port = -1;
for (let i = 0; i < input.getPortCount(); i++) {
    if (input.getPortName(i).includes('Port1')) port = i;
}

if (port === -1) {
    console.log('❌ Port 1 nicht gefunden');
    process.exit(1);
}

input.openPort(port);
output.openPort(port);
input.ignoreTypes(false, false, false);

console.log('🌊 METER HUNTER RELOADED: Secret Weapon...');

let msgCount = 0;
let lastCount = 0;

input.on('message', (delta, msg) => {
    if (msg[0] === 0xF8 || msg[0] === 0xFE) return;
    msgCount++;
    if (msg.length > 5 && msg[0] === 0xF0) {
        // console.log(`[RX] ${msg.map(b => b.toString(16)).join(' ')}`); // Debug
    }
});

setInterval(() => {
    const diff = msgCount - lastCount;
    lastCount = msgCount;
    if (diff > 2) {
        console.log(`\n🔥 TRAFFIC! ${diff} msg/sec. (Meter?)`);
    } else {
        process.stdout.write('.');
    }
}, 1000);

const commands = [
    // 1. Die "Geheimwaffe": Remote Meter ON (Parameter Change Command 10, Address 3E, Val 11 ? Ne, Address 11)
    // F0 43 10 3E 11 00 F7 -> Das ist "Remote Metering ON" bei älteren Yamahas
    { name: 'SECRET WEAPON (Remote Meter On)', msg: [0xF0, 0x43, 0x10, 0x3E, 0x11, 0x00, 0xF7] },

    // 2. Variante mit "Value 7F" (ON)
    { name: 'Remote Meter On (High)', msg: [0xF0, 0x43, 0x10, 0x3E, 0x11, 0x00, 0x00, 0x7F, 0xF7] }, // Mit Padding/Value?

    // 3. Andere Adresse: 1A (Meter)
    { name: 'Meter Parameter Change (ON)', msg: [0xF0, 0x43, 0x10, 0x3E, 0x1A, 0x00, 0x00, 0x01, 0xF7] },
];

let cmdIdx = 0;

setInterval(() => {
    if (cmdIdx < commands.length) {
        const cmd = commands[cmdIdx];
        console.log(`\n\n🔫 Sending: ${cmd.name}`);
        console.log(`   HEX: ${cmd.msg.map(b => b.toString(16)).join(' ')}`);
        output.sendMessage(cmd.msg);
        cmdIdx++;
    } else {
        // Wenn wir durch sind, senden wir nochmal den ersten Befehl (Keep Alive?)
        // Yamaha Meter brauchen oft kein Polling, aber wer weiß.
    }
}, 2500);
