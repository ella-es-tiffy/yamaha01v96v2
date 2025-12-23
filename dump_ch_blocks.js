
const fs = require('fs');

function dumpBlocks(filename) {
    const lines = fs.readFileSync(filename, 'utf8').split('\n');
    const line = lines[22]; // Line 23
    const v = line.split(' ');
    const bytes = [];
    for (let i = 0; i < v.length; i++) {
        if (v[i].length === 2) bytes.push(parseInt(v[i], 16));
    }

    const stride = 126;
    const startOffset = 40; // Skip header

    for (let ch = 0; ch < 32; ch++) {
        const offset = startOffset + ch * stride;
        const block = bytes.slice(offset, offset + stride);
        console.log(`CH${(ch + 1).toString().padStart(2, '0')} Offset ${offset.toString().padStart(4, '0')}: ${block.slice(0, 40).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
    }
}

dumpBlocks('bulkdump_full.txt');
