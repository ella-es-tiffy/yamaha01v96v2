
const fs = require('fs');

function dumpEditBuffer(filename) {
    const lines = fs.readFileSync(filename, 'utf8').split('\n');
    const line = lines[1]; // Line 2
    if (!line) return;
    const v = line.split(' ');
    const bytes = [];
    for (let i = 0; i < v.length; i++) {
        if (v[i].length === 2) bytes.push(parseInt(v[i], 16));
    }

    console.log("Memory Dump Size:", bytes.length);

    const stride = 32;
    const startOffset = 52; // Heuristic start after "Initial Data" etc.

    for (let ch = 0; ch < 32; ch++) {
        const offset = startOffset + ch * stride;
        if (offset + 12 > bytes.length) break;
        const block = bytes.slice(offset, offset + 12); // Look at first 12 bytes
        console.log(`CH${(ch + 1).toString().padStart(2, '0')} @ ${offset}: ${block.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
    }
}

dumpEditBuffer('bulkdump_full.txt');
