
const fs = require('fs');

function analyzeDump(filename) {
    const content = fs.readFileSync(filename, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, lineIdx) => {
        if (!line.startsWith('F0')) return;

        const bytes = line.trim().split(' ').map(h => parseInt(h, 16));
        console.log(`\nLine ${lineIdx + 1} - Length: ${bytes.length} bytes`);

        // Header looks for LM 8C93
        // 4C 4D 20 20 38 43 39 33
        const header = bytes.slice(0, 20).map(b => String.fromCharCode(b)).join('');
        console.log(`Header segment: ${header.replace(/[^ -~]/g, '.')}`);

        // Look for repeats of 32
        // We look for patterns that appear exactly 32 times at regular intervals
        for (let stride = 8; stride < 512; stride++) {
            let matches = 0;
            const firstBlock = bytes.slice(100, 100 + stride); // Start after header
            if (firstBlock.length < stride) continue;

            for (let i = 1; i < 32; i++) {
                const currentBlock = bytes.slice(100 + i * stride, 100 + (i + 1) * stride);
                if (currentBlock.length === stride) {
                    matches++;
                }
            }

            if (matches === 31) {
                console.log(`Potential stride found: ${stride} bytes repeated 32 times starting at offset 100`);
            }
        }
    });
}

analyzeDump('bulkdump_full.txt');
