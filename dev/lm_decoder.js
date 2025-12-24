const fs = require('fs');

const decodeLM = (bytes) => {
    const rawData = [];
    for (let i = 0; i < bytes.length; i++) {
        if (i % 8 === 0) continue; // Skip bit-byte
        rawData.push(bytes[i]);
    }
    return rawData.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
};

const scanFile = (filename) => {
    console.log(`\n--- Decoding LM Data in ${filename} ---`);
    const content = fs.readFileSync(filename, 'utf8');
    const hex = content.match(/[0-9A-Fa-f]{2}/g) || [];
    const bytes = hex.map(h => parseInt(h, 16));

    // Find all LM signatures
    for (let i = 0; i < bytes.length - 15; i++) {
        if (bytes[i] === 0x4C && bytes[i + 1] === 0x4D && bytes[i + 8] >= 0x30) {
            const data = bytes.slice(i + 13, i + 100);
            const decoded = decodeLM(data);
            console.log(`Sig at ${i}: "${String.fromCharCode(...bytes.slice(i, i + 9))}" Decoded Preview: ${decoded.substring(0, 50)}`);
        }
    }
};

scanFile('dev/bulkdump_full.txt');
