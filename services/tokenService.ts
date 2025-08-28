export interface Token {
    value: string;
    status: 'available' | 'used';
    createdAt: number;
    expiresAt: number | null;
    usedAt?: number;
}

const TOKEN_STORAGE_KEY = 'app_auth_tokens';

// --- Token Database ---

export const getTokens = (): Token[] => {
    try {
        const storedTokens = localStorage.getItem(TOKEN_STORAGE_KEY);
        return storedTokens ? JSON.parse(storedTokens) : [];
    } catch (e) {
        console.error("Failed to parse tokens from localStorage", e);
        return [];
    }
};

const saveTokens = (tokens: Token[]): void => {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
};

// --- Token Generation ---

const generateRandomString = (length: number): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export const createToken = (expiryInDays: number | null): void => {
    const tokens = getTokens();
    const newToken: Token = {
        value: generateRandomString(24),
        status: 'available',
        createdAt: Date.now(),
        expiresAt: expiryInDays ? Date.now() + expiryInDays * 24 * 60 * 60 * 1000 : null,
    };
    tokens.push(newToken);
    saveTokens(tokens);
};

// --- Token Management ---

export const validateToken = (tokenValue: string): boolean => {
    const tokens = getTokens();
    const token = tokens.find(t => t.value === tokenValue);

    if (!token) {
        console.log("Validation fail: Token not found");
        return false; // Token doesn't exist
    }

    if (token.status === 'used') {
         console.log("Validation fail: Token already used");
        return false; // Token has already been used
    }

    if (token.expiresAt && token.expiresAt < Date.now()) {
        console.log("Validation fail: Token expired");
        return false; // Token has expired
    }

    return true; // Token is valid
};

export const markTokenAsUsed = (tokenValue: string): void => {
    const tokens = getTokens();
    const tokenIndex = tokens.findIndex(t => t.value === tokenValue);
    if (tokenIndex !== -1) {
        tokens[tokenIndex].status = 'used';
        tokens[tokenIndex].usedAt = Date.now();
        saveTokens(tokens);
    }
};

export const deleteToken = (tokenValue: string): void => {
    let tokens = getTokens();
    tokens = tokens.filter(t => t.value !== tokenValue);
    saveTokens(tokens);
};
