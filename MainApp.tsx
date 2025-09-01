import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import saveAs from 'file-saver';
import JSZip from 'jszip';
import { GeneratedImage, ModalState, ReferenceFile, ActiveTab, ApiKey, ApiKeyStatus } from './types';
import ApiKeyDebug from './components/ApiKeyDebug';
import { generateImage, generateText, generateConsistentCoupleDescription, generateLocationBasedScenarios, validateApiKey } from './services/geminiService';
import { shuffleArray, generateRandomFilename, cropImageToAspectRatio } from './utils';
import * as D from './creativeData';
import { GoogleGenAI } from '@google/genai';

const defaultInitialPrompt = `A hyper-realistic, cinematic prewedding photograph of a young Indonesian couple. The woman, wearing a simple pashmina hijab, a long cotton tunic, and a pastel-colored pleated skirt. The man wears a comfortable flannel shirt over a white t-shirt and khaki-colored chino trousers. They are captured in a candid, stolen moment from afar, sharing a quiet moment of shared understanding.`;

// --- API Key Manager ---
const API_KEY_STORAGE_KEY = 'ai_photographer_api_keys';

const getStoredApiKeys = (): ApiKey[] => {
    try {
        const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
        if (!stored) return [];

        const keys: Partial<ApiKey>[] = JSON.parse(stored);
        
        return keys.map((key, index) => ({
            id: key.id || `key_loaded_${Date.now()}_${index}`,
            value: key.value || '',
            masked: key.masked || (key.value ? `${key.value.slice(0, 4)}...${key.value.slice(-4)}` : ''),
            status: key.status || 'unvalidated', 
        })).filter(key => key.value);

    } catch (e) {
        console.error("Failed to parse API keys from storage, clearing it.", e);
        localStorage.removeItem(API_KEY_STORAGE_KEY);
        return [];
    }
};


const storeApiKeys = (keys: ApiKey[]) => {
    localStorage.setItem(API_KEY_STORAGE_KEY, JSON.stringify(keys));
};
// --- End API Key Manager ---

const MainApp: React.FC = () => {
    const [prompt, setPrompt] = useState(defaultInitialPrompt);
    const [referenceFile, setReferenceFile] = useState<ReferenceFile | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageCount, setImageCount] = useState(5);
    const [delay, setDelay] = useState(5);
    const [locationTheme, setLocationTheme] = useState('Kehidupan Sehari-hari');
    const [activeTab, setActiveTab] = useState<ActiveTab>('prompt');
    const [imageModel, setImageModel] = useState('gemini-2.5-flash-image-preview');

    const [selectedNegativePrompts, setSelectedNegativePrompts] = useState<Set<string>>(new Set());
    const [customNegativePrompt, setCustomNegativePrompt] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    
    const [modals, setModals] = useState<ModalState>({ error: null, download: false, lightbox: null });
    const [isApiModalOpen, setIsApiModalOpen] = useState(false);
    const [userApiKeys, setUserApiKeys] = useState<ApiKey[]>([]);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [isKeyTutorialOpen, setIsKeyTutorialOpen] = useState(false);
    const [isKeyValidationLoading, setIsKeyValidationLoading] = useState(false);
    const [showDebugPanel, setShowDebugPanel] = useState(false);

    const [previewData, setPreviewData] = useState<{ textPrompt: string; imageUrl: string | null; isLoading: boolean; error: string | null } | null>(null);
    const [adatPreviewData, setAdatPreviewData] = useState<{
        region: string;
        textPrompt: string;
        imageUrl: string | null;
        isLoading: boolean;
        status: 'idle' | 'generating_text' | 'generating_image';
        error: string | null;
    } | null>(null);

    const [isEnhancing, setIsEnhancing] = useState(false);
    const [consistentCoupleDescription, setConsistentCoupleDescription] = useState('');
    const [sessionFinished, setSessionFinished] = useState(false);
    
    const isGenerationRunningRef = useRef(false);
    const sessionReferenceImageRef = useRef<ReferenceFile | null>(null);

    const adminApiKeyAvailable = !!process.env.API_KEY;

    useEffect(() => {
        setUserApiKeys(getStoredApiKeys());
    }, []);

    const performApiCall = async <T,>(apiFunction: (apiKey: string) => Promise<T>): Promise<T> => {
        // Combine active and unvalidated keys, prioritizing active ones for use.
        const availableKeys = [
            ...userApiKeys.filter(k => k.status === 'active'),
            ...userApiKeys.filter(k => k.status === 'unvalidated'),
            ...userApiKeys.filter(k => k.status === 'exhausted')
        ];
        
        // Also check for environment API key
        const envApiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
        if (envApiKey && availableKeys.length === 0) {
            try {
                return await apiFunction(envApiKey);
            } catch (error) {
                console.warn('Environment API key failed:', error);
            }
        }
        
        try {

        if (availableKeys.length > 0) {
            for (const keyToTry of availableKeys) {
                try {
                    const result = await apiFunction(keyToTry.value);
                    
                    // If the call was successful and the key was unvalidated, update its status.
                    if (keyToTry.status === 'unvalidated') {
                        setUserApiKeys(prevKeys => {
                            // FIX: Cast status to ApiKeyStatus to prevent TypeScript from widening the type to 'string'.
                            const newKeys = prevKeys.map(k => 
                                k.id === keyToTry.id ? { ...k, status: 'active' as ApiKeyStatus } : k
                            );
                            storeApiKeys(newKeys);
                            return newKeys;
                        });
                    }
                    
                    return result; // Success, exit the function.
                } catch (error) {
                    const e = error as Error;
                    const errorMessage = e.message || '';

                    // Automatically update key status based on specific API errors.
                    if (errorMessage.includes('API key not valid')) {
                        console.warn(`API key ${keyToTry.masked} is invalid.`);
                        setUserApiKeys(prevKeys => {
                            // FIX: Cast status to ApiKeyStatus to prevent TypeScript from widening the type to 'string'.
                            const newKeys = prevKeys.map(k => k.id === keyToTry.id ? { ...k, status: 'invalid' as ApiKeyStatus } : k);
                            storeApiKeys(newKeys);
                            return newKeys;
                        });
                    } else if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('rate limit')) {
                        console.warn(`API key ${keyToTry.masked} is exhausted.`);
                         setUserApiKeys(prevKeys => {
                            // FIX: Cast status to ApiKeyStatus to prevent TypeScript from widening the type to 'string'.
                            const newKeys = prevKeys.map(k => k.id === keyToTry.id ? { ...k, status: 'exhausted' as ApiKeyStatus } : k);
                            storeApiKeys(newKeys);
                            return newKeys;
                        });
                    } else {
                        // For other errors (e.g., network), fail fast without changing key status.
                        throw error;
                    }
                }
            }
        }

        // If no user keys are available or all failed, try admin key as fallback
        if (adminApiKeyAvailable) {
            return await apiFunction(process.env.API_KEY!);
        }

        // No keys available
        setIsApiModalOpen(true);
        throw new Error("Tidak ada kunci API yang aktif. Silakan tambahkan kunci Anda sendiri.");
        } catch (error) {
            throw error;
        }
    };

    // Function to get the best available API key
    const getBestApiKey = (): string => {
        // First try active keys
        const activeKey = userApiKeys.find(key => key.status === 'active');
        if (activeKey) return activeKey.value;
        
        // Then try unvalidated keys (newly added)
        const unvalidatedKey = userApiKeys.find(key => key.status === 'unvalidated');
        if (unvalidatedKey) return unvalidatedKey.value;
        
        // Finally try exhausted keys (might have reset)
        const exhaustedKey = userApiKeys.find(key => key.status === 'exhausted');
        if (exhaustedKey) return exhaustedKey.value;
        
        // No keys available
        setIsApiModalOpen(true);
        throw new Error("Tidak ada kunci API yang aktif. Silakan tambahkan kunci Anda sendiri.");
    };


    const locationGroups = useMemo(() => ({
        "Studio & Konsep": ["Studio Foto Profesional"],
        "Indonesia": ["Kehidupan Sehari-hari", "Kisah Kampus", "Pedesaan", "Hutan Tropis", "Street Food", "Bali", "Yogyakarta", "Bromo", "Raja Ampat", "Sumba", "Danau Toba"],
        "Asia Pasifik": ["Tokyo", "Kyoto", "Nara (Jepang)", "Seoul (Korea)", "Thailand", "Vietnam", "Singapura", "Selandia Baru", "Australia"],
        "Eropa": ["Paris", "Santorini", "Roma", "Venesia", "London", "Praha", "Tuscany", "Swiss", "Islandia"],
        "Amerika & Timur Tengah": ["New York City", "Grand Canyon", "California", "Cappadocia (Turki)", "Dubai", "Maroko"],
    }), []);

    const handleFileChange = (file: File | null) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                const [header, base64] = result.split(',');
                const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
                setReferenceFile({ base64, mimeType });
                setImagePreview(result);
            };
            // FIX: Corrected typo from readDataURL to readAsDataURL
            reader.readAsDataURL(file);
        } else {
            setModals(prev => ({ ...prev, error: 'Harap unggah file gambar yang valid.' }));
            setReferenceFile(null);
            setImagePreview(null);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.classList.remove('border-blue-500', 'bg-slate-100');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileChange(e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
        }
    }, []);
    
    const generateAutoDescription = async () => {
        setPreviewData({ textPrompt: '', imageUrl: null, isLoading: true, error: null });
        try {
            const randomMaleCloth = D.maleClothing[Math.floor(Math.random() * D.maleClothing.length)];
            const randomMalePants = D.malePants[Math.floor(Math.random() * D.malePants.length)];
            const randomFemaleOption = D.femaleClothingOptions[Math.floor(Math.random() * D.femaleClothingOptions.length)];
            const randomAcc1 = D.accessories[Math.floor(Math.random() * D.accessories.length)];
            
            const femaleDescription = `The female, ${randomFemaleOption.style}, wears ${randomFemaleOption.clothing}${randomFemaleOption.bottom ? ` paired with ${randomFemaleOption.bottom}` : ''}.`;
            const maleDescription = `The male wears ${randomMaleCloth} and ${randomMalePants}.`;
            const accessoryDescription = `They both share a stylish, serene presence, accessorized with items like ${randomAcc1}.`;
            const fullPrompt = `A young Indonesian couple. ${femaleDescription} ${maleDescription} ${accessoryDescription}`;

            setPreviewData({ textPrompt: fullPrompt, imageUrl: null, isLoading: true, error: null });
            
            const imageGenPrompt = `Photorealistic 4k cinematic preview, 3:4 aspect ratio. A young Indonesian couple, their appearance and clothing are described as: "${fullPrompt}". **Must be ethnically Indonesian.** Only one man and one woman. No cartoons.`;
            const imageUrl = await performApiCall(apiKey => generateImage(apiKey, imageGenPrompt, 'gemini-2.5-flash-image-preview'));

            setPreviewData({ textPrompt: fullPrompt, imageUrl, isLoading: false, error: null });

        } catch (error) {
            console.error("Error generating preview:", error);
            const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan";
            setPreviewData(prev => ({ ...(prev ?? { textPrompt: '', imageUrl: null, isLoading: false, error: null }), isLoading: false, error: `Gagal membuat preview: ${errorMessage}` }));
        }
    };

    const handleGenerateAdatPreview = async () => {
        if (!adatPreviewData?.region) {
            setAdatPreviewData(prev => ({ ...(prev!), error: "Harap masukkan daerah asal pakaian adat." }));
            return;
        }
        
        const region = adatPreviewData.region;
        setAdatPreviewData(prev => ({ ...(prev!), imageUrl: null, textPrompt: '', isLoading: true, status: 'generating_text', error: null }));

        try {
            const textGenPrompt = `Create a concise, culturally rich English description for an AI photo prompt. Subject: A couple in complete traditional wedding attire from the ${region} region of Indonesia. Focus on key visual elements: specific garment names, patterns (batik, songket), and accessories (blangkon, sanggul).`;
            const generatedText = await performApiCall(apiKey => generateText(apiKey, textGenPrompt));

            setAdatPreviewData(prev => ({ ...(prev!), textPrompt: generatedText, status: 'generating_image' }));
            
            const imageGenPrompt = `Photorealistic 4k cinematic preview, 3:4 aspect ratio. Description: "${generatedText}". **CRITICAL: The couple must be ethnically Indonesian, with features authentic to the ${region} region.** Culturally accurate attire. No cartoons.`;
            const imageUrl = await performApiCall(apiKey => generateImage(apiKey, imageGenPrompt, 'gemini-2.5-flash-image-preview'));

            setAdatPreviewData(prev => ({ ...(prev!), imageUrl, isLoading: false, status: 'idle' }));

        } catch (error) {
             console.error("Error generating adat preview:", error);
            const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan";
            setAdatPreviewData(prev => ({ ...(prev!), isLoading: false, status: 'idle', error: `Gagal membuat preview: ${errorMessage}` }));
        }
    };

    const handleEnhancePrompt = async () => {
        if (!prompt) {
            setModals(prev => ({...prev, error: "Tulis deskripsi terlebih dahulu untuk ditingkatkan."}));
            return;
        }
        setIsEnhancing(true);
        try {
            const enhancementInstruction = `Enhance this user's description into a rich, detailed, and evocative prompt for an AI pre-wedding photo generator. Add cinematic lighting, emotional cues, and artistic composition, focusing on Indonesian cultural context. Output a single, cohesive paragraph. User description: "${prompt}"`;
            const enhancedPrompt = await performApiCall(apiKey => generateText(apiKey, enhancementInstruction));
            setPrompt(enhancedPrompt);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan";
            setModals(prev => ({...prev, error: `Gagal meningkatkan prompt: ${errorMessage}`}));
        } finally {
            setIsEnhancing(false);
        }
    };

    const toggleNegativePrompt = (tag: string) => {
        setSelectedNegativePrompts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(tag)) {
                newSet.delete(tag);
            } else {
                newSet.add(tag);
            }
            return newSet;
        });
    };

    const runGeneration = async (isContinuation = false) => {
        if (isGenerationRunningRef.current) return;
    
        const isReferenceTabActive = activeTab === 'reference';
        if (isReferenceTabActive && !referenceFile) {
            setModals(prev => ({ ...prev, error: 'Harap unggah foto referensi terlebih dahulu.' }));
            return;
        }
        if (activeTab === 'prompt' && !prompt) {
            setModals(prev => ({ ...prev, error: 'Harap isi deskripsi pasangan di tab "Teks Prompt".' }));
            return;
        }
    
        isGenerationRunningRef.current = true;
        setIsLoading(true);
    
        if (!isContinuation) {
            setGeneratedImages([]);
            setSessionFinished(false);
            sessionReferenceImageRef.current = null; // Reset for new session
        }
    
        let baseDescription = consistentCoupleDescription || prompt;
        let scenarios: { scene: string; emotion: string }[] = [];
    
        try {
            // Step 1: Create consistent description if starting from text prompt
            if (!isContinuation && activeTab === 'prompt' && prompt) {
                setStatusText('Membuat deskripsi pasangan yang konsisten...');
                const coupleDesc = await performApiCall(apiKey => generateConsistentCoupleDescription(apiKey, prompt));
                setConsistentCoupleDescription(coupleDesc);
                baseDescription = coupleDesc;
            } else if (isReferenceTabActive) {
                setConsistentCoupleDescription('');
            }
    
            // Step 2: Generate all creative scenarios at once, with fallback
            setStatusText(`Membuat skenario kreatif untuk ${locationTheme}...`);
            try {
                scenarios = await performApiCall(apiKey => generateLocationBasedScenarios(apiKey, locationTheme, imageCount));
            } catch (error) {
                 console.warn("Creative scenario generation failed. Falling back to generic scenarios.", error);
                 setStatusText(`Skenario kreatif gagal, menggunakan skenario cadangan...`);
                 // Fallback: Create generic scenarios from creativeData
                 scenarios = shuffleArray(D.storyScenes)
                     .slice(0, imageCount)
                     .map(scene => ({
                         scene,
                         emotion: shuffleArray(D.emotionalCues)[0]
                     }));
            }

            if (scenarios.length < imageCount) {
                const fallback = { scene: 'The couple shares a quiet, intimate moment.', emotion: 'A feeling of deep connection.' };
                scenarios.push(...Array(imageCount - scenarios.length).fill(fallback));
            }

            await new Promise(resolve => setTimeout(resolve, 2000));

            // Step 3: Loop through and generate images
            const startIndex = isContinuation ? generatedImages.length : 0;
            const targetCount = startIndex + imageCount;
            let scenarioIndex = startIndex;

            for (let i = startIndex; i < targetCount; i++) {
                if (!isGenerationRunningRef.current) break;
                
                const scenario = scenarios[scenarioIndex % scenarios.length];
                const photoStyle = shuffleArray(D.photographicStyles)[0];
                const negativePrompt = [
                    ...Array.from(selectedNegativePrompts),
                    ...customNegativePrompt.split(',').map(s => s.trim()).filter(Boolean)
                ].join(', ');
                
                setStatusText(`Gambar ${i + 1}/${targetCount} | ${scenario.scene.substring(0, 50)}...`);
    
                let finalPrompt: string;
                let imageUrl: string;
    
                const useVisualReference = 
                    (isReferenceTabActive && referenceFile) ||
                    (activeTab === 'prompt' && imageModel === 'gemini-2.5-flash-image-preview' && sessionReferenceImageRef.current);
    
                const currentReference = isReferenceTabActive ? referenceFile : sessionReferenceImageRef.current;
    
                if (useVisualReference && currentReference) {
                    finalPrompt = `Photorealistic 4k prewedding photo. **Use the reference image for the couple's exact appearance (faces, clothes). Maintain their Indonesian ethnicity.**
- New Scene (${locationTheme}): ${scenario.scene}
- Emotion: ${scenario.emotion}
- Style: ${photoStyle}
${prompt && isReferenceTabActive ? `- User Notes: ${prompt}\n` : ''}- Negative Prompts: ${negativePrompt || 'None'}`;
                    imageUrl = await performApiCall(apiKey => generateImage(apiKey, finalPrompt, imageModel, currentReference.base64, currentReference.mimeType));
                } else {
                     finalPrompt = `Photorealistic 4k cinematic prewedding photo of a young **Indonesian couple with authentic Southeast Asian features.**
- **Appearance (Strictly follow):** "${baseDescription}"
- **Location:** ${locationTheme}
- **Scene:** ${scenario.scene}
- **Emotion:** ${scenario.emotion}
- **Style:** ${photoStyle}
- **Negative Prompts:** ${negativePrompt || 'None'}`;
                    
                    imageUrl = await performApiCall(apiKey => generateImage(apiKey, finalPrompt, imageModel));
    
                    if (activeTab === 'prompt' && imageModel === 'gemini-2.5-flash-image-preview' && i === startIndex) {
                        const [header, base64] = imageUrl.split(',');
                        const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
                        sessionReferenceImageRef.current = { base64, mimeType };
                    }
                }
    
                setGeneratedImages(prev => [...prev, { id: generateRandomFilename(), url: imageUrl }]);
                scenarioIndex++;
    
                if (i < targetCount - 1 && delay > 0 && isGenerationRunningRef.current) {
                    setStatusText(`Gambar ${i + 1} berhasil. Jeda ${delay} detik...`);
                    await new Promise(resolve => setTimeout(resolve, delay * 1000));
                }
            }
    
        } catch (error) {
            const e = error as Error;
            setModals(prev => ({ ...prev, error: `Sesi foto gagal: ${e.message}` }));
        } finally {
            if (isGenerationRunningRef.current) {
                setStatusText("Sesi foto selesai!");
                setSessionFinished(true);
            } else {
                setStatusText("Proses dihentikan.");
            }
            setIsLoading(false);
            isGenerationRunningRef.current = false;
        }
    };

    const handleStop = () => {
        isGenerationRunningRef.current = false;
        setStatusText("Menghentikan proses...");
    };
    
    const handleDownloadZip = async (aspectRatio?: number) => {
        setModals(prev => ({...prev, download: false}));
        const zip = new JSZip();

        for (const image of generatedImages) {
            try {
                let blob = await fetch(image.url).then(res => res.blob());
                if (aspectRatio) {
                    blob = await cropImageToAspectRatio(blob, aspectRatio);
                }
                zip.file(generateRandomFilename('prewedding', 'jpeg'), blob);
            } catch (e) {
                console.error("Failed to process image for download:", image.url, e);
            }
        }
        
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, generateRandomFilename('prewedding', 'zip'));
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">AI Prewedding Photographer</h1>
                            <p className="text-sm text-slate-600 mt-1">Generate stunning prewedding photos with AI</p>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setShowDebugPanel(true)}
                                className="px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                Debug API
                            </button>
                            <button 
                                onClick={() => setIsApiModalOpen(true)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Manage API Keys
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* API Key Management Modal */}
            {isApiModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-slate-900">Kelola API Keys</h3>
                            <button
                                onClick={() => setIsApiModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Add New API Key */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Tambah API Key Baru
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={apiKeyInput}
                                        onChange={(e) => setApiKeyInput(e.target.value)}
                                        placeholder="Masukkan Gemini API key..."
                                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <button
                                        onClick={async () => {
                                            if (!apiKeyInput.trim()) return;
                                            
                                            setIsKeyValidationLoading(true);
                                            try {
                                                const status = await validateApiKey(apiKeyInput.trim());
                                                const newKey: ApiKey = {
                                                    id: `key_${Date.now()}`,
                                                    value: apiKeyInput.trim(),
                                                    masked: `${apiKeyInput.slice(0, 4)}...${apiKeyInput.slice(-4)}`,
                                                    status
                                                };
                                                
                                                const updatedKeys = [...userApiKeys, newKey];
                                                setUserApiKeys(updatedKeys);
                                                storeApiKeys(updatedKeys);
                                                setApiKeyInput('');
                                                
                                                if (status === 'active') {
                                                    setIsApiModalOpen(false);
                                                }
                                            } catch (error) {
                                                console.error('Error validating API key:', error);
                                            } finally {
                                                setIsKeyValidationLoading(false);
                                            }
                                        }}
                                        disabled={!apiKeyInput.trim() || isKeyValidationLoading}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                    >
                                        {isKeyValidationLoading ? 'Validating...' : 'Tambah'}
                                    </button>
                                </div>
                            </div>

                            {/* Existing API Keys */}
                            {userApiKeys.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        API Keys Tersimpan
                                    </label>
                                    <div className="space-y-2">
                                        {userApiKeys.map((key) => (
                                            <div key={key.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono text-sm text-slate-600">{key.masked}</span>
                                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                                        key.status === 'active' ? 'bg-green-100 text-green-800' :
                                                        key.status === 'invalid' ? 'bg-red-100 text-red-800' :
                                                        key.status === 'exhausted' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {key.status}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const updatedKeys = userApiKeys.filter(k => k.id !== key.id);
                                                        setUserApiKeys(updatedKeys);
                                                        storeApiKeys(updatedKeys);
                                                    }}
                                                    className="text-red-600 hover:text-red-800 text-sm"
                                                >
                                                    Hapus
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Tutorial Link */}
                            <div className="pt-4 border-t border-slate-200">
                                <button
                                    onClick={() => setIsKeyTutorialOpen(true)}
                                    className="text-blue-600 hover:text-blue-800 text-sm underline"
                                >
                                    Cara mendapatkan Gemini API Key
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* API Key Tutorial Modal */}
            {isKeyTutorialOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-slate-900">Cara Mendapatkan Gemini API Key</h3>
                            <button
                                onClick={() => setIsKeyTutorialOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-xl"
                            >
                                ×
                            </button>
                        </div>
                        <div className="space-y-4 text-sm text-slate-700">
                            <div>
                                <h4 className="font-semibold mb-2">Langkah 1: Buka Google AI Studio</h4>
                                <p>Kunjungi <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">https://aistudio.google.com/app/apikey</a></p>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">Langkah 2: Login dengan Google Account</h4>
                                <p>Masuk menggunakan akun Google Anda</p>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">Langkah 3: Create API Key</h4>
                                <p>Klik tombol "Create API Key" dan pilih project Google Cloud Anda</p>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">Langkah 4: Copy API Key</h4>
                                <p>Salin API key yang dihasilkan dan paste ke form di atas</p>
                            </div>
                            <div className="bg-yellow-50 p-3 rounded-lg">
                                <p className="text-yellow-800"><strong>Catatan:</strong> API key ini gratis dengan quota terbatas. Jangan bagikan API key Anda kepada orang lain.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Debug Panel Modal */}
            {showDebugPanel && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-slate-900">API Debug Panel</h3>
                            <button
                                onClick={() => setShowDebugPanel(false)}
                                className="text-slate-400 hover:text-slate-600 text-xl"
                            >
                                ×
                            </button>
                        </div>
                        <ApiKeyDebug apiKeys={userApiKeys} />
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Panel - Controls */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Tab Navigation */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg mb-6">
                                <button
                                    onClick={() => setActiveTab('prompt')}
                                    className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                                        activeTab === 'prompt' 
                                            ? 'bg-white text-slate-900 shadow-sm' 
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    Teks Prompt
                                </button>
                                <button
                                    onClick={() => setActiveTab('reference')}
                                    className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                                        activeTab === 'reference' 
                                            ? 'bg-white text-slate-900 shadow-sm' 
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    Foto Referensi
                                </button>
                            </div>

                            {/* Tab Content */}
                            {activeTab === 'prompt' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Deskripsi Pasangan
                                        </label>
                                        <textarea
                                            value={prompt}
                                            onChange={(e) => setPrompt(e.target.value)}
                                            placeholder="Contoh: Pasangan muda Indonesia, wanita berhijab putih dengan dress cream, pria kemeja putih..."
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                            rows={4}
                                        />
                                    </div>
                                    
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleEnhancePrompt}
                                            disabled={isEnhancing || !prompt}
                                            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                                        >
                                            {isEnhancing ? 'Meningkatkan...' : 'Tingkatkan Prompt'}
                                        </button>
                                        <button
                                            onClick={generateAutoDescription}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                        >
                                            Auto Generate
                                        </button>
                                    </div>

                                    {/* Auto Generate Preview */}
                                    {previewData && (
                                        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                                            <h4 className="font-medium text-slate-900 mb-2">Preview Auto Generate:</h4>
                                            {previewData.isLoading ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-sm text-slate-600">Membuat preview...</span>
                                                </div>
                                            ) : previewData.error ? (
                                                <p className="text-sm text-red-600">{previewData.error}</p>
                                            ) : (
                                                <div className="space-y-3">
                                                    <p className="text-sm text-slate-700">{previewData.textPrompt}</p>
                                                    {previewData.imageUrl && (
                                                        <div className="flex gap-3">
                                                            <img 
                                                                src={previewData.imageUrl} 
                                                                alt="Preview" 
                                                                className="w-20 h-20 object-cover rounded-lg"
                                                            />
                                                            <div className="flex flex-col gap-2">
                                                                <button
                                                                    onClick={() => setPrompt(previewData.textPrompt)}
                                                                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                                                                >
                                                                    Gunakan Deskripsi
                                                                </button>
                                                                <button
                                                                    onClick={() => setPreviewData(null)}
                                                                    className="px-3 py-1 bg-slate-600 text-white text-sm rounded hover:bg-slate-700 transition-colors"
                                                                >
                                                                    Tutup
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Adat Preview */}
                                    <div className="mt-4 p-4 bg-amber-50 rounded-lg">
                                        <h4 className="font-medium text-amber-900 mb-2">Generate Pakaian Adat:</h4>
                                        <div className="flex gap-2 mb-3">
                                            <input
                                                type="text"
                                                placeholder="Contoh: Jawa Tengah, Bali, Sumatra Barat..."
                                                value={adatPreviewData?.region || ''}
                                                onChange={(e) => setAdatPreviewData(prev => ({ 
                                                    ...(prev || { region: '', textPrompt: '', imageUrl: null, isLoading: false, status: 'idle', error: null }), 
                                                    region: e.target.value 
                                                }))}
                                                className="flex-1 px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                                            />
                                            <button
                                                onClick={handleGenerateAdatPreview}
                                                disabled={adatPreviewData?.isLoading}
                                                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors text-sm"
                                            >
                                                {adatPreviewData?.isLoading ? 'Loading...' : 'Generate'}
                                            </button>
                                        </div>

                                        {adatPreviewData && (
                                            <div>
                                                {adatPreviewData.isLoading ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                                                        <span className="text-sm text-amber-700">
                                                            {adatPreviewData.status === 'generating_text' ? 'Membuat deskripsi...' : 'Membuat gambar...'}
                                                        </span>
                                                    </div>
                                                ) : adatPreviewData.error ? (
                                                    <p className="text-sm text-red-600">{adatPreviewData.error}</p>
                                                ) : adatPreviewData.textPrompt && (
                                                    <div className="space-y-3">
                                                        <p className="text-sm text-amber-800">{adatPreviewData.textPrompt}</p>
                                                        {adatPreviewData.imageUrl && (
                                                            <div className="flex gap-3">
                                                                <img 
                                                                    src={adatPreviewData.imageUrl} 
                                                                    alt="Adat Preview" 
                                                                    className="w-20 h-20 object-cover rounded-lg"
                                                                />
                                                                <div className="flex flex-col gap-2">
                                                                    <button
                                                                        onClick={() => setPrompt(adatPreviewData.textPrompt)}
                                                                        className="px-3 py-1 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 transition-colors"
                                                                    >
                                                                        Gunakan Deskripsi
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setAdatPreviewData(null)}
                                                                        className="px-3 py-1 bg-slate-600 text-white text-sm rounded hover:bg-slate-700 transition-colors"
                                                                    >
                                                                        Tutup
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'reference' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Upload Foto Referensi
                                        </label>
                                        <div
                                            onDrop={handleDrop}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.classList.add('border-blue-500', 'bg-slate-100');
                                            }}
                                            onDragLeave={(e) => {
                                                e.preventDefault();
                                                e.currentTarget.classList.remove('border-blue-500', 'bg-slate-100');
                                            }}
                                            className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-slate-400 transition-colors cursor-pointer"
                                            onClick={() => document.getElementById('file-input')?.click()}
                                        >
                                            {imagePreview ? (
                                                <div className="space-y-3">
                                                    <img src={imagePreview} alt="Preview" className="mx-auto max-h-32 rounded-lg" />
                                                    <p className="text-sm text-slate-600">Klik untuk mengganti foto</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="mx-auto w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                                                        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                        </svg>
                                                    </div>
                                                    <p className="text-sm text-slate-600">Drag & drop atau klik untuk upload</p>
                                                    <p className="text-xs text-slate-500">PNG, JPG hingga 10MB</p>
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            id="file-input"
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                                            className="hidden"
                                        />
                                    </div>
                                    
                                    {referenceFile && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Catatan Tambahan (Opsional)
                                            </label>
                                            <textarea
                                                value={prompt}
                                                onChange={(e) => setPrompt(e.target.value)}
                                                placeholder="Contoh: Ganti background ke pantai, ubah pose lebih romantis..."
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                                rows={3}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Settings */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">Pengaturan</h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Tema Lokasi
                                    </label>
                                    <select
                                        value={locationTheme}
                                        onChange={(e) => setLocationTheme(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        {Object.entries(locationGroups).map(([group, locations]) => (
                                            <optgroup key={group} label={group}>
                                                {locations.map(location => (
                                                    <option key={location} value={location}>{location}</option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Model AI
                                    </label>
                                    <select
                                        value={imageModel}
                                        onChange={(e) => setImageModel(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="gemini-2.5-flash-image-preview">Gemini 2.5 Flash (Cepat)</option>
                                        <option value="imagen-3.0-generate-001">Imagen 3.0 (Kualitas Tinggi)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Jumlah Foto: {imageCount}
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        value={imageCount}
                                        onChange={(e) => setImageCount(parseInt(e.target.value))}
                                        className="w-full"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Jeda Antar Foto: {delay}s
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="10"
                                        value={delay}
                                        onChange={(e) => setDelay(parseInt(e.target.value))}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Negative Prompts */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">Filter Negatif</h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Tag Negatif
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {D.negativePromptTags.map(tag => (
                                            <button
                                                key={tag}
                                                onClick={() => toggleNegativePrompt(tag)}
                                                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                                                    selectedNegativePrompts.has(tag)
                                                        ? 'bg-red-100 text-red-800 border border-red-300'
                                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                            >
                                                {tag}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Custom Negative Prompt
                                    </label>
                                    <textarea
                                        value={customNegativePrompt}
                                        onChange={(e) => setCustomNegativePrompt(e.target.value)}
                                        placeholder="Contoh: blur, low quality, distorted..."
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                        rows={2}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <div className="space-y-4">
                                {!isLoading ? (
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => runGeneration(false)}
                                            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                                        >
                                            🎯 Mulai Sesi Foto
                                        </button>
                                        {generatedImages.length > 0 && sessionFinished && (
                                            <button
                                                onClick={() => runGeneration(true)}
                                                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                                            >
                                                ➕ Lanjutkan Sesi ({imageCount} foto lagi)
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleStop}
                                        className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                                    >
                                        ⏹️ Hentikan Proses
                                    </button>
                                )}
                                
                                {statusText && (
                                    <div className="text-center">
                                        <p className="text-sm text-slate-600">{statusText}</p>
                                        {isLoading && (
                                            <div className="mt-2 w-full bg-slate-200 rounded-full h-2">
                                                <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Results */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-semibold text-slate-900">
                                    Hasil Foto ({generatedImages.length})
                                </h3>
                                {generatedImages.length > 0 && (
                                    <button
                                        onClick={() => setModals(prev => ({...prev, download: true}))}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                    >
                                        📥 Download Semua
                                    </button>
                                )}
                            </div>

                            {generatedImages.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="mx-auto w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                        <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <h4 className="text-lg font-medium text-slate-900 mb-2">Belum Ada Foto</h4>
                                    <p className="text-slate-600">Mulai sesi foto untuk melihat hasil AI di sini</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {generatedImages.map((image) => (
                                        <div key={image.id} className="group relative">
                                            <img
                                                src={image.url}
                                                alt="Generated"
                                                className="w-full aspect-[3/4] object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                                onClick={() => setModals(prev => ({...prev, lightbox: image.url}))}
                                            />
                                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setModals(prev => ({...prev, lightbox: image.url}))}
                                                        className="p-2 bg-white rounded-full shadow-lg hover:bg-slate-50 transition-colors"
                                                    >
                                                        <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Error Modal */}
            {modals.error && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full">
                        <h3 className="text-lg font-semibold text-red-600 mb-4">Error</h3>
                        <p className="text-slate-700 mb-4">{modals.error}</p>
                        <button
                            onClick={() => setModals(prev => ({...prev, error: null}))}
                            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            )}

            {/* Download Modal */}
            {modals.download && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Download Foto</h3>
                        <p className="text-slate-600 mb-6">Pilih format download:</p>
                        <div className="space-y-3">
                            <button
                                onClick={() => handleDownloadZip()}
                                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-left"
                            >
                                <div className="font-medium">Original (3:4)</div>
                                <div className="text-sm opacity-90">Download dalam ukuran asli</div>
                            </button>
                            <button
                                onClick={() => handleDownloadZip(1)}
                                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-left"
                            >
                                <div className="font-medium">Square (1:1)</div>
                                <div className="text-sm opacity-90">Cocok untuk Instagram post</div>
                            </button>
                            <button
                                onClick={() => handleDownloadZip(16/9)}
                                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-left"
                            >
                                <div className="font-medium">Landscape (16:9)</div>
                                <div className="text-sm opacity-90">Cocok untuk wallpaper</div>
                            </button>
                        </div>
                        <button
                            onClick={() => setModals(prev => ({...prev, download: false}))}
                            className="w-full mt-4 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                        >
                            Batal
                        </button>
                    </div>
                </div>
            )}

            {/* Lightbox Modal */}
            {modals.lightbox && (
                <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
                    <div className="relative max-w-4xl max-h-full">
                        <img
                            src={modals.lightbox}
                            alt="Full size"
                            className="max-w-full max-h-full object-contain rounded-lg"
                        />
                        <button
                            onClick={() => setModals(prev => ({...prev, lightbox: null}))}
                            className="absolute top-4 right-4 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MainApp;