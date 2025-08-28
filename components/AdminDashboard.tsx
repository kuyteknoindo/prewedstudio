import React, { useState, useEffect, useMemo, useContext, useRef } from 'react';
import * as tokenService from '../services/tokenService';
import { AuthContext } from '../services/auth';
import { useNotification } from '../contexts/NotificationContext';

const AdminDashboard: React.FC = () => {
    const [tokens, setTokens] = useState<tokenService.Token[]>([]);
    const [expiry, setExpiry] = useState<string>('7');
    const [autoRefresh, setAutoRefresh] = useState(true);
    const { logout } = useContext(AuthContext);
    const { addToast, showModal, hideModal } = useNotification();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const refreshTokens = () => {
        setTokens(tokenService.getTokens());
    };

    useEffect(() => {
        refreshTokens();
    }, []);
    
    useEffect(() => {
        let intervalId: number | undefined;
        if (autoRefresh) {
            intervalId = window.setInterval(() => {
                refreshTokens();
            }, 5000); // Refresh every 5 seconds
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [autoRefresh]);

    const tokenStats = useMemo(() => {
        const stats = {
            available: 0,
            active: 0,
            used: 0,
            total: tokens.length,
        };
        tokens.forEach(token => {
            if (token.status === 'available') stats.available++;
            else if (token.status === 'active') stats.active++;
            else if (token.status === 'used') stats.used++;
        });
        return stats;
    }, [tokens]);
    
    const handleGenerateToken = () => {
        const expiryDays = expiry === 'never' ? null : parseInt(expiry, 10);
        const newToken = tokenService.createToken(expiryDays);
        refreshTokens();
        addToast({ type: 'success', title: 'Token Dibuat', message: `Token baru ${newToken.value} berhasil dibuat.` });
    };

    const handleReleaseToken = (token: tokenService.Token) => {
        showModal({
            type: 'release',
            title: 'Lepaskan Token?',
            message: <>Anda yakin ingin melepaskan sesi untuk token <strong>{token.value}</strong>? Tindakan ini akan memaksa pengguna keluar dan membuat token tidak dapat digunakan lagi.</>,
            actions: [
                { label: 'Batal', onClick: hideModal, className: 'bg-slate-200 hover:bg-slate-300 text-slate-800 focus:ring-slate-400' },
                { 
                    label: 'Ya, Lepaskan', 
                    onClick: () => {
                        tokenService.releaseToken(token.value);
                        refreshTokens();
                        addToast({ type: 'warning', title: 'Token Dilepaskan', message: `Sesi untuk token ${token.value} telah dihentikan.` });
                        hideModal();
                    },
                    className: 'bg-amber-500 hover:bg-amber-600 text-white focus:ring-amber-400'
                }
            ]
        })
    };
    
    const handleDeleteToken = (tokenValue: string) => {
        showModal({
            type: 'delete',
            title: 'Hapus Token?',
            message: <>Anda yakin ingin menghapus token <strong>{tokenValue}</strong> secara permanen? Tindakan ini tidak dapat diurungkan.</>,
            actions: [
                { label: 'Batal', onClick: hideModal, className: 'bg-slate-200 hover:bg-slate-300 text-slate-800 focus:ring-slate-400' },
                { 
                    label: 'Ya, Hapus', 
                    onClick: () => {
                        tokenService.deleteToken(tokenValue);
                        refreshTokens();
                        addToast({ type: 'success', title: 'Token Dihapus', message: `Token ${tokenValue} telah dihapus.` });
                        hideModal();
                    },
                    className: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'
                }
            ]
        })
    };

    const copyToClipboard = async (text: string) => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                addToast({ type: 'success', title: 'Disalin!', message: 'Token disalin ke clipboard.' });
            } else {
                 throw new Error('Clipboard API not available');
            }
        } catch (err) {
            console.warn('Clipboard API failed, falling back to modal.', err);
            showModal({
                type: 'info',
                title: 'Salin Token Secara Manual',
                message: <>Gagal menyalin secara otomatis. Silakan salin teks di bawah ini: <br/> (Ctrl+C atau Cmd+C)</>,
                showCopyInput: text,
                actions: [{ label: 'Tutup', onClick: hideModal, className: 'bg-blue-600 hover:bg-blue-700 text-white' }]
            });
        }
    };

    const handleExport = () => {
        try {
            tokenService.exportTokensToFile();
            addToast({ type: 'success', title: 'Ekspor Berhasil', message: 'File backup token terenkripsi sedang diunduh.' });
        } catch (error) {
            addToast({ type: 'error', title: 'Ekspor Gagal', message: 'Terjadi kesalahan saat membuat file backup.' });
        }
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            const result = tokenService.importTokensFromFile(content);
            if (result.success) {
                refreshTokens();
                addToast({ type: 'success', title: 'Impor Berhasil', message: `${result.message} Total token sekarang: ${result.count}.` });
            } else {
                addToast({ type: 'error', title: 'Impor Gagal', message: result.message });
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    const showInfoFileModal = () => {
        showModal({
            type: 'info',
            title: 'Informasi File Backup',
            message: (
                <div className="text-left text-sm space-y-2">
                    <p>File backup adalah file teks (`.txt`) yang berisi semua data token Anda dalam format terenkripsi.</p>
                    <p><strong>Keamanan:</strong> Enkripsi yang digunakan bersifat dasar untuk mencegah data dibaca langsung, bukan untuk keamanan tingkat tinggi. Simpan file ini di tempat yang aman.</p>
                    <p><strong>Restore:</strong> Saat Anda mengimpor file, data token yang ada saat ini akan digabungkan dengan data dari file. Jika ada token yang sama, data dari file akan menimpa data yang ada.</p>
                </div>
            ),
            actions: [{ label: 'Mengerti', onClick: hideModal, className: 'bg-blue-600 hover:bg-blue-700 text-white' }]
        });
    };

    const formatDate = (timestamp: number | null | undefined) => {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        const datePart = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
        const timePart = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
        return `${datePart}, ${timePart}`;
    };

    return (
        <div className="h-screen overflow-y-auto custom-scrollbar bg-slate-100 text-slate-800 p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-8">
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
                </header>

                <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
                    <h2 className="text-xl font-semibold mb-4 text-slate-800">Buat Token Baru</h2>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="w-full sm:w-auto flex-grow">
                            <label htmlFor="expiry" className="block text-sm font-medium text-slate-700 mb-1">Masa Aktif Token</label>
                            <select id="expiry" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500">
                                <option value="7">7 Hari</option>
                                <option value="30">30 Hari</option>
                                <option value="90">90 Hari</option>
                                <option value="never">Tanpa Batas Waktu</option>
                            </select>
                        </div>
                        <button onClick={handleGenerateToken} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-sm self-end">
                            Generate Token
                        </button>
                    </div>
                </section>
                
                <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-xl font-semibold text-slate-800">Manajemen File Token</h2>
                            <p className="text-sm text-slate-500 mt-1">Backup dan restore token dalam format terenkripsi</p>
                        </div>
                        <button onClick={showInfoFileModal} className="text-sm text-blue-600 font-medium hover:underline">Info File</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-green-50/50 p-6 rounded-lg border border-green-200 flex flex-col">
                            <div className="flex items-center gap-3">
                                <div className="bg-green-100 p-2 rounded-full">
                                    <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800">Export Token</h3>
                            </div>
                            <p className="text-sm text-slate-600 my-3 flex-grow">Download file backup semua token dalam format terenkripsi</p>
                            <button onClick={handleExport} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                                Export {tokens.length} Token
                            </button>
                        </div>
                        <div className="bg-blue-50/50 p-6 rounded-lg border border-blue-200 flex flex-col">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-100 p-2 rounded-full">
                                    <svg className="w-6 h-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800">Import Token</h3>
                            </div>
                            <p className="text-sm text-slate-600 my-3 flex-grow">Upload file backup untuk restore token</p>
                            <button onClick={() => fileInputRef.current?.click()} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                                Pilih File Backup
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleImport} accept=".txt" className="hidden" />
                        </div>
                    </div>
                    <div className="mt-6 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-4 flex items-center gap-3">
                         <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 3.001-1.742 3.001H4.42c-1.53 0-2.493-1.667-1.743-3.001l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                        <span><span className="font-semibold">Keamanan:</span> File backup menggunakan enkripsi. Token disimpan permanen dan tidak hilang kecuali dihapus admin.</span>
                    </div>
                </section>
                
                <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-200">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-green-50/50 p-4 rounded-lg border border-green-200">
                                <p className="text-sm font-medium text-green-800">Tersedia</p>
                                <p className="text-3xl font-bold text-green-900 mt-1">{tokenStats.available}</p>
                            </div>
                            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-200">
                                <p className="text-sm font-medium text-blue-800">Aktif</p>
                                <p className="text-3xl font-bold text-blue-900 mt-1">{tokenStats.active}</p>
                            </div>
                            <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-200">
                                <p className="text-sm font-medium text-amber-800">Terpakai</p>
                                <p className="text-3xl font-bold text-amber-900 mt-1">{tokenStats.used}</p>
                            </div>
                            <div className="bg-slate-100 p-4 rounded-lg border border-slate-200">
                                <p className="text-sm font-medium text-slate-600">Total</p>
                                <p className="text-3xl font-bold text-slate-800 mt-1">{tokenStats.total}</p>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-4 flex justify-between items-center">
                        <h2 className="text-xl font-semibold text-slate-800">Daftar Token ({tokens.length})</h2>
                        <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center">
                                <input id="auto-refresh" type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"/>
                                <label htmlFor="auto-refresh" className="ml-2 text-slate-600">Auto-refresh</label>
                            </div>
                            <button onClick={refreshTokens} className="font-medium text-blue-600 hover:underline">Refresh Manual</button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Token</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Perangkat</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tanggal Dibuat</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Kedaluwarsa</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Aktivitas Terakhir</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {tokens.length > 0 ? tokens.map((token) => (
                                    <tr key={token.value}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <span className="font-mono text-sm text-slate-600 truncate max-w-[150px]" title={token.value}>{token.value}</span>
                                                <button onClick={() => copyToClipboard(token.value)} className="ml-2 text-slate-400 hover:text-blue-600" title="Salin token">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                token.status === 'used' ? 'bg-amber-100 text-amber-800' : 
                                                token.status === 'active' ? 'bg-blue-100 text-blue-800' :
                                                'bg-green-100 text-green-800'
                                            }`}>
                                                {token.status === 'available' ? 'Tersedia' : token.status === 'active' ? 'Aktif' : 'Terpakai'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono" title={token.deviceFingerprint}>
                                            {token.deviceFingerprint ? `${token.deviceFingerprint.substring(0, 10)}...` : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formatDate(token.createdAt)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formatDate(token.expiresAt)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{formatDate(token.lastActivity)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            {token.status === 'active' && (
                                                <button onClick={() => handleReleaseToken(token)} className="text-amber-600 hover:text-amber-900 mr-3">
                                                    Lepaskan
                                                </button>
                                            )}
                                            <button onClick={() => handleDeleteToken(token.value)} className="text-red-600 hover:text-red-900">
                                                Hapus
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={7} className="text-center py-10 text-slate-500">
                                            Belum ada token yang dibuat.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AdminDashboard;