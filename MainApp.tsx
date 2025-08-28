import React, { useState, useCallback, useMemo, useRef, useEffect, useContext } from 'react';
import saveAs from 'file-saver';
import JSZip from 'jszip';
import { GeneratedImage, ModalState, ReferenceFile, ActiveTab } from './types';
import { generateImage, generateText } from './services/geminiService';
import { shuffleArray, generateRandomFilename, cropImageToAspectRatio } from './utils';
import * as D from './creativeData';
import { AuthContext } from './services/auth';
import { useNotification } from './contexts/NotificationContext';


const MainApp: React.FC = () => {
    const { logout } = useContext(AuthContext);
    const { addToast } = useNotification();
    const [prompt, setPrompt] = useState('');
    const [referenceFile, setReferenceFile] = useState<ReferenceFile | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageCount, setImageCount] = useState(5);
    const [delay, setDelay] = useState(10);
    const [locationTheme, setLocationTheme] = useState('Kehidupan Sehari-hari');
    const [activeTab, setActiveTab] = useState<ActiveTab>('prompt');
    const [imageModel, setImageModel] = useState('gemini-2.5-flash-image-preview');

    const [selectedNegativePrompts, setSelectedNegativePrompts] = useState<Set<string>>(new Set());
    const [isNegativePanelOpen, setIsNegativePanelOpen] = useState(false);
    const [visibleNegativeCount, setVisibleNegativeCount] = useState(10);
    const [showAllNegativeOptions, setShowAllNegativeOptions] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    
    const [modals, setModals] = useState<ModalState>({ error: null, download: false, lightbox: null });
    const [previewData, setPreviewData] = useState<{ textPrompt: string; imageUrl: string | null; isLoading: boolean; error: string | null } | null>(null);
    const [adatPreviewData, setAdatPreviewData] = useState<{
        region: string;
        textPrompt: string;
        imageUrl: string | null;
        isLoading: boolean;
        status: 'idle' | 'generating_text' | 'generating_image';
        error: string | null;
    } | null>(null);


    const [userApiKeys, setUserApiKeys] = useState<string[]>([]);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);


    const currentApiKeyIndexRef = useRef(0);
    const isGenerationRunningRef = useRef(false);
    
    const isApiKeySet = userApiKeys.length > 0;

    useEffect(() => {
        // When MainApp is mounted, we want to prevent the body from scrolling
        // to allow the internal panels to handle their own scrolling.
        document.body.classList.add('main-app-visible');
    
        // Cleanup function to remove the class when the component unmounts
        return () => {
            document.body.classList.remove('main-app-visible');
        };
    }, []); // Empty dependency array ensures this runs only on mount and unmount

    useEffect(() => {
        const savedKeys = localStorage.getItem('userApiKeys');
        if (savedKeys) {
            try {
                const keysArray = JSON.parse(savedKeys);
                if (Array.isArray(keysArray)) {
                    setUserApiKeys(keysArray);
                    setApiKeyInput(keysArray.join('\n'));
                }
            } catch (e) {
                console.error("Failed to parse API keys from localStorage", e);
            }
        }
    }, []);

    const handleSaveApiKeys = () => {
        const keys = apiKeyInput.split('\n').map(k => k.trim()).filter(Boolean);
        setUserApiKeys(keys);
        localStorage.setItem('userApiKeys', JSON.stringify(keys));
        currentApiKeyIndexRef.current = 0;
        setIsApiKeyModalOpen(false);
        addToast({type: 'success', title: 'Sukses', message: `Berhasil menyimpan ${keys.length} API key.`});
    };

    const locationGroups = useMemo(() => ({
        "Studio": ["Studio Foto Profesional"],
        "Indonesia": ["Kehidupan Sehari-hari", "Kisah Kampus", "Pedesaan", "Hutan Tropis", "Street Food", "Bali", "Yogyakarta", "Jakarta"],
        "Jepang": ["Tokyo", "Kyoto", "Hokkaido", "Osaka"],
        "Eropa": ["Paris", "Santorini", "Rome", "Norway", "Switzerland", "Iceland"],
        "Asia & Oseania": ["Seoul", "New Zealand", "Thailand", "Maldives", "Australia"],
        "Afrika": ["Morocco"]
    }), []);

    const handleFileChange = useCallback((file: File | null) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                const [header, base64] = result.split(',');
                const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
                setReferenceFile({ base64, mimeType });
                setImagePreview(result);
            };
            reader.readAsDataURL(file);
        } else {
            addToast({type: 'error', title: 'File Tidak Valid', message: 'Harap unggah file gambar yang valid.'});
            setReferenceFile(null);
            setImagePreview(null);
        }
    }, [addToast]);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.classList.remove('border-blue-500', 'bg-slate-100');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileChange(e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
        }
    }, [handleFileChange]);
    
    const handleEnhancePrompt = async () => {
        if (!isApiKeySet) {
             addToast({type: 'warning', title: 'API Key Diperlukan', message: 'Harap masukkan API Key Anda untuk menggunakan fitur ini.'});
             return;
        }
        if (!prompt.trim()) {
            addToast({type: 'info', title: 'Deskripsi Kosong', message: 'Tulis deskripsi singkat terlebih dahulu sebelum di-enhance.'});
            return;
        }

        setIsEnhancing(true);
        addToast({type: 'info', title: 'Meningkatkan Prompt...', message: 'AI sedang bekerja untuk menyempurnakan deskripsi Anda.'});

        const apiKeyForEnhance = userApiKeys[0];

        try {
            const enhanceInstruction = `You are an expert prompt engineer for an AI image generator specializing in hyper-realistic pre-wedding photography. Your task is to take a user's basic description and expand it into a rich, detailed, and cinematic prompt. The final prompt should be a single, cohesive paragraph in English.

User's description: "${prompt}"

Enhance it.`;
            
            const enhancedText = await generateText(enhanceInstruction, apiKeyForEnhance);
            
            setPrompt(enhancedText);
            addToast({type: 'success', title: 'Prompt Ditingkatkan', message: 'Deskripsi Anda telah berhasil disempurnakan oleh AI.'});

        } catch (error) {
            console.error("Error enhancing prompt:", error);
            const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan";
            addToast({type: 'error', title: 'Gagal Meningkatkan Prompt', message: `Terjadi kesalahan: ${errorMessage}`});
        } finally {
            setIsEnhancing(false);
        }
    };
    
    const generateAutoDescription = async () => {
        if (!isApiKeySet) {
             addToast({type: 'warning', title: 'API Key Diperlukan', message: 'Harap masukkan API Key Anda melalui tombol "API KEY" di atas.'});
             return;
        }
        setPreviewData({ textPrompt: '', imageUrl: null, isLoading: true, error: null });

        const apiKeyForPreview = userApiKeys[0];

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
            
            const imageGenPrompt = `A hyper-realistic, 4k cinematic preview photograph with a 3:4 aspect ratio. Description: "${fullPrompt}". The photo must feature only one man and one woman.`;
            const imageUrl = await generateImage(imageGenPrompt, apiKeyForPreview, 'gemini-2.5-flash-image-preview');

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
        if (!isApiKeySet) {
             addToast({type: 'warning', title: 'API Key Diperlukan', message: 'Harap masukkan API Key Anda terlebih dahulu.'});
             return;
        }
        
        const region = adatPreviewData.region;
        const apiKeyForPreview = userApiKeys[0];

        setAdatPreviewData(prev => ({ ...(prev!), imageUrl: null, textPrompt: '', isLoading: true, status: 'generating_text', error: null }));

        try {
            const textGenPrompt = `Generate a concise yet culturally rich description in English for a cinematic prewedding photo. The couple is wearing complete traditional wedding attire from the ${region} region of Indonesia. Focus on key, visually distinct elements: specific names of garments (e.g., Beskap, Kebaya), intricate patterns (e.g., Batik, Songket), and important accessories (e.g., Blangkon, Sanggul, Keris). The description should be optimized as a prompt for an AI image generator. Be descriptive but not overly long.`;
            const generatedText = await generateText(textGenPrompt, apiKeyForPreview);

            setAdatPreviewData(prev => ({ ...(prev!), textPrompt: generatedText, status: 'generating_image' }));
            
            const imageGenPrompt = `A hyper-realistic, 4k cinematic preview photograph with a 3:4 aspect ratio. Description: "${generatedText}". The photo must feature only one man and one woman, with culturally accurate and detailed attire.`;
            const imageUrl = await generateImage(imageGenPrompt, apiKeyForPreview, 'gemini-2.5-flash-image-preview');

            setAdatPreviewData(prev => ({ ...(prev!), imageUrl, isLoading: false, status: 'idle' }));

        } catch (error) {
             console.error("Error generating adat preview:", error);
            const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan";
            setAdatPreviewData(prev => ({ ...(prev!), isLoading: false, status: 'idle', error: `Gagal membuat preview: ${errorMessage}` }));
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

    const runGeneration = async () => {
        if (isGenerationRunningRef.current) return;
        
        if (!isApiKeySet) {
            addToast({type: 'error', title: 'API Key Kosong', message: 'Tidak ada API key yang tersedia. Harap atur melalui tombol "API KEY" di atas.'});
            return;
        }

        const isReferenceMode = activeTab === 'reference' && imageModel !== 'imagen-4.0-generate-001';
        if (isReferenceMode && !referenceFile) {
            addToast({type: 'error', title: 'Referensi Dibutuhkan', message: 'Harap unggah foto referensi terlebih dahulu.'});
            return;
        }
        if (!isReferenceMode && !prompt) {
            addToast({type: 'error', title: 'Deskripsi Dibutuhkan', message: 'Harap isi deskripsi pasangan di tab "Teks Prompt".'});
            return;
        }
        
        isGenerationRunningRef.current = true;
        setIsLoading(true);
        setGeneratedImages([]); 
        
        const availableKeys = userApiKeys;

        const themeData = D.creativeDatabase[locationTheme];
        const shuffledScenarios = shuffleArray(themeData.scenarios);
        const shuffledInteractions = shuffleArray(themeData.interactions);
        const shuffledStyles = shuffleArray(D.photographicStyles);
        const shuffledCreativeAngles = shuffleArray(D.creativeAngles);
        const shuffledActionInteractions = shuffleArray(D.actionInteractions);
        const shuffledEmotionalExpressions = shuffleArray(D.emotionalExpressions);

        for (let i = 0; i < imageCount; i++) {
            if (!isGenerationRunningRef.current) break;

            // Apply delay BEFORE the attempt for the next image (except the first one)
            if (i > 0 && delay > 0) {
                setStatusText(`Jeda ${delay} detik sebelum gambar berikutnya...`);
                await new Promise(resolve => setTimeout(resolve, delay * 1000));
            }
            // Check again in case user stopped during delay
            if (!isGenerationRunningRef.current) break;

            let success = false;
            let keyRotationAttempts = 0;

            while (!success && keyRotationAttempts < availableKeys.length && isGenerationRunningRef.current) {
                const currentKeyIndex = (currentApiKeyIndexRef.current + keyRotationAttempts) % availableKeys.length;
                const apiKey = availableKeys[currentKeyIndex];
                
                try {
                    setStatusText(`Membuat gambar ${i + 1}/${imageCount} | Kunci #${currentKeyIndex + 1}`);

                    const negativePrompt = Array.from(selectedNegativePrompts).join(', ');
                    const scenario = shuffledScenarios[i % shuffledScenarios.length];
                    const interaction = shuffledInteractions[i % shuffledInteractions.length];
                    const finalInteraction = Math.random() > 0.5 ? interaction : shuffledActionInteractions[i % shuffledActionInteractions.length];
                    const photoStyle = shuffledStyles[i % shuffledStyles.length];
                    const emotion = shuffledEmotionalExpressions[i % shuffledEmotionalExpressions.length];
                    const creativeAngle = shuffledCreativeAngles[i % shuffledCreativeAngles.length];

                    let imageUrl: string;
                    let finalPrompt: string;
                    
                    if (isReferenceMode && referenceFile) {
                        finalPrompt = `Strictly use the provided image for the couple's appearance and recreate them in a new, hyper-realistic 4k prewedding photo.
New Scene: ${scenario} in ${locationTheme}.
New Action: The couple is ${finalInteraction}, expressing a moment of ${emotion}.
Art Style: ${photoStyle} from a ${creativeAngle} perspective.
${prompt ? `Additional notes: ${prompt}. ` : ''}
Avoid these elements: ${negativePrompt || 'None'}.
The output must only be the newly generated image.`;
                        imageUrl = await generateImage(finalPrompt, apiKey, imageModel, referenceFile.base64, referenceFile.mimeType);
                    } else {
                         const sceneDetails = `
Scene: The couple is at ${scenario} in ${locationTheme}.
Action: They are captured ${finalInteraction}, expressing a moment of ${emotion}.
Art Style: ${photoStyle} from a ${creativeAngle} perspective.
The photo must feature only one man and one woman.
Avoid these elements: ${negativePrompt || 'None'}.`;

                        if (imageModel === 'gemini-2.5-flash-image-preview') {
                            finalPrompt = `A hyper-realistic, 4k cinematic prewedding photograph with a 3:4 aspect ratio, featuring: "${prompt}". ${sceneDetails}`;
                        } else { // imagen-4.0-generate-001
                            finalPrompt = `A hyper-realistic, 4k cinematic prewedding photograph of: "${prompt}". ${sceneDetails}`;
                        }
                        imageUrl = await generateImage(finalPrompt, apiKey, imageModel);
                    }
                    
                    setGeneratedImages(prev => [...prev, { id: generateRandomFilename(), url: imageUrl }]);
                    success = true;
                    currentApiKeyIndexRef.current = currentKeyIndex; // Remember the last successful key

                } catch (error) {
                    const e = error as Error;
                    const errorMessage = e.message || '';
                    console.error(`Attempt with key #${currentKeyIndex + 1} failed:`, errorMessage);
                    
                    if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
                        setStatusText(`Kunci #${currentKeyIndex + 1} kena limit. Mencoba kunci berikutnya...`);
                    } else {
                         setStatusText(`Error Kunci #${currentKeyIndex + 1}. Mencoba kunci berikutnya...`);
                    }
                    
                    keyRotationAttempts++;

                    // Add a small mandatory delay before trying the next key to avoid hammering
                    if (isGenerationRunningRef.current && keyRotationAttempts < availableKeys.length) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            } 

            if (!success && isGenerationRunningRef.current) {
                addToast({type: 'error', title: `Gagal menghasilkan gambar ${i+1}`, message: 'Semua API key Anda mungkin telah mencapai batas kuota. Coba tambah jeda atau tambah kunci baru.'});
                isGenerationRunningRef.current = false;
                break; 
            }
        } 

        if (isGenerationRunningRef.current) {
            setStatusText("Sesi foto selesai!");
        } else {
            setStatusText("Proses dihentikan oleh pengguna.");
        }
        setIsLoading(false);
        isGenerationRunningRef.current = false;
    };
    
    const handleDownloadZip = async (aspectRatio?: number) => {
        setModals(prev => ({...prev, download: false}));
        addToast({type: 'info', title: 'Mempersiapkan Unduhan', message: 'File ZIP sedang dibuat, harap tunggu...'});
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
                 addToast({type: 'error', title: 'Gagal Memproses Gambar', message: `Tidak dapat memproses gambar: ${image.id}`});
            }
        }
        
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, generateRandomFilename('prewedding_collection', 'zip'));
    };
    
    const renderedNegativeTags = useMemo(() => {
        const tagsToShow = showAllNegativeOptions 
            ? D.negativePromptOptions 
            : D.negativePromptOptions.slice(0, visibleNegativeCount);
            
        return tagsToShow.map(tag => (
            <span 
                key={tag} 
                className={`negative-tag ${selectedNegativePrompts.has(tag) ? 'selected' : ''}`} 
                onClick={() => toggleNegativePrompt(tag)}
            >
                {tag}
            </span>
        ));
    }, [visibleNegativeCount, selectedNegativePrompts, showAllNegativeOptions]);


    return (
        <div id="main-app-layout" className="flex flex-col lg:flex-row h-screen bg-slate-50">
            {/* Control Panel */}
            <aside className="w-full lg:w-1/3 xl:w-[380px] bg-white p-6 shadow-lg custom-scrollbar overflow-y-auto border-r border-slate-200">
                <div className="sticky top-0 bg-white py-4 z-10 flex justify-between items-center -mx-6 px-6 border-b border-slate-200">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Generate Photo</h1>
                        <p className="text-sm text-slate-500 mt-1">Prewedding Edition</p>
                    </div>
                     <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsApiKeyModalOpen(true)}
                            className="bg-slate-100 text-slate-800 font-semibold py-2 px-4 rounded-lg text-sm hover:bg-slate-200 transition-colors"
                        >
                            API KEY
                        </button>
                         <button
                            onClick={logout}
                            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>

                <div className="flex border-b border-slate-200 mt-6">
                    <button
                        onClick={() => setActiveTab('prompt')}
                        className={`flex-1 pb-3 px-1 text-sm font-semibold transition-colors focus:outline-none ${activeTab === 'prompt' ? 'border-b-2 border-blue-600 text-blue-600' : 'border-b-2 border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        Teks Prompt
                    </button>
                    <button
                        onClick={() => setActiveTab('reference')}
                        disabled={imageModel === 'imagen-4.0-generate-001'}
                        className={`flex-1 pb-3 px-1 text-sm font-semibold transition-colors focus:outline-none ${activeTab === 'reference' ? 'border-b-2 border-blue-600 text-blue-600' : 'border-b-2 border-transparent text-slate-500'} ${imageModel === 'imagen-4.0-generate-001' ? 'cursor-not-allowed opacity-50' : 'hover:text-slate-800'}`}
                        title={imageModel === 'imagen-4.0-generate-001' ? 'Model Imagen tidak mendukung gambar referensi' : ''}
                    >
                        Prompt + Referensi
                    </button>
                </div>
                
                <div className="mt-8 space-y-6">
                    {activeTab === 'prompt' && (
                        <div>
                             <div className="relative">
                                <label htmlFor="prompt" className="block text-sm font-medium text-slate-700 mb-2">1. Deskripsi Pasangan & Pakaian</label>
                                <textarea id="prompt" rows={8} value={prompt} onChange={e => setPrompt(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400" placeholder="Tulis deskripsi singkat, lalu klik 'Enhance' atau buat deskripsi ajaib..."></textarea>
                                <div className="absolute bottom-3 right-3 flex gap-2">
                                     <button
                                        onClick={handleEnhancePrompt}
                                        disabled={!isApiKeySet || !prompt.trim() || isEnhancing}
                                        className="text-xs bg-purple-100 text-purple-800 font-semibold py-1 px-2 rounded-md hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Sempurnakan deskripsi Anda dengan AI"
                                    >
                                        {isEnhancing ? 'Memproses...' : '🚀 Enhance'}
                                    </button>
                                     <button onClick={() => setAdatPreviewData({ region: '', textPrompt: '', imageUrl: null, isLoading: false, status: 'idle', error: null })} disabled={!isApiKeySet} className="text-xs bg-blue-100 text-blue-800 font-semibold py-1 px-2 rounded-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed">
                                        Pakaian Adat
                                    </button>
                                    <button onClick={generateAutoDescription} disabled={!isApiKeySet} className="text-xs bg-blue-100 text-blue-700 font-semibold py-1 px-2 rounded-md hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed">
                                        ✨ Pakaian Casual
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'reference' && (
                        <>
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">1. Unggah Foto Referensi <span className="text-slate-400 font-normal">(Wajib)</span></label>
                            <div 
                                id="drop-zone" 
                                onDrop={handleDrop} 
                                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-blue-500', 'bg-slate-100'); }}
                                onDragLeave={e => e.currentTarget.classList.remove('border-blue-500', 'bg-slate-100')}
                                onClick={() => document.getElementById('file-input')?.click()}
                                className="flex justify-center items-center w-full h-40 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors"
                            >
                                {!imagePreview ? (
                                    <div id="drop-zone-text" className="text-center text-slate-500">
                                        <svg className="mx-auto h-10 w-10 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                                        <p className="mt-2 text-sm">Drag & drop atau klik</p>
                                    </div>
                                ) : (
                                    <img id="image-preview" src={imagePreview} className="h-full w-full object-contain rounded-lg p-2" alt="Image Preview" />
                                )}
                                <input type="file" id="file-input" onChange={e => handleFileChange(e.target.files?.[0] ?? null)} className="hidden" accept="image/*"/>
                            </div>
                             <p className="text-xs text-slate-500 mt-2">
                                Mode ini disarankan untuk hasil lebih baik & menghindari batas kuota harian.
                            </p>
                        </div>
                        <div>
                            <label htmlFor="prompt-ref" className="block text-sm font-medium text-slate-700 mb-2">2. Panduan Tambahan <span className="text-slate-400 font-normal">(Opsional)</span></label>
                            <textarea id="prompt-ref" rows={3} value={prompt} onChange={e => setPrompt(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400" placeholder="Misal: ubah pakaian menjadi gaun pengantin..."></textarea>
                        </div>
                        </>
                    )}

                     <div>
                        <label htmlFor="model-select" className="block text-sm font-medium text-slate-700 mb-2">2. Pilih Model AI</label>
                        <select 
                            id="model-select" 
                            value={imageModel} 
                            onChange={e => {
                                const newModel = e.target.value;
                                setImageModel(newModel);
                                if (newModel === 'imagen-4.0-generate-001' && activeTab === 'reference') {
                                    setActiveTab('prompt');
                                }
                            }} 
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="gemini-2.5-flash-image-preview">Gemini Flash (Cepat & Fleksibel)</option>
                            <option value="imagen-4.0-generate-001">Imagen 4 (Kualitas Tertinggi)</option>
                        </select>
                        {imageModel === 'imagen-4.0-generate-001' && (
                            <p className="text-xs text-amber-600 mt-2">
                                Model Imagen tidak mendukung gambar referensi. Tab "Prompt + Referensi" dinonaktifkan.
                            </p>
                        )}
                    </div>
                    
                    <div>
                        <label htmlFor="location-theme" className="block text-sm font-medium text-slate-700 mb-2">3. Pilih Tema Sesi Foto</label>
                        <select id="location-theme" value={locationTheme} onChange={e => setLocationTheme(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500">
                            {Object.entries(locationGroups).map(([group, themes]) => {
                                const validThemes = themes.filter(theme => Object.prototype.hasOwnProperty.call(D.creativeDatabase, theme));
                                if (validThemes.length === 0) {
                                    return null;
                                }
                                return (
                                    <optgroup key={group} label={group}>
                                        {validThemes.map(theme => (
                                            <option key={theme} value={theme}>
                                                {["Kehidupan Sehari-hari", "Kisah Kampus", "Studio Foto Profesional"].includes(theme)
                                                    ? theme
                                                    : `Sesi Foto di ${theme}`}
                                            </option>
                                        ))}
                                    </optgroup>
                                );
                            })}
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">4. Hindari Elemen (Negative Prompt)</label>
                        <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 min-h-[80px]">
                            <div id="selected-negative-tags" className="flex flex-wrap gap-2 mb-3">
                                {selectedNegativePrompts.size === 0 ? (
                                    <span className="text-xs text-slate-400">Tidak ada elemen yang dipilih untuk dihindari</span>
                                ) : (
                                    Array.from(selectedNegativePrompts).map(tag => (
                                        <span key={tag} className="selected-negative-tag">
                                            {tag}
                                            <button type="button" aria-label={`Remove ${tag}`} onClick={() => toggleNegativePrompt(tag)}>
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                            </button>
                                        </span>
                                    ))
                                )}
                            </div>
                            <button onClick={() => setIsNegativePanelOpen(p => !p)} className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                Pilih elemen yang ingin dihindari
                            </button>
                        </div>
                        {isNegativePanelOpen && (
                            <div id="negative-prompt-panel" className="mt-3 bg-white border border-slate-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sm font-medium text-slate-700">Pilih elemen yang tidak diinginkan:</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => setSelectedNegativePrompts(new Set(D.negativePromptOptions))} className="text-xs text-green-600 hover:text-green-800 font-medium">Pilih Semua</button>
                                        <button onClick={() => setSelectedNegativePrompts(new Set())} className="text-xs text-red-600 hover:text-red-800">Hapus Semua</button>
                                    </div>
                                </div>
                                <div id="negative-prompt-tags" className="flex flex-wrap gap-2">{renderedNegativeTags}</div>
                                <div className="mt-3">
                                    {showAllNegativeOptions ? (
                                        <button onClick={() => setShowAllNegativeOptions(false)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                                            Tampilkan lebih sedikit
                                        </button>
                                    ) : visibleNegativeCount < D.negativePromptOptions.length ? (
                                        <button onClick={() => { setVisibleNegativeCount(D.negativePromptOptions.length); setShowAllNegativeOptions(true); }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                                            Tampilkan semua...
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="image-count" className="block text-sm font-medium text-slate-700 mb-2">5. Jumlah Foto</label>
                            <input type="number" id="image-count" value={imageCount} onChange={e => setImageCount(parseInt(e.target.value))} min="1" max="10" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500" />
                        </div>
                        <div>
                            <label htmlFor="delay" className="block text-sm font-medium text-slate-700 mb-2">Jeda (detik)</label>
                            <input type="number" id="delay" value={delay} onChange={e => setDelay(parseInt(e.target.value))} min="0" max="30" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500" />
                        </div>
                    </div>
                    
                    {isLoading ? (
                        <button 
                            onClick={() => {
                                isGenerationRunningRef.current = false;
                                setStatusText("Menghentikan proses...");
                            }} 
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center shadow-sm"
                        >
                            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"></path></svg>
                            Hentikan Proses
                        </button>
                    ) : (
                        <button id="generate-btn" onClick={runGeneration} disabled={!isApiKeySet} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center shadow-sm disabled:bg-blue-400 disabled:cursor-not-allowed">
                            <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.562L16.25 22.5l-.648-1.938a3.375 3.375 0 00-2.684-2.684l-1.938-.648 1.938-.648a3.375 3.375 0 002.684-2.684l.648-1.938.648 1.938a3.375 3.375 0 002.684 2.684l1.938.648-1.938.648a3.375 3.375 0 00-2.684 2.684z" /></svg>
                            Mulai Sesi Foto
                        </button>
                    )}
                </div>
            </aside>

            {/* Image Gallery */}
            <main className="w-full lg:flex-1 p-8 custom-scrollbar overflow-y-auto h-screen">
                 <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">Hasil Sesi Foto</h2>
                    <div className="flex space-x-2 mt-4 sm:mt-0">
                        <button onClick={() => setModals(p => ({...p, download: true}))} disabled={generatedImages.length === 0} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors flex items-center shadow-sm disabled:bg-green-400 disabled:cursor-not-allowed">
                            <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                            Download All
                        </button>
                        <button onClick={() => setGeneratedImages([])} disabled={generatedImages.length === 0} className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors flex items-center shadow-sm disabled:bg-red-400 disabled:cursor-not-allowed">
                            <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.067-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                            Clear All
                        </button>
                    </div>
                </div>

                {isLoading && (
                    <div id="status-container" className="text-center my-10"><div className="loader mx-auto"></div><p id="status-text" className="mt-4 text-slate-600">{statusText}</p></div>
                )}

                {generatedImages.length === 0 && !isLoading ? (
                    <div id="welcome-message" className="text-center text-slate-400 mt-20"><svg className="mx-auto h-16 w-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.776 48.776 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg><p className="mt-4 text-lg">Hasil foto Anda akan muncul di sini.</p><p className="text-sm">Atur sesi foto Anda dan biarkan AI bekerja.</p></div>
                ) : (
                    <div id="gallery" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {generatedImages.map((image) => (
                            <div key={image.id} className="group relative bg-slate-200 rounded-lg overflow-hidden shadow-md">
                                <img src={image.url} alt="Generated Prewedding Photo" className="w-full h-full object-cover aspect-[3/4] cursor-pointer" onClick={() => setModals(p => ({...p, lightbox: image.url}))} />
                                <div className="image-card-overlay">
                                    <button onClick={() => saveAs(image.url, generateRandomFilename())} className="p-2 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-75 transition-all" aria-label="Download Image">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                    </button>
                                    <button onClick={() => setGeneratedImages(imgs => imgs.filter(i => i.id !== image.id))} className="p-2 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-75 transition-all" aria-label="Delete Image">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Modals */}
             {isApiKeyModalOpen && (
                <div className="modal-backdrop show">
                    <div className="modal-content w-full max-w-md">
                        <div className="flex justify-between items-center p-6 border-b border-slate-200">
                            <h3 className="text-lg font-bold text-slate-900">Pengaturan API Key</h3>
                            <button onClick={() => setIsApiKeyModalOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Tutup">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-slate-600 mb-2">Kunci API Anda disimpan dengan aman di peramban Anda dan tidak pernah dibagikan.</p>
                            <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg p-3 mb-4">
                                <p className="font-semibold mb-1">Cara Mendapatkan Google API Key:</p>
                                <ol className="list-decimal list-inside space-y-1">
                                    <li>Kunjungi <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="font-bold underline hover:text-blue-600">Google AI Studio</a>.</li>
                                    <li>Klik "Create API key in new project".</li>
                                    <li>Salin (copy) kunci yang muncul.</li>
                                    <li>Tempel (paste) kunci tersebut di sini.</li>
                                </ol>
                            </div>
                            <textarea
                                id="api-keys-modal"
                                rows={5}
                                value={apiKeyInput}
                                onChange={e => setApiKeyInput(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500 textarea-masked"
                                placeholder="Masukkan satu atau lebih API key (satu per baris)"
                            />
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-200 rounded-b-2xl">
                            <button onClick={handleSaveApiKeys} className="w-full text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg">
                                Simpan Kunci ({apiKeyInput.split('\n').map(k => k.trim()).filter(Boolean).length} kunci)
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {adatPreviewData && (
                 <div className="modal-backdrop show">
                    <div className="modal-content w-full max-w-4xl p-0">
                         <div className="flex justify-between items-center p-6 border-b border-slate-200">
                            <h3 className="text-lg font-bold text-slate-900">Preview Pakaian Adat</h3>
                            <button onClick={() => setAdatPreviewData(null)} className="text-slate-400 hover:text-slate-600" aria-label="Tutup pratinjau">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="flex flex-col md:flex-row gap-6">
                                {/* Left Column */}
                                <div className="md:w-1/2 flex flex-col">
                                    <div className="mb-4">
                                        <label htmlFor="adat-region" className="block text-sm font-medium text-slate-700 mb-2">Pakaian adat mana yang akan dibuat?</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                id="adat-region"
                                                value={adatPreviewData.region}
                                                onChange={e => setAdatPreviewData(prev => ({...(prev!), region: e.target.value}))}
                                                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm focus:ring-blue-500 focus:border-blue-500 placeholder-slate-400"
                                                placeholder="Contoh: Jawa, Bali, Minang..." 
                                                disabled={adatPreviewData.isLoading}
                                            />
                                            <button onClick={handleGenerateAdatPreview} disabled={adatPreviewData.isLoading || !adatPreviewData.region} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-wait">
                                                Buat
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <h4 className="text-sm font-semibold text-slate-800 mb-2">Deskripsi Dihasilkan</h4>
                                    <div className="flex-grow bg-slate-50 p-3 rounded-lg border border-slate-200 overflow-y-auto text-xs text-slate-600 min-h-[150px]">
                                        {adatPreviewData.textPrompt || 'Deskripsi akan dibuat di sini setelah Anda memasukkan daerah dan klik "Buat".'}
                                    </div>

                                    <div className="mt-6 flex gap-3">
                                        <button onClick={() => {
                                            setPrompt(adatPreviewData.textPrompt);
                                            setAdatPreviewData(null);
                                        }} disabled={!adatPreviewData.imageUrl || adatPreviewData.isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-blue-400 disabled:cursor-not-allowed">
                                            Gunakan
                                        </button>
                                    </div>
                                </div>
                                 {/* Right Column */}
                                <div className="md:w-1/2">
                                     {adatPreviewData.isLoading ? (
                                        <div className="flex flex-col items-center justify-center h-full w-full aspect-[3/4] bg-slate-50 rounded-lg">
                                            <div className="loader"></div>
                                            <p className="mt-4 text-slate-600 text-center text-sm px-4">
                                                {adatPreviewData.status === 'generating_text'
                                                    ? `Membuat deskripsi untuk pakaian adat ${adatPreviewData.region}...`
                                                    : 'Menggunakan deskripsi untuk membuat preview gambar...'}
                                            </p>
                                        </div>
                                    ) : adatPreviewData.imageUrl ? (
                                        <div className="w-full aspect-[3/4] bg-slate-200 rounded-lg overflow-hidden">
                                            <img src={adatPreviewData.imageUrl} alt="Preview Pakaian Adat" className="w-full h-full object-cover"/>
                                        </div>
                                    ) : adatPreviewData.error ? (
                                        <div className="flex flex-col items-center justify-center h-full w-full aspect-[3/4] bg-red-50 text-red-700 rounded-lg p-4 text-center">
                                           <p className="font-semibold">Oops! Gagal membuat preview.</p>
                                           <p className="text-sm mt-2">{adatPreviewData.error}</p>
                                        </div>
                                    ) : (
                                         <div className="flex flex-col items-center justify-center h-full w-full aspect-[3/4] bg-slate-50 rounded-lg">
                                            <p className="text-slate-500">Preview akan muncul di sini.</p>
                                         </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                 </div>
            )}
             {previewData && (
                <div className="modal-backdrop show">
                    <div className="modal-content w-full max-w-4xl p-0">
                         <div className="flex justify-between items-center p-6 border-b border-slate-200">
                            <h3 className="text-lg font-bold text-slate-900">✨ Preview Pakaian Casual</h3>
                            <button onClick={() => setPreviewData(null)} className="text-slate-400 hover:text-slate-600" aria-label="Tutup pratinjau">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="flex flex-col md:flex-row gap-6">
                                 {/* Left Column */}
                                 <div className="md:w-1/2 flex flex-col">
                                    <h4 className="text-base font-semibold text-slate-800 mb-2">Deskripsi yang Dihasilkan</h4>
                                    <div className="flex-grow bg-slate-50 p-3 rounded-lg border border-slate-200 overflow-y-auto text-xs text-slate-600 min-h-[150px]">
                                        <p>{previewData.textPrompt || 'Menunggu deskripsi...'}</p>
                                    </div>
                                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                                        <button onClick={generateAutoDescription} disabled={previewData.isLoading} className="w-full sm:w-auto flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-wait">
                                            Buat Ulang
                                        </button>
                                        <button onClick={() => {
                                            setPrompt(previewData.textPrompt);
                                            setPreviewData(null);
                                        }} disabled={!previewData.imageUrl || previewData.isLoading} className="w-full sm:w-auto flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-blue-400 disabled:cursor-not-allowed">
                                            Gunakan
                                        </button>
                                    </div>
                                 </div>
                                 {/* Right Column */}
                                 <div className="md:w-1/2">
                                    {previewData.isLoading ? (
                                        <div className="flex flex-col items-center justify-center h-full w-full aspect-[3/4] bg-slate-50 rounded-lg">
                                            <div className="loader"></div>
                                            <p className="mt-4 text-slate-600">Membuat preview gambar...</p>
                                        </div>
                                    ) : previewData.imageUrl ? (
                                        <div className="w-full aspect-[3/4] bg-slate-200 rounded-lg overflow-hidden">
                                            <img src={previewData.imageUrl} alt="Preview" className="w-full h-full object-cover"/>
                                        </div>
                                    ) : previewData.error ? (
                                        <div className="flex flex-col items-center justify-center h-full w-full aspect-[3/4] bg-red-50 text-red-700 rounded-lg p-4 text-center">
                                        <p className="font-semibold">Oops! Gagal membuat preview.</p>
                                        <p className="text-sm mt-2">{previewData.error}</p>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {modals.lightbox && (
                <div id="lightbox" className="modal-backdrop show" onClick={() => setModals(p => ({...p, lightbox: null}))}>
                    <button id="lightbox-close-btn" className="close-lightbox" type="button" aria-label="Tutup lightbox">
                        <svg width="20" height="20" viewBox="0 0 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <img id="lightbox-image" src={modals.lightbox} alt="Enlarged view" onClick={e => e.stopPropagation()} />
                </div>
            )}
             {modals.download && (
                <div id="download-modal" className="modal-backdrop show">
                  <div className="modal-content w-full max-w-md">
                    <h3 className="text-lg font-bold text-slate-900">Pilih Format Download</h3>
                    <p className="text-slate-600 text-sm mt-2">Pilih aspek rasio untuk file ZIP Anda.</p>
                    <div className="mt-6 grid grid-cols-1 gap-3">
                      <button onClick={() => handleDownloadZip(3/4)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg">Portrait (3:4)</button>
                      <button onClick={() => handleDownloadZip(16/9)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 px-4 rounded-lg">Landscape (16:9)</button>
                      <button onClick={() => handleDownloadZip(1/1)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 px-4 rounded-lg">Square (1:1)</button>
                       <button onClick={() => handleDownloadZip()} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 px-4 rounded-lg">Original (Tanpa Crop)</button>
                    </div>
                    <button onClick={() => setModals(p => ({...p, download: false}))} className="mt-4 w-full text-sm text-slate-500 hover:text-slate-700">Batal</button>
                  </div>
                </div>
             )}
        </div>
    );
};

// Fix: Add default export to the component
export default MainApp;