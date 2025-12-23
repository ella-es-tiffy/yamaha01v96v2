
const midi = require('midi');

const input = new midi.Input();
input.openPort(0); // Port 1
input.ignoreTypes(false, false, false);

console.log('=== YAMAHA 01V96 - RAW METER CHECK ===');
console.log('Checking if meter data is still flowing...\n');

let messageCount = 0;
let lastMessageTime = Date.now();

input.on('message', (delta, msg) => {
    if (msg[0] === 0xFE) return; // Skip active sensing

    const hex = msg.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    // Log everything except heartbeat
    if (hex !== 'F0 43 10 3E 0D 7F F7') {
        messageCount++;
        lastMessageTime = Date.now();
        console.log(`[${messageCount}] ${hex}`);
    }
});

// Status check every 3 seconds
setInterval(() => {
    const timeSinceLastMessage = (Date.now() - lastMessageTime) / 1000;
    console.log(`\n📊 Status: ${messageCount} messages received`);
    console.log(`⏱️  Last message: ${timeSinceLastMessage.toFixed(1)}s ago`);

    if (timeSinceLastMessage > 5) {
        console.log('⚠️  NO METER DATA FLOWING! Bitte nochmal Audio auf CH1-3 abspielen!');
    }
}, 3000);

setInterval(() => { }, 1000);
