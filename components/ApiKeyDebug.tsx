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
    const [imageTestResult, setImageTestResult] = useState<string>('');
    const [isImageTesting, setIsImageTesting] = useState(false);
    const [testImagePrompt, setTestImagePrompt] = useState('A realistic picture of a cat sleeping on a book');

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

    const testImageGeneration = async (apiKey: string, prompt: string) => {
        setIsImageTesting(true);
        setImageTestResult('Testing image generation...');
        
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        responseModalities: ['IMAGE', 'TEXT']
                    }
                })
            });

            console.log('Image generation response status:', response.status);
            console.log('Image generation response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorData = await response.json();
                console.log('Image generation error response:', errorData);
                
                if (response.status === 429) {
                    setImageTestResult('❌ QUOTA EXHAUSTED - API key has reached its limit\n\nError details:\n' + JSON.stringify(errorData, null, 2));
                } else if (response.status === 400) {
                    setImageTestResult('❌ BAD REQUEST - Invalid request format or parameters\n\nError details:\n' + JSON.stringify(errorData, null, 2));
                } else if (response.status === 403) {
                    setImageTestResult('❌ FORBIDDEN - API key invalid or insufficient permissions\n\nError details:\n' + JSON.stringify(errorData, null, 2));
                } else {
                    setImageTestResult(`❌ ERROR ${response.status}\n\nError details:\n` + JSON.stringify(errorData, null, 2));
                }
                return;
            }

            const data = await response.json();
            console.log('Image generation success response:', data);
            
            // Check if image was generated
            const candidate = data.candidates?.[0];
            if (candidate?.content?.parts) {
                const imagePart = candidate.content.parts.find((part: any) => 
                    part.inlineData && part.inlineData.mimeType?.startsWith('image/')
                );
                
                if (imagePart) {
                    setImageTestResult('✅ IMAGE GENERATION SUCCESS!\n\nImage was generated successfully. The API key is working for image generation.');
                } else {
                    setImageTestResult('⚠️ NO IMAGE GENERATED\n\nAPI responded successfully but no image was found in the response.\n\nResponse:\n' + JSON.stringify(data, null, 2));
                }
            } else {
                setImageTestResult('⚠️ UNEXPECTED RESPONSE FORMAT\n\nResponse:\n' + JSON.stringify(data, null, 2));
            }
            
        } catch (error) {
            console.error('Image generation test error:', error);
            setImageTestResult(`❌ NETWORK ERROR\n\nFailed to connect to API:\n${(error as Error).message}`);
        } finally {
            setIsImageTesting(false);
        }
    };

    const testImageWithStoredKey = async () => {
        if (!userApiKeys || userApiKeys.length === 0) {
            setImageTestResult('No stored API keys to test');
            return;
        }

        const activeKey = userApiKeys.find(key => key.status === 'active');
        if (!activeKey) {
            setImageTestResult('No active API keys found. Please test and validate an API key first.');
            return;
        }

        await testImageGeneration(activeKey.value, testImagePrompt);
    };
    useEffect(() => {
        checkStoredApiKeys();
    }, []);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-4xl mx-auto max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold mb-4 text-gray-800">API Key Debug Information</h2>
                    <button 
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                        ×
                    </button>
                </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - API Key Testing */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800">API Key Testing</h3>
                    
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

                {/* Right Column - Image Generation Testing */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800">Image Generation Testing</h3>
                    
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Test Prompt:
                        </label>
                        <textarea
                            value={testImagePrompt}
                            onChange={(e) => setTestImagePrompt(e.target.value)}
                            placeholder="Enter prompt for image generation test..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                        />
                    </div>

                    <div className="flex gap-2">
                        <button 
                            onClick={() => testImageGeneration(testApiKeyInput, testImagePrompt)}
                            disabled={isImageTesting || !testApiKeyInput.trim() || !testImagePrompt.trim()}
                            className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-50"
                        >
                            {isImageTesting ? 'Testing...' : 'Test Image Gen'}
                        </button>
                        <button 
                            onClick={testImageWithStoredKey}
                            disabled={isImageTesting || !testImagePrompt.trim()}
                            className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 disabled:opacity-50"
                        >
                            {isImageTesting ? 'Testing...' : 'Test with Stored Key'}
                        </button>
                    </div>

                    {imageTestResult && (
                        <div className="bg-blue-100 p-4 rounded">
                            <h3 className="font-semibold mb-2">Image Generation Results:</h3>
                            <pre className="text-sm whitespace-pre-wrap">{imageTestResult}</pre>
                        </div>
                    )}

                    <div className="bg-gray-50 p-4 rounded">
                        <h4 className="font-semibold mb-2 text-sm">cURL Test Command:</h4>
                        <div className="bg-gray-800 text-green-400 p-3 rounded text-xs font-mono overflow-x-auto">
                            <div>curl -X POST \</div>
                            <div>"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=YOUR_API_KEY" \</div>
                            <div>-H "Content-Type: application/json" \</div>
                            <div>-d '{`{`}</div>
                            <div>&nbsp;&nbsp;"contents": [{`{`}</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;"parts": [</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{`{ "text": "${testImagePrompt}" }`}</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;]</div>
                            <div>&nbsp;&nbsp;{`}`}],</div>
                            <div>&nbsp;&nbsp;"generationConfig": {`{`}</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;"responseModalities": ["IMAGE", "TEXT"]</div>
                            <div>&nbsp;&nbsp;{`}`}</div>
                            <div>{`}`}'</div>
                        </div>
                        <p className="text-xs text-gray-600 mt-2">
                            Replace YOUR_API_KEY with your actual API key to test manually
                        </p>
                    </div>

                    <div className="text-sm text-gray-600">
                        <h4 className="font-semibold mb-2">Image Generation Troubleshooting:</h4>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Model 'gemini-2.5-flash-image-preview' has different quotas than text models</li>
                            <li>Image generation uses more quota per request</li>
                            <li>Some prompts may be blocked by safety filters</li>
                            <li>Response should contain inlineData with image bytes</li>
                        </ul>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};

export default ApiKeyDebug;