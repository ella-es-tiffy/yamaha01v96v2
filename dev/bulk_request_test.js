const midi = require('midi');

console.log('=== Bulk Dump Request Tester ===\n');

const output = new midi.Output();
const input = new midi.Input();

// Find 01V96 port
let portIdx = -1;
for (let i = 0; i < output.getPortCount(); i++) {
    const name = output.getPortName(i);
    if (name.includes('01V96') || name.includes('Port1')) {
        portIdx = i;
        console.log(`Found mixer on port ${i}: ${name}\n`);
        break;
    }
}

if (portIdx === -1) {
    console.error('No 01V96 found!');
    process.exit(1);
}

output.openPort(portIdx);
input.openPort(portIdx);

// Track responses
let responseCount = 0;
input.on('message', (deltaTime, msg) => {
    // Check if it's an EQ Library response (LM 8C93 Q)
    if (msg[0] === 0xF0 && msg[1] === 0x43 &&
        msg[7] === 0x4C && msg[8] === 0x4D && msg[15] === 0x51) {
        responseCount++;
        console.log(`  ✓ Response ${responseCount}: EQ Preset ID ${msg[17]} (${msg.length} bytes)`);
    }
});

// Test different bulk dump requests
const tests = [
    { name: 'Current (0E 02)', msg: [0xF0, 0x43, 0x20, 0x3E, 0x0E, 0x02, 0xF7] },
    { name: 'Variant (0E 00)', msg: [0xF0, 0x43, 0x20, 0x3E, 0x0E, 0x00, 0xF7] },
    { name: 'Variant (0E 01)', msg: [0xF0, 0x43, 0x20, 0x3E, 0x0E, 0x01, 0xF7] },
    { name: 'Variant (0E 03)', msg: [0xF0, 0x43, 0x20, 0x3E, 0x0E, 0x03, 0xF7] },
    { name: 'Variant (0E 04)', msg: [0xF0, 0x43, 0x20, 0x3E, 0x0E, 0x04, 0xF7] },
    { name: 'All Data (10 00)', msg: [0xF0, 0x43, 0x20, 0x3E, 0x10, 0x00, 0xF7] },
    { name: 'All Data (10 01)', msg: [0xF0, 0x43, 0x20, 0x3E, 0x10, 0x01, 0xF7] },
    { name: 'Library (0F 00)', msg: [0xF0, 0x43, 0x20, 0x3E, 0x0F, 0x00, 0xF7] },
    { name: 'Library (0F 01)', msg: [0xF0, 0x43, 0x20, 0x3E, 0x0F, 0x01, 0xF7] },
    { name: 'Library (0F 02)', msg: [0xF0, 0x43, 0x20, 0x3E, 0x0F, 0x02, 0xF7] },
];

let testIdx = 0;

async function runTests() {
    for (const test of tests) {
        responseCount = 0;
        console.log(`[${testIdx + 1}/${tests.length}] Testing: ${test.name}`);
        console.log(`  Request: ${test.msg.map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase()}`);

        output.sendMessage(test.msg);

        // Wait for responses
        await new Promise(r => setTimeout(r, 1500));

        if (responseCount === 0) {
            console.log(`  ✗ No response\n`);
        } else {
            console.log(`  → Total responses: ${responseCount}\n`);
        }

        testIdx++;
    }

    console.log('=== Test Complete ===');
    console.log('\nIf any test received multiple EQ preset responses,');
    console.log('that request successfully triggers the full library dump!');

    process.exit(0);
}

runTests();
