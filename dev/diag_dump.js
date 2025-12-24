const fs = require('fs');

const dumpFile = 'dev/hunt_flash_dump_full.txt';
if (fs.existsSync(dumpFile)) {
    const stats = fs.statSync(dumpFile);
    console.log(`File: ${dumpFile} | Size: ${stats.size} bytes`);
    const content = fs.readFileSync(dumpFile, 'utf8');
    const lines = content.split('\n');
    console.log(`Lines: ${lines.length}`);
    if (lines.length > 5) {
        console.log("First 5 lines:");
        lines.slice(0, 5).forEach(l => console.log(l.substring(0, 50) + "..."));
    }
} else {
    console.log("File not found.");
}
