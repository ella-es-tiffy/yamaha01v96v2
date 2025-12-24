const fs = require('fs');

const searchDeep = (filename) => {
    console.log(`\n--- Deep Searching ${filename} ---`);
    const content = fs.readFileSync(filename, 'utf8');
    const hexMatches = content.match(/[0-9A-Fa-f]{2}/g) || [];
    const bytes = hexMatches.map(h => parseInt(h, 16));

    const targets = ["Bass Drum", "Male Vocal", "tiff sub"];

    for (let i = 0; i < bytes.length - 1500; i++) {
        // Search for target strings with optional 0x00 gaps
        targets.forEach(t => {
            let matches = 0;
            let currentOffset = i;
            const targetChars = t.replace(/\s+/g, '').toLowerCase();

            for (let cIdx = 0; cIdx < targetChars.length; cIdx++) {
                const char = targetChars[cIdx];
                let found = false;
                // Look ahead up to 3 bytes for the next char
                for (let look = 0; look < 4; look++) {
                    if (currentOffset + look < bytes.length) {
                        const b = bytes[currentOffset + look];
                        if (String.fromCharCode(b).toLowerCase() === char) {
                            currentOffset += (look + 1);
                            matches++;
                            found = true;
                            break;
                        }
                    }
                }
                if (!found) break;
            }

            if (matches === targetChars.length) {
                console.log(`Potential Match for "${t}" at Byte ${i}:`);
                // Find nearest LM signature before this
                let sigIdx = -1;
                for (let s = i; s > Math.max(0, i - 1000); s--) {
                    if (bytes[s] === 0x4C && bytes[s + 1] === 0x4D && bytes[s + 8] >= 0x30) {
                        sigIdx = s;
                        break;
                    }
                }

                if (sigIdx !== -1) {
                    const sig = String.fromCharCode(...bytes.slice(sigIdx, sigIdx + 9));
                    console.log(`  Found Block Signature: "${sig}" at ${sigIdx}`);
                }

                // Print a chunk of text
                const chunk = bytes.slice(i, i + 100).map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
                console.log(`  Data Chunk: ${chunk}`);
            }
        });
    }
};

const files = ['dev/bulkdump_full.txt', 'dev/bulk_dump.txt', 'dev/aggressive_dump.txt', 'dev/bulkdump_new.txt'];
files.forEach(f => {
    if (fs.existsSync(f)) searchDeep(f);
});
