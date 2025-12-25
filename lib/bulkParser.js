/**
 * Bulk Dump Parser Module
 * Handles parsing of bulk dumps from the mixer
 */

class BulkParser {
    constructor() {
        this.buffer = [];
    }

    /**
     * Handle incoming bulk dump SysEx message
     * @param {Array} msg - SysEx message
     * @returns {Object|null} Parsed data or null
     */
    handleBulkDump(msg) {
        // Check for "LM  8C93" signature (Yamaha Library format)
        if (msg.length < 16) {
            console.log('[BULK] Message too short for bulk dump');
            return null;
        }

        const signature = String.fromCharCode(...msg.slice(7, 15));
        const type = msg[15];
        const typeHex = type.toString(16).toUpperCase();

        console.log(`[BULK] Signature: "${signature}", Type: 0x${typeHex}`);

        // Check for EQ Library (Q block, type 0x51)
        if (signature === "LM  8C93" && type === 0x51) {
            console.log('[BULK] + EQ Library block received');
            return { type: 'eq_library', data: msg };
        }

        // Check for Channel Names (R block, type 0x52)
        if (signature === "LM  8C93" && type === 0x52) {
            console.log('[BULK] + Channel Names block received');
            return { type: 'channel_names', data: msg };
        }

        return null;
    }

    /**
     * Parse channel names from R block
     * @param {Array} msg - SysEx message (type 0x52)
     * @returns {Array} Array of channel names
     */
    parseChannelNames(msg) {
        const names = [];
        const nameLength = 16;
        let offset = 20; // Start after header

        for (let ch = 0; ch < 32; ch++) {
            let name = '';
            for (let i = 0; i < nameLength; i++) {
                if (offset + i < msg.length) {
                    const c = msg[offset + i];
                    if (c >= 32 && c < 127) {
                        name += String.fromCharCode(c);
                    }
                }
            }
            names.push(name.trim());
            offset += nameLength;
        }

        console.log(`[BULK] Parsed ${names.length} channel names`);
        return names;
    }
}

module.exports = BulkParser;
