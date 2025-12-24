const fs = require('fs');

const dumpLibrary = (filename) => {
    console.log(`\n--- EQ Library in ${filename} ---`);
    const content = fs.readFileSync(filename, 'utf8');
    const hexMatches = content.match(/[0-9A-Fa-f]{2}/g) || [];
    const bytes = hexMatches.map(h => parseInt(h, 16));

    for (let i = 0; i < bytes.length - 16; i++) {
        if (bytes[i] === 0x4C && bytes[i + 1] === 0x4D && bytes[i + 8] === 0x51) {
            console.log(`Found Q Block at ${i}`);
            // Check if names are interleaved or sequential
            // Let's print the next bunch of chars
            const data = bytes.slice(i + 13, i + 500);
            const text = data.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : ' ').join('');
            console.log(`  Content: ${text}`);
        }
    }
};

const files = ['dev/aggressive_dump.txt', 'dev/bulk_dump.txt', 'dev/bulkdump_full.txt'];
files.forEach(f => {
    if (fs.existsSync(f)) dumpLibrary(f);
});
