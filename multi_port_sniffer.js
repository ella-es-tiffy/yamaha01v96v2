const midi = require('midi');

function scanPorts() {
    const input = new midi.Input();
    const output = new midi.Output();

    console.log('--- MIDI PORT SCAN ---');
    console.log('Inputs:');
    for (let i = 0; i < input.getPortCount(); i++) {
        console.log(`  [${i}] ${input.getPortName(i)}`);
    }
    console.log('\nOutputs:');
    for (let i = 0; i < output.getPortCount(); i++) {
        console.log(`  [${i}] ${output.getPortName(i)}`);
    }
}

async function sniffAllPorts() {
    const input = new midi.Input();
    const ports = [];

    for (let i = 0; i < input.getPortCount(); i++) {
        const name = input.getPortName(i);
        if (name.includes('YAMAHA')) {
            const sniffer = new midi.Input();
            sniffer.openPort(i);
            sniffer.ignoreTypes(false, false, false);
            sniffer.on('message', (dt, msg) => {
                const hex = msg.map(b => b.toString(16).padStart(2, '0')).join(' ');
                console.log(`[PORT ${i}] (${name}) RX: ${hex}`);
            });
            ports.push({ sniffer, name, index: i });
            console.log(`✓ Sniffing Port ${i}: ${name}`);
        }
    }

    if (ports.length === 0) {
        console.log('❌ No Yamaha ports found.');
        return;
    }

    // Send meter requests to Port 1 and Port 2 specifically
    const output = new midi.Output();
    const meterReq = [0xF0, 0x43, 0x30, 0x3E, 0x0D, 0x21, 0x00, 0x00, 0x00, 0x00, 0x20, 0xF7];

    for (let i = 0; i < output.getPortCount(); i++) {
        const name = output.getPortName(i);
        if (name.includes('YAMAHA')) {
            console.log(`📤 Sending METER REQUEST to ${name}...`);
            const out = new midi.Output();
            out.openPort(i);
            out.sendMessage(meterReq);

            // Keep sending to triggers
            setInterval(() => {
                out.sendMessage(meterReq);
            }, 500);
        }
    }

    console.log('\n🎧 Listening for ANY traffic for 10 seconds...');
    await new Promise(r => setTimeout(r, 10000));
    process.exit(0);
}

scanPorts();
sniffAllPorts();
