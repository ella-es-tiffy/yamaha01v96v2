const fs = require('fs');

const extractPresets = (filename) => {
    console.log(`\n--- Searching for Presets in ${filename} ---`);
    const content = fs.readFileSync(filename, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, lIdx) => {
        if (line.includes('4C 4D 20 20 38 43 39 33 51')) { // "LM  8C93Q"
            const bytes = line.split(' ').map(h => parseInt(h, 16));
            // In these blocks, ID 0x28 (40) was tiff sub.
            // ID is at index 16 (0-based)
            const id = bytes[16];

            // Name starts at 20
            const nameBytes = bytes.slice(20, 35); // Take a chunk
            const name = nameBytes.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '').join('');

            console.log(`Line ${lIdx}: ID=${id} (Display=${id + 1}) Name="${name.trim()}"`);
        }
    });
};

extractPresets('dev/aggressive_dump.txt');
extractPresets('dev/flash_hunt_dump.txt');
