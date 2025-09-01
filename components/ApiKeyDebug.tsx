import React, { useState, useEffect } from 'react';
import { validateApiKey } from '../services/geminiService';
import { ApiKey, ApiKeyStatus } from '../types';

interface ApiKeyDebugProps {
    userApiKeys: ApiKey[];
    onClose: () => void;
}

const ApiKeyDebug: React.FC<ApiKeyDebugProps> = ({ userApiKeys, onClose }) => {
    const [debugInfo, setDebugInfo] = useState<any>(null);
    const [testResult, setTestResult] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [testApiKeyInput, setTestApiKeyInput] = useState('');

    const checkStoredApiKeys = () => {
        try {
            const storedKeys = localStorage.getItem('ai_photographer_api_keys');
            const envKey = (window as any).process?.env?.GEMINI_API_KEY || (window as any).process?.env?.API_KEY;
            
            const info = {
                localStorageKeys: storedKeys ? JSON.parse(storedKeys) : null,
                environmentKey: envKey ? 'Set' : 'Not set',
                currentUserKeys: userApiKeys,
                timestamp: new Date().toLocaleString()
            };
            
            setDebugInfo(info);
        } catch (error) {
            setDebugInfo({ error: (error as Error).message });
        }
    };

    const testApiKey = async (apiKey: string) => {
        setIsLoading(true);
        setTestResult('Testing...');
        
        try {
            const status = await validateApiKey(apiKey);
            setTestResult(`API Key Status: ${status.toUpperCase()}`);
            
            if (status === 'active') {
                setTestResult(prev => prev + '\n\n✅ API Key berfungsi! Klik "Add to App" untuk menambahkan ke aplikasi.');
            }
        } catch (error) {
            setTestResult(`Test failed: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const addApiKeyToApp = () => {
        if (!testApiKeyInput.trim()) {
            setTestResult('Masukkan API key terlebih dahulu');
            return;
        }

        const newApiKey: ApiKey = {
            id: `key_${Date.now()}`,
            value: testApiKeyInput.trim(),
            masked: `${testApiKeyInput.slice(0, 4)}...${testApiKeyInput.slice(-4)}`,
            status: 'unvalidated'
        };

        const currentKeys = JSON.parse(localStorage.getItem('ai_photographer_api_keys') || '[]');
        const updatedKeys = [...currentKeys, newApiKey];
        localStorage.setItem('ai_photographer_api_keys', JSON.stringify(updatedKeys));
        
        setTestResult('✅ API Key berhasil ditambahkan ke aplikasi! Silakan tutup panel debug dan coba generate foto.');
        setTestApiKeyInput('');
        
        // Refresh debug info
        checkStoredApiKeys();
    };

    const testAllStoredKeys = async () => {
        if (!userApiKeys || userApiKeys.length === 0) {
            setTestResult('No stored API keys to test');
            return;
        }

        setIsLoading(true);
        const results = [];
        
        for (const key of userApiKeys) {
            try {
                const status = await validateApiKey(key.value);
                results.push(`Key ${key.masked}: ${status.toUpperCase()}`);
            } catch (error) {
                results.push(`Key ${key.masked}: error - ${(error as Error).message}`);
            }
        }
        
        setTestResult(results.join('\n'));
        setIsLoading(false);
    };

    useEffect(() => {
        checkStoredApiKeys();
    }, []);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl mx-auto max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold mb-4 text-gray-800">API Key Debug Information</h2>
                    <button 
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                        ×
                    </button>
                </div>
            
            <div className="space-y-4">
                <button 
                    onClick={checkStoredApiKeys}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                    Refresh Debug Info
                </button>

                {debugInfo && (
                    <div className="bg-gray-100 p-4 rounded">
                        <h3 className="font-semibold mb-2">Stored Information:</h3>
                        <pre className="text-sm overflow-auto">
                            {JSON.stringify(debugInfo, null, 2)}
                        </pre>
                    </div>
                )}

                <div className="space-y-2">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Test API Key:
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={testApiKeyInput}
                                onChange={(e) => setTestApiKeyInput(e.target.value)}
                                placeholder="Masukkan API key untuk ditest..."
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button 
                                onClick={() => testApiKey(testApiKeyInput)}
                                disabled={isLoading || !testApiKeyInput.trim()}
                                className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
                            >
                                {isLoading ? 'Testing...' : 'Test Key'}
                            </button>
                            <button 
                                onClick={addApiKeyToApp}
                                disabled={!testApiKeyInput.trim()}
                                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
                            >
                                Add to App
                            </button>
                        </div>
                    </div>

                    <button 
                        onClick={testAllStoredKeys}
                        disabled={isLoading}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
                    >
                        {isLoading ? 'Testing...' : 'Test All Stored API Keys'}
                    </button>
                </div>

                {testResult && (
                    <div className="bg-yellow-100 p-4 rounded">
                        <h3 className="font-semibold mb-2">Test Results:</h3>
                        <pre className="text-sm whitespace-pre-wrap">{testResult}</pre>
                    </div>
                )}

                <div className="text-sm text-gray-600">
                    <h3 className="font-semibold mb-2">Kemungkinan Penyebab Error:</h3>
                    <ul className="list-disc list-inside space-y-1">
                        <li>API key sudah mencapai limit harian (meskipun baru)</li>
                        <li>API key tidak tersimpan dengan benar di aplikasi</li>
                        <li>Model yang digunakan memiliki limit yang berbeda</li>
                        <li>Terlalu banyak request dalam waktu singkat</li>
                    </ul>
                </div>
            </div>
            </div>
        </div>
    );
};

export default ApiKeyDebug;