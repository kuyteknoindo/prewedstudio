import React, { useState, useContext } from 'react';
import { AuthContext } from '../services/auth';

const AdminLogin: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { adminLogin } = useContext(AuthContext);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const success = adminLogin(email, password);
        if (!success) {
            setError('Email atau password salah.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Admin Login</h1>
                    <p className="text-slate-500 mt-2">Akses dasbor manajemen token.</p>
                </div>
                <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200">
                    <form onSubmit={handleSubmit} className="space-y-6">
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
                        
                        {error && <p className="text-sm text-red-600">{error}</p>}

                        <div>
                            <button
                                type="submit"
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Sign in
                            </button>
                        </div>
                    </form>
                </div>
                 <div className="text-center mt-6">
                    <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = ''; }} className="text-sm text-blue-600 hover:underline">
                        Kembali ke Login Pengguna
                    </a>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;
