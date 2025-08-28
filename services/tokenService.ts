import * as encryptionService from './encryptionService';

export interface Token {
    value: string;
    status: 'available' | 'active' | 'used';
    createdAt: number;
    expiresAt: number | null;
    usedAt?: number;
    deviceFingerprint?: string;
    sessionId?: string;
    lastActivity?: number;
}

export interface EncryptedFile {
    metadata: {
        version: string;
        created: string;
        application: string;
        tokenCount: number;
    };
    tokens: Token[];
    timestamp: number;
    checksum: string; // Simple checksum, can be improved
}

const TOKEN_STORAGE_KEY = 'app_auth_tokens_encrypted_v2';
const DEVICE_ID_KEY = 'app_device_fingerprint';

// In-memory cache for tokens
let tokens: Token[] = [];

// --- Storage & Encryption ---

const loadTokensFromStorage = () => {
    try {
        const encryptedTokens = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (encryptedTokens) {
            const decryptedTokens = encryptionService.decryptData(encryptedTokens);
            if (Array.isArray(decryptedTokens)) {
                tokens = decryptedTokens;
                console.log(`Loaded ${tokens.length} tokens from encrypted storage.`);
            }
        }
    } catch (e) {
        console.error("Failed to load or decrypt tokens. Starting fresh.", e);
        tokens = [];
    }
};

const saveTokensToStorage = () => {
    try {
        const encryptedTokens = encryptionService.encryptData(tokens);
        localStorage.setItem(TOKEN_STORAGE_KEY, encryptedTokens);
    } catch (e) {
        console.error("Failed to encrypt or save tokens.", e);
    }
};

// Initial load when the module is imported
loadTokensFromStorage();


// --- Helper Functions ---

const generateRandomString = (length: number): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export const getDeviceFingerprint = (): string => {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
        deviceId = generateRandomString(32);
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
};

const cleanupInactiveTokens = (): boolean => {
    const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
    let changed = false;
    tokens.forEach(token => {
        if (token.status === 'active' && token.lastActivity && token.lastActivity < fifteenMinutesAgo) {
            console.log(`Token ${token.value} session expired due to inactivity.`);
            token.status = 'used';
            token.usedAt = token.lastActivity; // Mark as used at the time of last activity
            changed = true;
        }
    });
    return changed;
};

// --- Public API ---

export const getTokens = (): Token[] => {
    if (cleanupInactiveTokens()) {
        saveTokensToStorage();
    }
    return [...tokens].sort((a, b) => b.createdAt - a.createdAt); // Return a sorted copy
};

export const createToken = (expiryInDays: number | null): Token => {
    const newToken: Token = {
        value: generateRandomString(24),
        status: 'available',
        createdAt: Date.now(),
        expiresAt: expiryInDays ? Date.now() + expiryInDays * 24 * 60 * 60 * 1000 : null,
    };
    tokens.push(newToken);
    saveTokensToStorage();
    return newToken;
};

export const validateToken = (tokenValue: string): boolean => {
    if (cleanupInactiveTokens()) {
        saveTokensToStorage();
    }
    const token = tokens.find(t => t.value === tokenValue);

    if (!token) return false;
    if (token.expiresAt && token.expiresAt < Date.now()) return false;
    if (token.status === 'used') return false;

    // If active, it must be from the same device
    if (token.status === 'active') {
        return token.deviceFingerprint === getDeviceFingerprint();
    }
    
    return token.status === 'available';
};

export const activateToken = (tokenValue: string): Token | null => {
    const tokenIndex = tokens.findIndex(t => t.value === tokenValue);
    if (tokenIndex === -1) return null;

    const token = tokens[tokenIndex];
    const fingerprint = getDeviceFingerprint();

    // Allow activation if available, or if it's the same device re-activating
    if (token.status === 'available' || (token.status === 'active' && token.deviceFingerprint === fingerprint)) {
        token.status = 'active';
        token.deviceFingerprint = fingerprint;
        token.sessionId = generateRandomString(16);
        token.lastActivity = Date.now();
        saveTokensToStorage();
        return { ...token };
    }
    return null;
};

export const updateTokenActivity = (tokenValue: string): void => {
    const token = tokens.find(t => t.value === tokenValue && t.status === 'active');
    if (token && token.deviceFingerprint === getDeviceFingerprint()) {
        token.lastActivity = Date.now();
        // Saving on every activity update might be too frequent.
        // We can optimize this later if needed, but for now, it ensures consistency.
        saveTokensToStorage();
    }
};

export const deactivateToken = (tokenValue: string): void => {
    const tokenIndex = tokens.findIndex(t => t.value === tokenValue);
    if (tokenIndex !== -1) {
        tokens[tokenIndex].status = 'used';
        tokens[tokenIndex].usedAt = Date.now();
        tokens[tokenIndex].sessionId = undefined;
        tokens[tokenIndex].lastActivity = undefined;
        saveTokensToStorage();
    }
};


export const releaseToken = (tokenValue: string): void => {
   deactivateToken(tokenValue);
};

export const deleteToken = (tokenValue: string): void => {
    tokens = tokens.filter(t => t.value !== tokenValue);
    saveTokensToStorage();
};

// --- File Management ---

const generateChecksum = (data: string): string => {
    let checksum = 0;
    for (let i = 0; i < data.length; i++) {
        checksum = (checksum + data.charCodeAt(i)) % 65536;
    }
    return checksum.toString(16);
};

export const exportTokensToFile = (): void => {
    const tokensToExport = getTokens();
    const fileContentString = JSON.stringify(tokensToExport);
    const fileData: EncryptedFile = {
        metadata: {
            version: '1.0.0',
            created: new Date().toISOString(),
            application: 'AI Prewedding Photographer',
            tokenCount: tokensToExport.length,
        },
        tokens: tokensToExport,
        timestamp: Date.now(),
        checksum: generateChecksum(fileContentString),
    };

    const encryptedData = encryptionService.encryptData(fileData);
    const blob = new Blob([encryptedData], { type: 'text/plain;charset=utf-8' });
    const filename = `photographer-tokens-backup-${new Date().toISOString().split('T')[0]}.txt`;
    
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const importTokensFromFile = (fileContent: string): { success: boolean, message: string, count: number } => {
    try {
        const decryptedData = encryptionService.decryptData(fileContent) as EncryptedFile;

        // Basic validation
        if (!decryptedData || !decryptedData.metadata || !Array.isArray(decryptedData.tokens)) {
            throw new Error('Format file tidak valid.');
        }
        if (decryptedData.metadata.application !== 'AI Prewedding Photographer') {
            throw new Error('File ini bukan untuk aplikasi ini.');
        }

        const checksum = generateChecksum(JSON.stringify(decryptedData.tokens));
        if (checksum !== decryptedData.checksum) {
            console.warn('Checksum mismatch, but proceeding with import.');
        }
        
        // Merge strategy: Overwrite existing tokens with imported ones if they have the same value.
        const importedTokens = decryptedData.tokens;
        const existingTokens = getTokens();
        const tokenMap = new Map(existingTokens.map(t => [t.value, t]));

        for(const importedToken of importedTokens) {
            tokenMap.set(importedToken.value, importedToken);
        }
        
        tokens = Array.from(tokenMap.values());
        saveTokensToStorage();

        return { success: true, message: `Berhasil mengimpor ${importedTokens.length} token.`, count: tokens.length };
    } catch (e) {
        console.error("Import failed:", e);
        const message = e instanceof Error ? e.message : 'Gagal mendekripsi atau memproses file.';
        return { success: false, message, count: 0 };
    }
};