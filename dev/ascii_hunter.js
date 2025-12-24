const fs = require('fs');

const findStrings = (filename) => {
    console.log(`\n--- Deep ASCII Search in ${filename} ---`);
    const content = fs.readFileSync(filename, 'utf8');
    const hex = content.match(/[0-9A-Fa-f]{2}/g) || [];
    const bytes = hex.map(h => parseInt(h, 16));

    for (let i = 0; i < bytes.length - 12; i++) {
        let str = "";
        for (let j = 0; j < 12; j++) {
            const b = bytes[i + j];
            if (b >= 32 && b < 127) str += String.fromCharCode(b);
            else break;
        }
        if (str.length >= 4) {
            const lower = str.toLowerCase();
            if (lower.includes('ash') || lower.includes('fla')) {
                console.log(`Potential Match at byte ${i}: "${str}" (Hex: ${bytes[i].toString(16)}...)`);
                // Also show some context
                const context = bytes.slice(Math.max(0, i - 20), i + 40).map(x => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');
                console.log(`  Context: ${context}`);
            }
        }
    }
};

findStrings('dev/hunt_flash_dump_full.txt');
findStrings('dev/scan_results.txt');
