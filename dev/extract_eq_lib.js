const fs = require('fs');

const extractLibraryNames = (filename) => {
    console.log(`\n--- Extracting EQ Library Names from ${filename} ---`);
    const content = fs.readFileSync(filename, 'utf8');
    const hexMatches = content.match(/[0-9A-Fa-f]{2}/g) || [];
    const bytes = hexMatches.map(h => parseInt(h, 16));

    const results = [];

    for (let i = 0; i < bytes.length - 20; i++) {
        // Look for LM  8C93Q (EQ Library)
        if (bytes[i] === 0x4C && bytes[i + 1] === 0x4D && bytes[i + 8] === 0x51) {
            // Index is often at offset 9 or 10
            const idx = bytes[i + 10];
            // Name starts around i+14 (usually 12 characters)
            const nameBytes = bytes.slice(i + 14, i + 26);
            const name = nameBytes.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '').join('').trim();

            if (name) {
                results.push({ offset: i, id: idx, name: name });
            }
        }
    }

    // Sort by offset or ID
    results.sort((a, b) => a.id - b.id);

    results.forEach(r => {
        console.log(`ID: ${r.id.toString().padStart(3, '0')} | Name: "${r.name}" (at ${r.offset})`);
    });
};

const files = ['dev/bulkdump_full.txt', 'dev/bulkdump_new.txt', 'dev/aggressive_dump.txt'];
files.forEach(f => {
    if (fs.existsSync(f)) extractLibraryNames(f);
});
