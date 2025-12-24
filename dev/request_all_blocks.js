const midi = require('midi');

const output = new midi.Output();
for (let i = 0; i < output.getPortCount(); i++) {
    if (output.getPortName(i).includes('Port1')) {
        output.openPort(i);
        break;
    }
}

const types = ['Q', 'G', 'C', 'E', 'R', 'S', 'm', 'O', 'L', 'V', 'U', 'P'];

types.forEach((type, idx) => {
    setTimeout(() => {
        const typeHex = type.charCodeAt(0);
        // Request Block [Type]
        // F0 43 20 7E 00 21 4C 4D 20 20 38 43 39 33 [Type] 00 00 F7
        const msg = [0xF0, 0x43, 0x20, 0x7E, 0x00, 0x21, 0x4C, 0x4D, 0x20, 0x20, 0x38, 0x43, 0x39, 0x33, typeHex, 0x00, 0x00, 0xF7];
        console.log(`📤 Requesting Block ${type}...`);
        output.sendMessage(msg);

        // Also try Variant with 30 ID
        const msg2 = [0xF0, 0x43, 0x30, 0x7E, 0x00, 0x21, 0x4C, 0x4D, 0x20, 0x20, 0x38, 0x43, 0x39, 0x33, typeHex, 0x00, 0x00, 0xF7];
        output.sendMessage(msg2);
    }, idx * 1000);
});

setTimeout(() => process.exit(0), types.length * 1000 + 2000);
