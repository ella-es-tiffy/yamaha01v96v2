
const fs = require('fs');

function guessEQ(filename) {
    const line = fs.readFileSync(filename, 'utf8').split('\n')[22]; // Line 23
    if (!line) return;
    const v = line.split(' ');
    const bytes = [];
    for (let i = 0; i < v.length; i++) {
        if (v[i].length === 2) bytes.push(parseInt(v[i], 16));
    }

    console.log("Memory Dump Size:", bytes.length);

    // Common 01V96 Edit Buffer Map:
    // Input Channel 1: starts at 154? 
    // Let's look for the name "Initial  Data" which ends at byte 35?

    // We try to find a repeating sequence of 32.
    // For each offset, we see if values at offset + i*stride are "similar" (e.g. all 64)
    for (let stride = 64; stride < 256; stride++) {
        for (let start = 40; start < 500; start++) {
            let matches = 0;
            const ref = bytes[start];
            for (let i = 1; i < 32; i++) {
                if (bytes[start + i * stride] === ref) matches++;
            }
            if (matches > 28) {
                // Potential repeat!
                console.log(`Repeated value ${ref} at offset ${start} with stride ${stride}`);
                // If we found a block, let's see what's in it.
                if (stride >= 100) {
                    console.log(`Sample block for Ch1:`, bytes.slice(start, start + 20).join(' '));
                    console.log(`Sample block for Ch2:`, bytes.slice(start + stride, start + stride + 20).join(' '));
                    return;
                }
            }
        }
    }
}

guessEQ('bulkdump_full.txt');
