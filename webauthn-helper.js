/**
 * WebAuthn Helper Utilities
 * ใช้สำหรับจัดการข้อมูล ArrayBuffer <-> Base64URL
 */

const WebAuthnHelper = {
    /**
     * แปลง ArrayBuffer เป็น Base64URL String
     * @param {ArrayBuffer} buffer 
     * @returns {string} base64url string
     */
    bufferToBase64URL: function(buffer) {
        if (!buffer) return '';
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = window.btoa(binary);
        return base64
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, ''); // ลบ padding = ออกตามมาตรฐาน Base64URL
    },

    /**
     * แปลง Base64URL String เป็น Uint8Array (Buffer)
     * @param {string} base64url 
     * @returns {Uint8Array}
     */
    base64URLToBuffer: function(base64url) {
        if (!base64url) return new Uint8Array(0);
        
        // กู้คืน padding (=) ที่ถูกตัดออกไป
        let base64 = base64url
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        
        const pad = base64.length % 4;
        if (pad) {
            if (pad === 1) {
                throw new Error('Invalid Base64URL string');
            }
            base64 += new Array(5 - pad).join('=');
        }

        const binary = window.atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    },

    /**
     * แปลง String ทั่วไปเป็น Uint8Array (Buffer)
     * @param {string} str 
     * @returns {Uint8Array}
     */
    stringToBuffer: function(str) {
        return new TextEncoder().encode(str);
    },

    /**
     * แปลง Uint8Array (Buffer) เป็น String
     * @param {ArrayBuffer} buffer 
     * @returns {string}
     */
    bufferToString: function(buffer) {
        return new TextDecoder().decode(buffer);
    },

    /**
     * สร้าง Challenge แบบสุ่ม (Cryptographically Random Bytes)
     * @param {number} length 
     * @returns {Uint8Array}
     */
    generateChallenge: function(length = 32) {
        const randomValues = new Uint8Array(length);
        window.crypto.getRandomValues(randomValues);
        return randomValues;
    }
};
