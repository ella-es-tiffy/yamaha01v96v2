const fs = require('fs');

const deinterleave = (bytes, blockSize, nameLen = 12) => {
    const rawData = [];
    // Skip bit-bytes if it's LM format (every 8th byte)
    // Actually, let's try BOTH with and without skipping bit-bytes
    const tryExtract = (data) => {
        const names = [];
        for (let ch = 0; ch < blockSize; ch++) {
            let name = "";
            for (let charPos = 0; charPos < nameLen; charPos++) {
                const idx = (charPos * blockSize) + ch;
                if (idx >= data.length) break;
                const charCode = data[idx];
                name += (charCode >= 32 && charCode < 127) ? String.fromCharCode(charCode) : '.';
            }
            if (name.replace(/\./g, '').trim().length > 3) {
                names.push({ id: ch, name: name.trim() });
            }
        }
        return names;
    };

    // Case 1: LM skip bit-bytes
    const lmData = [];
    for (let i = 0; i < bytes.length; i++) {
        if (i % 8 === 0) continue;
        lmData.push(bytes[i]);
    }

    // Case 2: Standard block
    const results = [];
    [32, 40, 64, 128].forEach(bs => {
        const n1 = tryExtract(lmData);
        if (n1.length > 0) results.push({ format: 'LM', blockSize: bs, names: n1 });
        const n2 = tryExtract(bytes);
        if (n2.length > 0) results.push({ format: 'STD', blockSize: bs, names: n2 });
    });
    return results;
};

const scanFile = (filename) => {
    console.log(`\n--- Deep Scanning ${filename} for Interleaved Names ---`);
    const content = fs.readFileSync(filename, 'utf8');
    const hexMatches = content.match(/[0-9A-Fa-f]{2}/g) || [];
    const fullBytes = hexMatches.map(h => parseInt(h, 16));

    // Find all large F0 .. F7 messages
    const messages = [];
    let currentMsg = [];
    for (let b of fullBytes) {
        if (b === 0xF0) currentMsg = [b];
        else if (b === 0xF7) {
            currentMsg.push(b);
            if (currentMsg.length > 100) messages.push(currentMsg);
            currentMsg = [];
        } else if (currentMsg.length > 0) {
            currentMsg.push(b);
        }
    }

    messages.forEach((msg, mIdx) => {
        console.log(`Message ${mIdx} (Len: ${msg.length}) Header: ${msg.slice(0, 20).map(x => x.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);

        // Try de-interleaving the data portion (usually starts at 20)
        const data = msg.slice(20, -1);
        const res = deinterleave(data, 32); // Try blockSize 32
        res.forEach(r => {
            const matches = r.names.filter(n => n.name.toLowerCase().includes('bass') || n.name.toLowerCase().includes('drum') || n.name.toLowerCase().includes('vocal') || n.name.toLowerCase().includes('male'));
            if (matches.length > 0) {
                console.log(`  [FOUND] Format: ${r.format} BlockSize: 32`);
                r.names.forEach(n => console.log(`    ${n.id}: ${n.name}`));
            }
        });

        // Also try other block sizes
        [40, 64, 128].forEach(bs => {
            const res2 = deinterleave(data, bs);
            res2.forEach(r => {
                const matches = r.names.filter(n => n.name.toLowerCase().includes('bass') || n.name.toLowerCase().includes('drum') || n.name.toLowerCase().includes('vocal') || n.name.toLowerCase().includes('male'));
                if (matches.length > 0) {
                    console.log(`  [FOUND] Format: ${r.format} BlockSize: ${bs}`);
                    r.names.forEach(n => console.log(`    ${n.id}: ${n.name}`));
                }
            });
        });
    });
};

const files = ['dev/bulkdump_full.txt', 'dev/bulk_dump.txt'];
files.forEach(f => {
    if (fs.existsSync(f)) scanFile(f);
});
