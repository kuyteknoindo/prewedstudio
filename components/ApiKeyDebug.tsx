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
        setTestResult('Testing API key...\n\nMaking request to Gemini API...');
        
        try {
            // Test with direct fetch for more detailed debugging
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: 'Hello, this is a test' }]
                    }],
                    generationConfig: {
                        maxOutputTokens: 10,
                        temperature: 0
                    }
                })
            });
            
            setTestResult(prev => prev + `\n\nResponse Status: ${response.status}`);
            setTestResult(prev => prev + `\nResponse Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}`);
            
            if (response.ok) {
                const data = await response.json();
                setTestResult(prev => prev + '\n\n✅ API KEY BERHASIL!\n\nResponse data:\n' + JSON.stringify(data, null, 2));
                setTestResult(prev => prev + '\n\n🎉 API key Anda valid dan bisa digunakan!');
            } else {
                const errorData = await response.json();
                setTestResult(prev => prev + '\n\n❌ API KEY GAGAL\n\nError response:\n' + JSON.stringify(errorData, null, 2));
                
                if (response.status === 400) {
                    setTestResult(prev => prev + '\n\n💡 Kemungkinan: API key format salah atau tidak valid');
                } else if (response.status === 403) {
                    setTestResult(prev => prev + '\n\n💡 Kemungkinan: API key tidak memiliki permission atau sudah dinonaktifkan');
                } else if (response.status === 429) {
                    setTestResult(prev => prev + '\n\n💡 Kemungkinan: Quota habis atau rate limit tercapai');
                }
            }
            
            // Also test with the validation service
            const status = await validateApiKey(apiKey);
            setTestResult(prev => prev + `\n\nValidation Service Result: ${status.toUpperCase()}`);
            
            if (status === 'active') {
                setTestResult(prev => prev + '\n\n✅ Validation confirmed: API Key berfungsi! Klik "Add to App" untuk menambahkan ke aplikasi.');
            }
        } catch (error) {
            setTestResult(prev => prev + `\n\n❌ Network Error: ${(error as Error).message}`);
            setTestResult(prev => prev + '\n\n💡 Kemungkinan: Masalah koneksi internet atau CORS');
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
    const testImageGeneration = async (apiKey: string, prompt: string, model: string = 'gemini-2.5-flash-image-preview') => {
        setIsImageTesting(true);
        setImageTestResult(`Testing image generation with ${model}...`);
        
        try {
            let url: string;
            let body: any;
            
            if (model === 'gemini-pro-vision') {
                url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${apiKey}`;
                body = {
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                };
            } else if (model === 'imagen-4.0-generate-001') {
                url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:generateContent?key=${apiKey}`;
                body = {
                    prompt: prompt,
                    config: {
                        numberOfImages: 1,
                        outputMimeType: 'image/jpeg',
                        aspectRatio: '3:4'
                    }
                };
            } else {
                url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
                body = {
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        responseModalities: ['IMAGE', 'TEXT']
                    }
                };
            }
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            });

            setImageTestResult(prev => prev + `\n\nResponse Status: ${response.status}`);
            setImageTestResult(prev => prev + `\nResponse Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}`);

            if (!response.ok) {
                const errorData = await response.json();
                setImageTestResult(prev => prev + '\n\nError Response:\n' + JSON.stringify(errorData, null, 2));
                
                if (response.status === 429) {
                    setImageTestResult(prev => prev + '\n\n❌ QUOTA EXHAUSTED - API key has reached its limit for image generation');
                } else if (response.status === 400) {
                    setImageTestResult(prev => prev + '\n\n❌ BAD REQUEST - Invalid request format or model not supported');
                } else if (response.status === 403) {
                    setImageTestResult(prev => prev + '\n\n❌ FORBIDDEN - API key invalid or insufficient permissions');
                } else {
                    setImageTestResult(prev => prev + `\n\n❌ ERROR ${response.status}`);
                }
                return;
            }

            const data = await response.json();
            setImageTestResult(prev => prev + '\n\nSuccess Response:\n' + JSON.stringify(data, null, 2));
            
            // Check if image was generated
            if (model === 'imagen-4.0-generate-001') {
                if (data.generatedImages && data.generatedImages.length > 0) {
                    setImageTestResult(prev => prev + '\n\n✅ IMAGE GENERATION SUCCESS with imagen-4.0!');
                } else {
                    setImageTestResult(prev => prev + '\n\n⚠️ NO IMAGE GENERATED with imagen-4.0');
                }
            } else {
                const candidate = data.candidates?.[0];
                if (candidate?.content?.parts) {
                    const imagePart = candidate.content.parts.find((part: any) => 
                        part.inlineData && part.inlineData.mimeType?.startsWith('image/')
                    );
                    
                    if (imagePart) {
                        setImageTestResult(prev => prev + `\n\n✅ IMAGE GENERATION SUCCESS with ${model}!`);
                    } else {
                        setImageTestResult(prev => prev + `\n\n⚠️ NO IMAGE GENERATED with ${model}`);
                    }
                } else {
                    setImageTestResult(prev => prev + `\n\n⚠️ UNEXPECTED RESPONSE FORMAT with ${model}`);
                }
            }
            
        } catch (error) {
            setImageTestResult(prev => prev + `\n\n❌ NETWORK ERROR: ${(error as Error).message}`);
        } finally {
            setIsImageTesting(false);
        }
    };

    const testImageWithStoredKey = async () => {
        if (!userApiKeys || userApiKeys.length === 0) {
            setImageTestResult('No stored API keys to test');
            return;
        }

        // Use the first available key regardless of status
        const keyToTest = userApiKeys[0];
        if (!keyToTest) {
            setImageTestResult('No API keys available to test.');
            return;
        }

        await testImageGeneration(keyToTest.value, testImagePrompt);
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
                            <div>curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=YOUR_API_KEY" \</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-H "Content-Type: application/json" \</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-d '{`{`}</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"contents": [{`{`}</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"parts": [</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{`{ "text": "${testImagePrompt}" }`}</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;]</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{`}`}]</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{`}`}'</div>
                        </div>
                        <p className="text-xs text-gray-600 mt-2">
                            Replace YOUR_API_KEY with your actual API key to test manually. This uses the gemini-pro-vision model as you suggested.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <button 
                            onClick={() => testImageGeneration(testApiKeyInput, testImagePrompt, 'gemini-pro-vision')}
                            disabled={isImageTesting || !testApiKeyInput.trim() || !testImagePrompt.trim()}
                            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50 w-full"
                        >
                            {isImageTesting ? 'Testing...' : 'Test with gemini-pro-vision'}
                        </button>
                        <button 
                            onClick={() => testImageGeneration(testApiKeyInput, testImagePrompt, 'imagen-4.0-generate-001')}
                            disabled={isImageTesting || !testApiKeyInput.trim() || !testImagePrompt.trim()}
                            className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 disabled:opacity-50 w-full"
                        >
                            {isImageTesting ? 'Testing...' : 'Test with imagen-4.0-generate-001'}
                        </button>
                    </div>

                    <div className="text-sm text-gray-600">
                        <h4 className="font-semibold mb-2">Image Generation Troubleshooting:</h4>
                        <ul className="list-disc list-inside space-y-1">
                            <li><strong>Quota Terpisah:</strong> Text dan Image generation memiliki quota yang berbeda</li>
                            <li><strong>Quota Lebih Besar:</strong> Image generation menggunakan quota lebih banyak per request</li>
                            <li><strong>API Key Baru:</strong> Meskipun API key baru, quota image mungkin sudah habis dari test sebelumnya</li>
                            <li><strong>Model Berbeda:</strong> gemini-2.5-flash-image-preview vs gemini-2.5-flash memiliki limit berbeda</li>
                            <li><strong>Safety Filter:</strong> Beberapa prompt mungkin diblokir oleh filter keamanan</li>
                            <li><strong>Response Format:</strong> Response harus mengandung inlineData dengan image bytes</li>
                            <li><strong>Solusi:</strong> Tunggu 24 jam atau gunakan API key berbeda untuk image generation</li>
                        </ul>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
                        <h4 className="font-semibold text-yellow-800 mb-1">💡 Penjelasan Status:</h4>
                        <p className="text-sm text-yellow-700">
                            API key Anda <strong>VALID</strong> untuk text generation tapi <strong>QUOTA HABIS</strong> untuk image generation. 
                            Ini normal untuk API key baru karena quota image generation lebih terbatas.
                        </p>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};

export default ApiKeyDebug;