const fs = require('fs');

const bruteForce = (filename) => {
    console.log(`\n--- Brute Forcing Names in ${filename} ---`);
    const content = fs.readFileSync(filename, 'utf8');
    const hexMatches = content.match(/[0-9A-Fa-f]{2}/g) || [];
    const bytes = hexMatches.map(h => parseInt(h, 16));

    const STR_LEN = 8;
    const BLOCK_SIZES = [32, 40, 64, 128];

    for (const blockSize of BLOCK_SIZES) {
        console.log(`  Trying Block Size: ${blockSize}`);
        for (let start = 0; start < bytes.length - (blockSize * STR_LEN); start++) {
            // Try to decode name at this start
            let name = "";
            for (let i = 0; i < STR_LEN; i++) {
                const char = bytes[start + (i * blockSize)];
                if (char >= 32 && char < 127) {
                    name += String.fromCharCode(char);
                } else {
                    name = null;
                    break;
                }
            }

            if (name) {
                const lowerName = name.toLowerCase();
                if (lowerName.includes("bass") || lowerName.includes("vocal") || lowerName.includes("male") || lowerName.includes("tiff")) {
                    console.log(`    [MATCH] Offset: ${start} BlockSize: ${blockSize} Name: "${name}"`);
                    // Try to print the next 5 names in this block
                    for (let n = 1; n < 8; n++) {
                        let innerName = "";
                        for (let i = 0; i < STR_LEN; i++) {
                            const c = bytes[start + n + (i * blockSize)];
                            innerName += (c >= 32 && c < 127) ? String.fromCharCode(c) : '.';
                        }
                        console.log(`      Next ${n}: "${innerName}"`);
                    }
                }
            }
        }
    }
};

const files = ['dev/bulkdump_full.txt', 'dev/bulk_dump.txt'];
files.forEach(f => {
    if (fs.existsSync(f)) bruteForce(f);
});
