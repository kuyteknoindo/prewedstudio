import React, { useState, useEffect } from 'react';
import { validateApiKey } from '../services/geminiService';
import { ApiKey, ApiKeyStatus } from '../types';

const ApiKeyDebug: React.FC = () => {
    const [debugInfo, setDebugInfo] = useState<any>(null);
    const [testResult, setTestResult] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    const checkStoredApiKeys = () => {
        try {
            const storedKeys = localStorage.getItem('gemini_api_keys');
            const envKey = (window as any).process?.env?.GEMINI_API_KEY || (window as any).process?.env?.API_KEY;
            
            const info = {
                localStorageKeys: storedKeys ? JSON.parse(storedKeys) : null,
                environmentKey: envKey ? 'Set' : 'Not set',
                timestamp: new Date().toLocaleString()
            };
            
            setDebugInfo(info);
        } catch (error) {
            setDebugInfo({ error: error.message });
        }
    };

    const testApiKey = async (apiKey: string) => {
        setIsLoading(true);
        setTestResult('Testing...');
        
        try {
            const status = await validateApiKey(apiKey);
            setTestResult(`API Key Status: ${status}`);
        } catch (error) {
            setTestResult(`Test failed: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const testAllStoredKeys = async () => {
        if (!debugInfo?.localStorageKeys) {
            setTestResult('No stored API keys to test');
            return;
        }

        setIsLoading(true);
        const results = [];
        
        for (const key of debugInfo.localStorageKeys) {
            try {
                const status = await validateApiKey(key.value);
                results.push(`Key ${key.id.slice(-4)}: ${status}`);
            } catch (error) {
                results.push(`Key ${key.id.slice(-4)}: error - ${error.message}`);
            }
        }
        
        setTestResult(results.join('\n'));
        setIsLoading(false);
    };

    useEffect(() => {
        checkStoredApiKeys();
    }, []);

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl mx-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-800">API Key Debug Information</h2>
            
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
    );
};

export default ApiKeyDebug;