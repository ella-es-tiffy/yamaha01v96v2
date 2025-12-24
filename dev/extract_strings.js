const fs = require('fs');

const extractStrings = (filename) => {
    console.log(`\n--- Strings in ${filename} ---`);
    const content = fs.readFileSync(filename, 'utf8');
    const hexMatches = content.match(/[0-9A-Fa-f]{2}/g) || [];
    const bytes = hexMatches.map(h => parseInt(h, 16));

    let currentStr = "";
    for (let b of bytes) {
        if (b >= 32 && b < 127) {
            currentStr += String.fromCharCode(b);
        } else {
            if (currentStr.length >= 4) {
                console.log(currentStr);
            }
            currentStr = "";
        }
    }
};

extractStrings('dev/bulkdump_full.txt');
