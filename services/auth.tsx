import React, { createContext, useState, useEffect, ReactNode } from 'react';
import * as tokenService from './tokenService';

interface AuthContextType {
    user: string | null;
    isAdmin: boolean;
    login: (token: string) => boolean;
    adminLogin: (email: string, pass: string) => boolean;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);

    useEffect(() => {
        const storedUser = sessionStorage.getItem('user');
        const storedIsAdmin = sessionStorage.getItem('isAdmin');
        if (storedUser) {
            setUser(storedUser);
        }
        if (storedIsAdmin === 'true') {
            setIsAdmin(true);
        }
    }, []);

    const login = (token: string): boolean => {
        if (tokenService.validateToken(token)) {
            tokenService.markTokenAsUsed(token);
            sessionStorage.setItem('user', token);
            setUser(token);
            return true;
        }
        return false;
    };

    const adminLogin = (email: string, pass: string): boolean => {
        // Hardcoded admin credentials as per request
        if (email === 'phentem@gmail.com' && pass === 'D3nip3rm@m@') {
            sessionStorage.setItem('isAdmin', 'true');
            sessionStorage.setItem('user', 'admin');
            setIsAdmin(true);
            setUser('admin');
            return true;
        }
        return false;
    };


    const logout = () => {
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('isAdmin');
        setUser(null);
        setIsAdmin(false);
        window.location.hash = ''; // Redirect to user login page on logout
    };

    return (
        <AuthContext.Provider value={{ user, isAdmin, login, adminLogin, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
