import React, { useState, useEffect, useContext } from 'react';
import * as tokenService from '../services/tokenService';
import { AuthContext } from '../services/auth';

const AdminDashboard: React.FC = () => {
    const [tokens, setTokens] = useState<tokenService.Token[]>([]);
    const [expiry, setExpiry] = useState<string>('7');
    const { logout } = useContext(AuthContext);

    useEffect(() => {
        setTokens(tokenService.getTokens());
    }, []);

    const handleGenerateToken = () => {
        const expiryDays = expiry === 'never' ? null : parseInt(expiry, 10);
        tokenService.createToken(expiryDays);
        setTokens(tokenService.getTokens());
    };

    const handleDeleteToken = (tokenValue: string) => {
        if (window.confirm(`Anda yakin ingin menghapus token: ${tokenValue}?`)) {
            tokenService.deleteToken(tokenValue);
            setTokens(prevTokens => prevTokens.filter(token => token.value !== tokenValue));
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            alert('Token disalin ke clipboard!');
        }, (err) => {
            console.error('Gagal menyalin: ', err);
            alert('Gagal menyalin token.');
        });
    };

    const formatDate = (timestamp: number | null) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleString('id-ID');
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6 lg:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
                        <p className="text-slate-500 mt-1">Manajemen Token Pengguna</p>
                    </div>
                    <button
                        onClick={logout}
                        className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
                    >
                        Logout
                    </button>
                </div>

                {/* Generate Token Section */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
                    <h2 className="text-xl font-semibold mb-4 text-slate-800">Buat Token Baru</h2>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="w-full sm:w-auto flex-grow">
                            <label htmlFor="expiry" className="block text-sm font-medium text-slate-700 mb-1">
                                Masa Aktif Token
                            </label>
                            <select
                                id="expiry"
                                value={expiry}
                                onChange={(e) => setExpiry(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="7">7 Hari</option>
                                <option value="30">30 Hari</option>
                                <option value="90">90 Hari</option>
                                <option value="never">Tanpa Batas Waktu</option>
                            </select>
                        </div>
                        <button
                            onClick={handleGenerateToken}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-sm self-end"
                        >
                            Generate Token
                        </button>
                    </div>
                </div>

                {/* Token List */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                     <div className="p-6">
                        <h2 className="text-xl font-semibold text-slate-800">Daftar Token ({tokens.length})</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Token</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tanggal Dibuat</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Kedaluwarsa</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {tokens.length > 0 ? tokens.map((token) => (
                                    <tr key={token.value}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <span className="font-mono text-sm text-slate-600 truncate max-w-[200px]">{token.value}</span>
                                                <button onClick={() => copyToClipboard(token.value)} className="ml-2 text-slate-400 hover:text-blue-600" title="Salin token">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                token.status === 'used' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                                            }`}>
                                                {token.status === 'used' ? 'Terpakai' : 'Tersedia'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formatDate(token.createdAt)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formatDate(token.expiresAt)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button
                                                onClick={() => handleDeleteToken(token.value)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                Hapus
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="text-center py-10 text-slate-500">
                                            Belum ada token yang dibuat.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;