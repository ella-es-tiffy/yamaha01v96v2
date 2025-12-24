const fs = require('fs');

const findStrings = (filename) => {
    if (!fs.existsSync(filename)) return;
    console.log(`\n--- Searching for "test" in ${filename} ---`);
    const content = fs.readFileSync(filename, 'utf8');
    const hex = content.match(/[0-9A-Fa-f]{2}/g) || [];
    const bytes = hex.map(h => parseInt(h, 16));

    for (let i = 0; i < bytes.length - 8; i++) {
        // Look for 'test' in standard ASCII
        let str = "";
        for (let j = 0; j < 8; j++) {
            const b = bytes[i + j];
            if (b >= 32 && b < 127) str += String.fromCharCode(b);
            else break;
        }
        if (str.toLowerCase().includes('test')) {
            console.log(`Potential Match at offset ${i}: "${str}"`);
            // Look for LM signature nearby (usually before)
            const contextStart = Math.max(0, i - 32);
            const context = bytes.slice(contextStart, i + 32).map(x => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');
            console.log(`  Context: ${context}`);

            // Check if it's an LM block
            const lmSig = context.indexOf("4C 4D 20 20 38 43 39 33 51"); // LM  8C93Q
            if (lmSig !== -1) {
                // In these blocks, ID 0x28 (40) was tiff sub. 
                // Signature at contextStart + (lmSig/3). 
                // Let's just find the actual byte index of the signature.
                for (let k = i - 32; k < i; k++) {
                    if (bytes[k] === 0x4C && bytes[k + 1] === 0x4D && bytes[k + 8] === 0x51) {
                        console.log(`  ✅ LM Signature FOUND at ${k}! ID byte is at ${k + 10}`);
                        console.log(`  Mixer ID: ${bytes[k + 10]} (Display Nr: ${bytes[k + 10] + 1})`);
                    }
                }
            }
        }
    }
};

const files = ['dev/aggressive_dump.txt', 'dev/bulk_dump.txt', 'dev/bulkdump_full.txt'];
files.forEach(findStrings);
