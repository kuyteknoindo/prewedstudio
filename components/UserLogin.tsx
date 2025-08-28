import React, { useState, useContext } from 'react';
import { AuthContext } from '../services/auth';
import { useNotification } from '../contexts/NotificationContext';

const LoginPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');
    const [token, setToken] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login, adminLogin } = useContext(AuthContext);
    const { addToast } = useNotification();

    const handleUserSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const success = login(token);
        if (!success) {
            addToast({type: 'error', title: 'Login Gagal', message: 'Token tidak valid, sudah digunakan, atau kedaluwarsa.'});
        }
    };

    const handleAdminSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const success = adminLogin(email, password);
        if (!success) {
             addToast({type: 'error', title: 'Login Admin Gagal', message: 'Email atau password salah.'});
        }
    };

    const switchTab = (tab: 'user' | 'admin') => {
        setActiveTab(tab);
        setToken('');
        setEmail('');
        setPassword('');
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                     <h1 className="text-3xl font-bold text-slate-900">AI Photographer</h1>
                     <p className="text-slate-500 mt-2">Prewedding Edition</p>
                </div>
                <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200">
                    <div className="flex border-b border-slate-200 mb-6">
                        <button
                            onClick={() => switchTab('user')}
                            className={`flex-1 pb-3 px-1 text-sm font-semibold transition-colors focus:outline-none ${activeTab === 'user' ? 'border-b-2 border-blue-600 text-blue-600' : 'border-b-2 border-transparent text-slate-500 hover:text-slate-800'}`}
                        >
                            Pengguna
                        </button>
                        <button
                            onClick={() => switchTab('admin')}
                            className={`flex-1 pb-3 px-1 text-sm font-semibold transition-colors focus:outline-none ${activeTab === 'admin' ? 'border-b-2 border-blue-600 text-blue-600' : 'border-b-2 border-transparent text-slate-500 hover:text-slate-800'}`}
                        >
                            Admin
                        </button>
                    </div>

                    {activeTab === 'user' ? (
                        <form onSubmit={handleUserSubmit} className="space-y-6">
                             <div>
                                <label
                                    htmlFor="token"
                                    className="block text-sm font-medium text-slate-700"
                                >
                                    Token Akses
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="token"
                                        name="token"
                                        type="text"
                                        required
                                        value={token}
                                        onChange={(e) => setToken(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Masukkan token Anda..."
                                    />
                                </div>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    Masuk
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleAdminSubmit} className="space-y-6">
                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-sm font-medium text-slate-700"
                                >
                                    Alamat Email
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="you@example.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-slate-700"
                                >
                                    Password
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        autoComplete="current-password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    Sign in
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoginPage;