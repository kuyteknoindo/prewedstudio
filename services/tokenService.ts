// Placeholder Token Service to manage JWTs in local storage

const TOKEN_KEY = 'auth_token';

/**
 * Retrieves the authentication token from local storage.
 * @returns The token string or null if not found.
 */
export const getToken = (): string | null => {
    try {
        return window.localStorage.getItem(TOKEN_KEY);
    } catch (error) {
        console.error("Could not retrieve token from local storage", error);
        return null;
    }
};

/**
 * Saves the authentication token to local storage.
 * @param token The token string to save.
 */
export const setToken = (token: string): void => {
    try {
        window.localStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
        console.error("Could not save token to local storage", error);
    }
};

/**
 * Removes the authentication token from local storage.
 */
export const removeToken = (): void => {
    try {
        window.localStorage.removeItem(TOKEN_KEY);
    } catch (error) {
        console.error("Could not remove token from local storage", error);
    }
};
