
const fs = require('fs');

function analyzeStride(filename) {
    const lines = fs.readFileSync(filename, 'utf8').split('\n');
    const line = lines[1]; // Line 2 of dump
    if (!line) return;
    const bytes = line.split(' ').filter(h => h.length === 2).map(h => parseInt(h, 16));

    const start = 52;
    const stride = 32;

    console.log("Analysis of 32-channel Edit Buffer Stride:");
    console.log("-------------------------------------------");
    for (let ch = 0; ch < 32; ch++) {
        const offset = start + ch * stride;
        if (offset + stride > bytes.length) break;
        const block = bytes.slice(offset, offset + stride);

        // Potential mapping:
        const eq = block.slice(0, 12);
        const fader = (block[28] << 7) | block[29]; // Yamaha often uses 7-bit shifts
        const muteStatus = block[30];

        console.log(`CH${(ch + 1).toString().padStart(2, '0')}: EQ[${eq.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}] Fader:${fader.toString().padStart(5, ' ')} Mute? ${muteStatus}`);
    }
}

analyzeStride('bulkdump_full.txt');
