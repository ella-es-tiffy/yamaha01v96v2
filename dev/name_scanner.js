const fs = require('fs');

const scanAllPossibleNames = (filename) => {
    console.log(`\n--- Scanning for ALL Names in ${filename} ---`);
    const content = fs.readFileSync(filename, 'utf8');
    const hex = content.match(/[0-9A-Fa-f]{2}/g) || [];
    const bytes = hex.map(h => parseInt(h, 16));

    const extractName = (start) => {
        let name = "";
        let count = 0;
        for (let i = 0; i < 20; i++) {
            if ((start + i) % 8 === 0) continue; // Skip bit-bytes
            const charCode = bytes[start + i];
            if (charCode >= 32 && charCode < 127) {
                name += String.fromCharCode(charCode);
                count++;
            } else {
                break;
            }
            if (count >= 12) break;
        }
        return name.trim();
    };

    const found = new Set();
    for (let i = 0; i < bytes.length - 20; i++) {
        const name = extractName(i);
        if (name.length >= 6) {
            const lower = name.toLowerCase();
            if (lower.includes('bass') || lower.includes('drum') || lower.includes('vocal') || lower.includes('male') || lower.includes('piano') || lower.includes('guit')) {
                if (!found.has(name)) {
                    console.log(`Found Name at offset ${i}: "${name}"`);
                    found.add(name);
                }
            }
        }
    }
};

scanAllPossibleNames('dev/aggressive_dump.txt');
scanAllPossibleNames('dev/bulk_dump.txt');
