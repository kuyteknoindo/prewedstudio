// A simple, non-cryptographically secure XOR encryption for basic obfuscation.
// This is not meant for high-security environments but satisfies the requirement
// to prevent casual inspection of tokens in localStorage.

const ENCRYPTION_KEY = "AIPreweddingPhotographerSecretKey2024";

/**
 * Encrypts or decrypts a string using a simple XOR cipher.
 * @param text The input string.
 * @param key The encryption key.
 * @returns The processed string.
 */
function xorCipher(text: string, key: string): string {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(
            text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        );
    }
    return result;
}

/**
 * Encrypts an object by serializing, XORing, and Base64 encoding it.
 * @param data The object to encrypt.
 * @returns An encrypted, Base64 encoded string.
 */
export function encryptData(data: unknown): string {
    try {
        const jsonString = JSON.stringify(data);
        const encryptedString = xorCipher(jsonString, ENCRYPTION_KEY);
        return btoa(encryptedString); // Base64 encode to handle binary characters
    } catch (e) {
        console.error("Encryption failed", e);
        throw new Error("Failed to encrypt data.");
    }
}

/**
 * Decrypts a string by Base64 decoding, XORing, and parsing it back to an object.
 * @param encryptedData The encrypted, Base64 encoded string.
 * @returns The decrypted object.
 */
export function decryptData(encryptedData: string): any {
    try {
        const decodedString = atob(encryptedData); // Base64 decode
        const decryptedJson = xorCipher(decodedString, ENCRYPTION_KEY);
        return JSON.parse(decryptedJson);
    } catch (e) {
        console.error("Decryption failed", e);
        throw new Error("Failed to decrypt data.");
    }
}