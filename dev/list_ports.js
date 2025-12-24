const midi = require('midi');
const input = new midi.Input();
for (let i = 0; i < input.getPortCount(); i++) {
    console.log(`Port ${i}: ${input.getPortName(i)}`);
}
