/**
 * MIDI Helper Functions
 * Utility functions for MIDI data encoding/decoding
 */

class MIDIHelpers {
    /**
     * Convert 14-bit value to MSB/LSB
     * @param {number} value - 14-bit value (0-16383)
     * @returns {Array} [MSB, LSB]
     */
    static to14bit(value) {
        const msb = (value >> 7) & 0x7F;
        const lsb = value & 0x7F;
        return [msb, lsb];
    }

    /**
     * Convert MSB/LSB to 14-bit value
     * @param {number} msb - Most significant byte
     * @param {number} lsb - Least significant byte
     * @returns {number} 14-bit value
     */
    static from14bit(msb, lsb) {
        return ((msb & 0x7F) << 7) | (lsb & 0x7F);
    }

    /**
     * Convert float (0.0-1.0) to 7-bit MIDI value
     * @param {number} value - Float value (0.0-1.0)
     * @returns {number} 7-bit MIDI value (0-127)
     */
    static floatTo7bit(value) {
        return Math.round(Math.max(0, Math.min(1, value)) * 127);
    }

    /**
     * Convert 7-bit MIDI value to float (0.0-1.0)
     * @param {number} value - 7-bit MIDI value (0-127)
     * @returns {number} Float value (0.0-1.0)
     */
    static from7bitToFloat(value) {
        return (value & 0x7F) / 127.0;
    }

    /**
     * Calculate Yamaha-style checksum (if needed)
     * @param {Array} data - Data bytes
     * @returns {number} Checksum byte
     */
    static calculateChecksum(data) {
        let sum = 0;
        for (const byte of data) {
            sum += byte;
        }
        return (128 - (sum % 128)) & 0x7F;
    }

    /**
     * Format SysEx message for logging
     * @param {Array} msg - SysEx message
     * @returns {string} Formatted hex string
     */
    static formatSysEx(msg) {
        return msg.map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    }

    /**
     * Encode ASCII string to 7-bit MIDI bytes
     * @param {string} str - String to encode
     * @param {number} length - Desired length (pads with spaces)
     * @returns {Array} Array of bytes
     */
    static encodeASCII(str, length) {
        const bytes = [];
        for (let i = 0; i < length; i++) {
            if (i < str.length) {
                bytes.push(str.charCodeAt(i) & 0x7F);
            } else {
                bytes.push(0x20); // Space
            }
        }
        return bytes;
    }

    /**
     * Decode 7-bit MIDI bytes to ASCII string
     * @param {Array} bytes - Array of bytes
     * @returns {string} Decoded string
     */
    static decodeASCII(bytes) {
        let str = '';
        for (const byte of bytes) {
            if (byte >= 32 && byte < 127) {
                str += String.fromCharCode(byte);
            }
        }
        return str.trim();
    }
}

module.exports = MIDIHelpers;
