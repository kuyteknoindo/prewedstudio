import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import * as tokenService from './tokenService';

interface AuthContextType {
    user: string | null;
    isAdmin: boolean;
    login: (token: string) => boolean;
    adminLogin: (email: string, pass: string) => boolean;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const ACTIVITY_UPDATE_INTERVAL = 60 * 1000; // 1 minute

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [activityInterval, setActivityInterval] = useState<number | null>(null);

    const cleanupSession = useCallback(() => {
        if (activityInterval) {
            clearInterval(activityInterval);
            setActivityInterval(null);
        }
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('isAdmin');
        setUser(null);
        setIsAdmin(false);
    }, [activityInterval]);


    const logout = useCallback(() => {
        const token = sessionStorage.getItem('user');
        if (token && token !== 'admin') {
            tokenService.deactivateToken(token);
        }
        cleanupSession();
        window.location.hash = ''; // Redirect to user login page on logout
    }, [cleanupSession]);

    // Check session validity on component mount
    useEffect(() => {
        const storedUser = sessionStorage.getItem('user');
        const storedIsAdmin = sessionStorage.getItem('isAdmin');

        if (storedUser) {
            if (storedIsAdmin === 'true') {
                setUser('admin');
                setIsAdmin(true);
            } else {
                 if (tokenService.validateToken(storedUser)) {
                    setUser(storedUser);
                    setIsAdmin(false);
                } else {
                    // Token is no longer valid (e.g., expired, used by another device)
                    cleanupSession();
                }
            }
        }
    }, [cleanupSession]);

    // Start activity tracking when user logs in
    useEffect(() => {
        if (user && !isAdmin) {
            const intervalId = setInterval(() => {
                const currentToken = sessionStorage.getItem('user');
                if (currentToken) {
                    tokenService.updateTokenActivity(currentToken);
                }
            }, ACTIVITY_UPDATE_INTERVAL);
            setActivityInterval(intervalId);
        }

        return () => {
            if (activityInterval) {
                clearInterval(activityInterval);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isAdmin]);

    const login = (token: string): boolean => {
        if (tokenService.validateToken(token)) {
            const activatedToken = tokenService.activateToken(token);
            if (activatedToken) {
                sessionStorage.setItem('user', token);
                setUser(token);
                setIsAdmin(false);
                return true;
            }
        }
        return false;
    };

    const adminLogin = (email: string, pass: string): boolean => {
        if (email === 'phentem@gmail.com' && pass === 'D3nip3rm@n@') {
            sessionStorage.setItem('isAdmin', 'true');
            sessionStorage.setItem('user', 'admin');
            setIsAdmin(true);
            setUser('admin');
            return true;
        }
        return false;
    };

    return (
        <AuthContext.Provider value={{ user, isAdmin, login, adminLogin, logout }}>
            {children}
        </AuthContext.Provider>
    );
};