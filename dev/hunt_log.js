const fs = require('fs');

const findStrings = (filename) => {
    if (!fs.existsSync(filename)) { console.log("File not found"); return; }
    console.log(`\n--- Searching for "test" in ${filename} ---`);
    const content = fs.readFileSync(filename, 'utf8');
    const hex = content.match(/[0-9A-Fa-f]{2}/g) || [];
    const bytes = hex.map(h => parseInt(h, 16));

    for (let i = 0; i < bytes.length - 8; i++) {
        let str = "";
        for (let j = 0; j < 8; j++) {
            const b = bytes[i + j];
            if (b >= 32 && b < 127) str += String.fromCharCode(b);
            else break;
        }
        if (str.toLowerCase().includes('test')) {
            console.log(`Potential Match at offset ${i}: "${str}"`);
            // Look for LM signature nearby
            const startContext = Math.max(0, i - 40);
            const endContext = Math.min(bytes.length, i + 40);
            const contextBytes = bytes.slice(startContext, endContext);
            const contextHex = contextBytes.map(x => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');
            console.log(`  Context: ${contextHex}`);

            // Try to find the ID in this context
            // In EQ Lib, ID is usually at offset 16 of the message. 
            // Name starts at offset 20.
            // If 'test' starts at offset `i`, and it's at the start of the name (offset 20 in msg)
            // Then message start should be `i - 20`.
            const msgStart = i - 20;
            if (msgStart >= 0) {
                const idByte = bytes[msgStart + 16];
                if (idByte !== undefined) {
                    console.log(`  Hypothetical ID (assuming it is Name start): 0x${idByte.toString(16)} (${idByte}) -> Nr: ${idByte + 1}`);
                }
            }
        }
    }
};

findStrings('dev/startup_log.txt');
