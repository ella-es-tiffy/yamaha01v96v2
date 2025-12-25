/**
 * EQ Preset Management Module
 * Handles recall, save, delete operations for EQ presets
 */

class EQPresetManager {
    constructor(output) {
        this.output = output;
        this.state = { eqPresets: {} };
    }

    /**
     * Recall EQ Preset
     * @param {number} channel - Channel number (1-32)
     * @param {number} presetIdx - Preset index (1-128)
     */
    recallEQ(channel, presetIdx) {
        // ID is 1-based for EQ Library (Slot 1 = ID 1)
        const id = presetIdx;

        console.log(`[RECALL EQ] Channel ${channel}, Preset ${presetIdx} (MIDI ID ${id})`);

        // Command: F0 43 10 3E 7F 10 01 00 [ID] 00 00 F7
        const msg = [0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x10, 0x01, 0x00, id & 0x7F, 0x00, 0x00, 0xF7];

        this.output.sendMessage(msg);
        console.log(`[RECALL EQ] Sent: ${msg.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    }

    /**
     * Save EQ Preset with Name
     * @param {number} channel - Channel number (1-32)
     * @param {number} presetIdx - Preset index (41-128, user range)
     * @param {string} name - Preset name (max 16 chars, padded with spaces)
     */
    saveEQ(channel, presetIdx, name = '') {
        const id = presetIdx;

        if (presetIdx < 41 || presetIdx > 128) {
            console.error(`[SAVE EQ] Invalid preset index ${presetIdx}. Must be 41-128 (user range).`);
            return;
        }

        console.log(`[SAVE EQ] Channel ${channel}, Preset ${presetIdx} (MIDI ID ${id}), Name: "${name}"`);

        // Update local state immediately so UI reflects it
        if (!this.state.eqPresets) this.state.eqPresets = {};
        this.state.eqPresets[id] = name;

        // Step 1: Initiate Store
        // F0 43 10 3E 7F 10 21 00 [ID] 00 00 F7
        const storeMsg = [0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x10, 0x21, 0x00, id & 0x7F, 0x00, 0x00, 0xF7];
        this.output.sendMessage(storeMsg);
        console.log(`[SAVE EQ] Store initiated: ${storeMsg.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);

        // Step 2: Set Name (after small delay)
        setTimeout(() => {
            // Encode name to 16-byte ASCII, pad with spaces
            const nameBytes = this.encodePresetName(name);

            // F0 43 10 3E 7F 10 41 00 [ID] [NAME_16_BYTES] F7
            const nameMsg = [0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x10, 0x41, 0x00, id & 0x7F, ...nameBytes, 0xF7];
            this.output.sendMessage(nameMsg);
            console.log(`[SAVE EQ] Name set: ${nameMsg.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
        }, 100);
    }

    /**
     * Delete EQ Preset
     * @param {number} presetIdx - Preset index (41-128, user range)
     */
    deleteEQ(presetIdx) {
        const id = presetIdx;

        if (presetIdx < 41 || presetIdx > 128) {
            console.error(`[DELETE EQ] Invalid preset index ${presetIdx}. Must be 41-128 (user range).`);
            return;
        }

        console.log(`[DELETE EQ] Preset ${presetIdx} (MIDI ID ${id})`);

        // F0 43 10 3E 7F 10 61 00 [ID] F7
        const msg = [0xF0, 0x43, 0x10, 0x3E, 0x7F, 0x10, 0x61, 0x00, id & 0x7F, 0xF7];
        this.output.sendMessage(msg);
        console.log(`[DELETE EQ] Sent: ${msg.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    }

    /**
     * Encode preset name to 16-byte ASCII array
     * @param {string} name - Name to encode
     * @returns {Array} 16-byte array
     */
    encodePresetName(name) {
        const bytes = [];
        const maxLength = 16;

        // Convert to ASCII bytes
        for (let i = 0; i < maxLength; i++) {
            if (i < name.length) {
                bytes.push(name.charCodeAt(i) & 0x7F); // 7-bit ASCII
            } else {
                bytes.push(0x20); // Space padding
            }
        }

        return bytes;
    }

    /**
     * Process EQ Preset Names from Bulk Dump (0x51 messages)
     * @param {Array} msg - SysEx message
     */
    processEQNames(msg) {
        const id = msg[17]; // 1-based ID from mixer

        console.log(`[EQ RAW] Parsing Preset ID ${id}`);

        // Read name directly (16 bytes starting at position 20)
        let nameRaw = "";
        for (let i = 20; i < 36 && i < msg.length; i++) {
            const c = msg[i];
            if (c >= 32 && c < 127) {
                nameRaw += String.fromCharCode(c);
            } else {
                nameRaw += "_";
            }
        }

        const name = nameRaw.replace(/_/g, '').trim();

        if (name.length > 0) {
            console.log(`[EQ PRESET PARSED] #${id}: "${name}"`);

            if (!this.state.eqPresets) this.state.eqPresets = {};
            this.state.eqPresets[id] = name;

            return { id: id, name };
        } else {
            console.log(`[EQ PARSE FAIL] Name empty after cleanup`);
            return null;
        }
    }

    /**
     * Get preset state
     */
    getPresets() {
        return this.state.eqPresets || {};
    }

    /**
     * Set preset state
     */
    setPresets(presets) {
        this.state.eqPresets = presets;
    }
}

module.exports = EQPresetManager;
