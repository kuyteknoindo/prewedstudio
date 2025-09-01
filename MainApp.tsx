import React, { useState, useEffect, useRef } from 'react';
import { 
    photographicStyles, emotionalCues, maleDirectionCues, femaleDirectionCues, 
    coupleInteractionCues, positionCues, lightingMoodCues, propEnvironmentCues, 
    storyScenes, cameraTechniques, culturalThemes, emotionBoosters, groupInteractions, 
    postProcessingFilters, motionActivities, dynamicPoses, creativeAngles, 
    emotionalExpressions, actionInteractions, negativePromptOptions, maleClothing, 
    malePants, femaleClothingOptions, accessories 
} from './creativeData';
import { shuffleArray, generateRandomFilename, cropImageToAspectRatio } from './utils';
import { generateImage, generateConsistentCoupleDescription, generateLocationBasedScenarios, validateApiKey } from './services/geminiService';
import { GeneratedImage, ModalState, ReferenceFile, ActiveTab, ApiKey, ApiKeyStatus } from './types';
import ApiKeyDebug from './components/ApiKeyDebug';

const MainApp: React.FC = () => {
    // State management
    const [userPrompt, setUserPrompt] = useState('');
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [numberOfImages, setNumberOfImages] = useState(4);
    const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash-image-preview');
    const [modalState, setModalState] = useState<ModalState>({
        error: null,
        download: false,
        lightbox: null
    });
    const [referenceFile, setReferenceFile] = useState<ReferenceFile | null>(null);
    const [activeTab, setActiveTab] = useState<ActiveTab>('prompt');
    const [userApiKeys, setUserApiKeys] = useState<ApiKey[]>([]);
    const [showApiKeyModal, setShowApiKeyModal] = useState(false);
    const [newApiKey, setNewApiKey] = useState('');
    const [showTutorialModal, setShowTutorialModal] = useState(false);
    const [showDebugModal, setShowDebugModal] = useState(false);
    const [selectedNegativePrompts, setSelectedNegativePrompts] = useState<string[]>([]);
    const [customNegativePrompt, setCustomNegativePrompt] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load API keys from localStorage on component mount
    useEffect(() => {
        const storedKeys = localStorage.getItem('ai_photographer_api_keys');
        if (storedKeys) {
            try {
                const parsedKeys = JSON.parse(storedKeys);
                setUserApiKeys(parsedKeys || []);
            } catch (error) {
                console.error('Error parsing stored API keys:', error);
                setUserApiKeys([]);
            }
        }
    }, []);

    // Generic API call wrapper with error handling
    const performApiCall = async <T,>(
        apiCall: () => Promise<T>,
        errorMessage: string
    ): Promise<T> => {
        try {
            return await apiCall();
        } catch (error) {
            console.error(`${errorMessage}:`, error);
            const message = error instanceof Error ? error.message : String(error);
            setModalState(prev => ({ ...prev, error: `${errorMessage}: ${message}` }));
            throw error;
        }
    };

    // Add new API key
    const addApiKey = async () => {
        if (!newApiKey.trim()) return;

        const newKey: ApiKey = {
            id: `key_${Date.now()}`,
            value: newApiKey.trim(),
            masked: `${newApiKey.slice(0, 4)}...${newApiKey.slice(-4)}`,
            status: 'unvalidated'
        };

        const updatedKeys = [...userApiKeys, newKey];
        setUserApiKeys(updatedKeys);
        localStorage.setItem('ai_photographer_api_keys', JSON.stringify(updatedKeys));
        setNewApiKey('');
        setShowApiKeyModal(false);

        // Validate the new key
        try {
            const status = await validateApiKey(newKey.value);
            updateApiKeyStatus(newKey.id, status);
        } catch (error) {
            console.error('Error validating new API key:', error);
        }
    };

    // Update API key status
    const updateApiKeyStatus = (keyId: string, status: ApiKeyStatus) => {
        const updatedKeys = userApiKeys.map(key => 
            key.id === keyId ? { ...key, status } : key
        );
        setUserApiKeys([...updatedKeys]);
        localStorage.setItem('ai_photographer_api_keys', JSON.stringify(updatedKeys));
    };

    // Remove API key
    const removeApiKey = (keyId: string) => {
        const updatedKeys = userApiKeys.filter(key => key.id !== keyId);
        setUserApiKeys(updatedKeys);
        localStorage.setItem('ai_photographer_api_keys', JSON.stringify(updatedKeys));
    };

    // Validate all API keys
    const validateAllApiKeys = async () => {
        for (const key of userApiKeys) {
            try {
                const status = await validateApiKey(key.value);
                updateApiKeyStatus(key.id, status);
            } catch (error) {
                console.error(`Error validating key ${key.id}:`, error);
                updateApiKeyStatus(key.id, 'invalid');
            }
        }
    };

    // Get active API key
    const getActiveApiKey = (): ApiKey | null => {
        // First try to find an active key
        let activeKey = userApiKeys.find(key => key.status === 'active');
        
        if (!activeKey) {
            // If no active key, try to find any key that might work
            activeKey = userApiKeys.find(key => key.status !== 'invalid');
        }
        
        return activeKey || null;
    };

    // Handle reference file upload
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setModalState(prev => ({ ...prev, error: 'Please select a valid image file.' }));
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            if (result) {
                const base64Data = result.split(',')[1];
                setReferenceFile({
                    base64: base64Data,
                    mimeType: file.type
                });
            }
        };
        reader.readAsDataURL(file);
    };

    // Remove reference file
    const removeReferenceFile = () => {
        setReferenceFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Toggle negative prompt selection
    const toggleNegativePrompt = (prompt: string) => {
        setSelectedNegativePrompts(prev => 
            prev.includes(prompt) 
                ? prev.filter(p => p !== prompt)
                : [...prev, prompt]
        );
    };

    // Remove selected negative prompt
    const removeNegativePrompt = (prompt: string) => {
        setSelectedNegativePrompts(prev => prev.filter(p => p !== prompt));
    };

    // Add custom negative prompt
    const addCustomNegativePrompt = () => {
        if (customNegativePrompt.trim() && !selectedNegativePrompts.includes(customNegativePrompt.trim())) {
            setSelectedNegativePrompts(prev => [...prev, customNegativePrompt.trim()]);
            setCustomNegativePrompt('');
        }
    };

    // Main generation function
    const runGeneration = async () => {
        if (!userPrompt.trim()) {
            setModalState(prev => ({ ...prev, error: 'Please enter a description for your photoshoot.' }));
            return;
        }

        // Check for active API key
        const activeKey = getActiveApiKey();
        if (!activeKey) {
            setModalState(prev => ({ 
                ...prev, 
                error: 'No active API key found. Please add a valid Gemini API key in the settings.' 
            }));
            return;
        }

        setIsGenerating(true);
        setGeneratedImages([]);

        try {
            // Generate consistent couple description
            const coupleDescription = await performApiCall(
                () => generateConsistentCoupleDescription(activeKey.value, userPrompt),
                'Failed to generate couple description'
            );

            // Generate location-based scenarios
            const locationTheme = userPrompt.includes('Bromo') ? 'Bromo' : 
                                 userPrompt.includes('Paris') ? 'Paris' : 'romantic location';
            
            const scenarios = await performApiCall(
                () => generateLocationBasedScenarios(activeKey.value, locationTheme, numberOfImages),
                'Failed to generate scenarios'
            );

            // Generate images
            const imagePromises = scenarios.map(async (scenario, index) => {
                const creativeElements = [
                    shuffleArray(photographicStyles)[0],
                    shuffleArray(emotionalCues)[0],
                    shuffleArray(maleDirectionCues)[0],
                    shuffleArray(femaleDirectionCues)[0],
                    shuffleArray(coupleInteractionCues)[0],
                    shuffleArray(positionCues)[0],
                    shuffleArray(lightingMoodCues)[0],
                    shuffleArray(propEnvironmentCues)[0],
                    shuffleArray(storyScenes)[0],
                    shuffleArray(cameraTechniques)[0]
                ];

                const maleClothingItem = shuffleArray(maleClothing)[0];
                const malePantsItem = shuffleArray(malePants)[0];
                const femaleClothingItem = shuffleArray(femaleClothingOptions)[0];
                const accessoryItem = shuffleArray(accessories)[0];

                const negativePrompt = selectedNegativePrompts.length > 0 
                    ? selectedNegativePrompts.join(', ')
                    : negativePromptOptions.slice(0, 3).join(', ');

                const finalPrompt = `${coupleDescription}. ${scenario.scene}. ${scenario.emotion}. 
                    The man is wearing ${maleClothingItem} and ${malePantsItem}. 
                    ${femaleClothingItem.style} ${femaleClothingItem.clothing} ${femaleClothingItem.bottom}. 
                    Both are wearing ${accessoryItem}. 
                    ${creativeElements.join('. ')}. 
                    Professional photography, high quality, detailed, realistic.
                    Negative prompt: ${negativePrompt}`;

                try {
                    const imageUrl = await generateImage(
                        activeKey.value,
                        finalPrompt,
                        selectedModel,
                        referenceFile?.base64,
                        referenceFile?.mimeType
                    );

                    return {
                        id: `img_${Date.now()}_${index}`,
                        url: imageUrl
                    };
                } catch (error) {
                    console.error(`Error generating image ${index + 1}:`, error);
                    throw error;
                }
            });

            const results = await Promise.all(imagePromises);
            setGeneratedImages(results);

        } catch (error) {
            console.error('Generation failed:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    // Download single image
    const downloadImage = async (imageUrl: string, filename?: string) => {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename || generateRandomFilename();
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading image:', error);
            setModalState(prev => ({ ...prev, error: 'Failed to download image.' }));
        }
    };

    // Download all images as ZIP
    const downloadAllImages = async () => {
        if (generatedImages.length === 0) return;

        setModalState(prev => ({ ...prev, download: true }));

        try {
            const JSZip = (window as any).JSZip;
            const zip = new JSZip();

            for (let i = 0; i < generatedImages.length; i++) {
                const image = generatedImages[i];
                const response = await fetch(image.url);
                const blob = await response.blob();
                const filename = generateRandomFilename(`prewedding_${i + 1}`);
                zip.file(filename, blob);
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const { saveAs } = (window as any);
            saveAs(zipBlob, `prewedding_photos_${Date.now()}.zip`);

        } catch (error) {
            console.error('Error creating ZIP file:', error);
            setModalState(prev => ({ ...prev, error: 'Failed to download images as ZIP.' }));
        } finally {
            setModalState(prev => ({ ...prev, download: false }));
        }
    };

    // Open lightbox
    const openLightbox = (imageUrl: string) => {
        setModalState(prev => ({ ...prev, lightbox: imageUrl }));
    };

    // Close modals
    const closeModal = (type: keyof ModalState) => {
        setModalState(prev => ({ ...prev, [type]: type === 'lightbox' ? null : false }));
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                                <span className="text-white font-bold text-lg">📸</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">AI Prewedding Photographer</h1>
                                <p className="text-sm text-slate-600">Generate stunning pre-wedding photos with AI</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={() => setShowTutorialModal(true)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Tutorial
                            </button>
                            <button
                                onClick={() => setShowApiKeyModal(true)}
                                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg transition-colors"
                            >
                                Kelola API Keys
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Panel - Input Controls */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* API Key Status */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">API Key Status</h3>
                            {userApiKeys.length === 0 ? (
                                <div className="text-center py-4">
                                    <p className="text-slate-600 mb-3">No API keys configured</p>
                                    <button
                                        onClick={() => setShowApiKeyModal(true)}
                                        className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                                    >
                                        Add API Key
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {userApiKeys.map(key => (
                                        <div key={key.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                            <div className="flex items-center space-x-3">
                                                <div className={`w-3 h-3 rounded-full ${
                                                    key.status === 'active' ? 'bg-green-500' :
                                                    key.status === 'exhausted' ? 'bg-yellow-500' :
                                                    key.status === 'invalid' ? 'bg-red-500' :
                                                    'bg-gray-400'
                                                }`}></div>
                                                <span className="text-sm font-mono text-slate-700">{key.masked}</span>
                                                <span className={`text-xs px-2 py-1 rounded-full ${
                                                    key.status === 'active' ? 'bg-green-100 text-green-800' :
                                                    key.status === 'exhausted' ? 'bg-yellow-100 text-yellow-800' :
                                                    key.status === 'invalid' ? 'bg-red-100 text-red-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {key.status}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => removeApiKey(key.id)}
                                                className="text-red-500 hover:text-red-700 text-sm"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                    <div className="flex space-x-2 mt-4">
                                        <button
                                            onClick={validateAllApiKeys}
                                            className="flex-1 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                        >
                                            Validate All
                                        </button>
                                        <button
                                            onClick={() => setShowDebugModal(true)}
                                            className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                        >
                                            Debug
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input Tabs */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="flex border-b border-slate-200">
                                <button
                                    onClick={() => setActiveTab('prompt')}
                                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                                        activeTab === 'prompt'
                                            ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                                            : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                                    }`}
                                >
                                    Teks Prompt
                                </button>
                                <button
                                    onClick={() => setActiveTab('reference')}
                                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                                        activeTab === 'reference'
                                            ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                                            : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                                    }`}
                                >
                                    Foto Referensi
                                </button>
                            </div>

                            <div className="p-6">
                                {activeTab === 'prompt' ? (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Describe your dream photoshoot
                                            </label>
                                            <textarea
                                                value={userPrompt}
                                                onChange={(e) => setUserPrompt(e.target.value)}
                                                placeholder="e.g., A romantic couple in traditional Indonesian wedding attire at Mount Bromo during sunrise, with warm golden lighting and traditional Javanese elements..."
                                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                                                rows={6}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Upload Reference Image
                                            </label>
                                            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                                                {referenceFile ? (
                                                    <div className="space-y-3">
                                                        <img
                                                            src={`data:${referenceFile.mimeType};base64,${referenceFile.base64}`}
                                                            alt="Reference"
                                                            className="max-w-full h-32 object-cover mx-auto rounded-lg"
                                                        />
                                                        <button
                                                            onClick={removeReferenceFile}
                                                            className="text-red-500 hover:text-red-700 text-sm"
                                                        >
                                                            Remove Image
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <input
                                                            ref={fileInputRef}
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={handleFileUpload}
                                                            className="hidden"
                                                        />
                                                        <button
                                                            onClick={() => fileInputRef.current?.click()}
                                                            className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                                                        >
                                                            Choose Image
                                                        </button>
                                                        <p className="text-xs text-slate-500 mt-2">
                                                            Upload a reference image to guide the AI generation
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Settings */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">Settings</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Number of Images: {numberOfImages}
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="8"
                                        value={numberOfImages}
                                        onChange={(e) => setNumberOfImages(parseInt(e.target.value))}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer slider"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        AI Model
                                    </label>
                                    <select
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    >
                                        <option value="gemini-2.5-flash-image-preview">Gemini 2.5 Flash Image</option>
                                        <option value="imagen-4.0-generate-001">Imagen 4.0</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Negative Prompts */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">Negative Prompts</h3>
                            
                            {/* Selected negative prompts */}
                            {selectedNegativePrompts.length > 0 && (
                                <div className="mb-4">
                                    <p className="text-sm font-medium text-slate-700 mb-2">Selected:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedNegativePrompts.map(prompt => (
                                            <span key={prompt} className="selected-negative-tag">
                                                {prompt}
                                                <button onClick={() => removeNegativePrompt(prompt)}>×</button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Available negative prompts */}
                            <div className="mb-4">
                                <p className="text-sm font-medium text-slate-700 mb-2">Available:</p>
                                <div className="flex flex-wrap gap-2">
                                    {negativePromptOptions.map(prompt => (
                                        <span
                                            key={prompt}
                                            onClick={() => toggleNegativePrompt(prompt)}
                                            className={`negative-tag ${selectedNegativePrompts.includes(prompt) ? 'selected' : ''}`}
                                        >
                                            {prompt}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Custom negative prompt */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={customNegativePrompt}
                                    onChange={(e) => setCustomNegativePrompt(e.target.value)}
                                    placeholder="Add custom negative prompt..."
                                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    onKeyPress={(e) => e.key === 'Enter' && addCustomNegativePrompt()}
                                />
                                <button
                                    onClick={addCustomNegativePrompt}
                                    className="px-3 py-2 text-sm font-medium text-white bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors"
                                >
                                    Add
                                </button>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={runGeneration}
                            disabled={isGenerating || !userPrompt.trim() || userApiKeys.filter(key => key.status === 'active').length === 0}
                            className="w-full px-6 py-4 text-lg font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed rounded-xl transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100"
                        >
                            {isGenerating ? (
                                <div className="flex items-center justify-center space-x-3">
                                    <div className="loader"></div>
                                    <span>Generating Photos...</span>
                                </div>
                            ) : (
                                'Generate Photos'
                            )}
                        </button>
                    </div>

                    {/* Right Panel - Results */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold text-slate-800">Generated Photos</h2>
                                {generatedImages.length > 0 && (
                                    <button
                                        onClick={downloadAllImages}
                                        className="px-4 py-2 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
                                    >
                                        Download All
                                    </button>
                                )}
                            </div>

                            {generatedImages.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-24 h-24 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                                        <span className="text-4xl">📸</span>
                                    </div>
                                    <h3 className="text-lg font-medium text-slate-800 mb-2">No photos generated yet</h3>
                                    <p className="text-slate-600">
                                        {userApiKeys.filter(key => key.status === 'active').length === 0 
                                            ? 'Add a valid API key and describe your photoshoot to get started'
                                            : 'Describe your dream photoshoot and click "Generate Photos"'
                                        }
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {generatedImages.map((image) => (
                                        <div key={image.id} className="group relative bg-slate-50 rounded-lg overflow-hidden">
                                            <img
                                                src={image.url}
                                                alt="Generated prewedding photo"
                                                className="w-full aspect-3-5 object-cover cursor-pointer transition-transform duration-200 group-hover:scale-105"
                                                onClick={() => openLightbox(image.url)}
                                            />
                                            <div className="image-card-overlay">
                                                <button
                                                    onClick={() => downloadImage(image.url)}
                                                    className="p-2 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full transition-all duration-200"
                                                    title="Download image"
                                                >
                                                    <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* API Key Management Modal */}
            {showApiKeyModal && (
                <div className="modal-backdrop show">
                    <div className="modal-content max-w-md w-full mx-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-slate-800">Kelola API Keys</h2>
                            <button 
                                onClick={() => setShowApiKeyModal(false)}
                                className="text-slate-500 hover:text-slate-700 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Tambah API Key Baru
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newApiKey}
                                        onChange={(e) => setNewApiKey(e.target.value)}
                                        placeholder="Masukkan Gemini API key..."
                                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    />
                                    <button
                                        onClick={addApiKey}
                                        disabled={!newApiKey.trim()}
                                        className="px-4 py-2 text-sm font-medium text-white bg-purple-500 hover:bg-purple-600 disabled:bg-slate-400 rounded-lg transition-colors"
                                    >
                                        Tambah
                                    </button>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-slate-700 mb-2">API Keys Tersimpan</h3>
                                {userApiKeys.length === 0 ? (
                                    <p className="text-sm text-slate-500 py-4 text-center">Belum ada API key tersimpan</p>
                                ) : (
                                    <div className="space-y-2">
                                        {userApiKeys.map(key => (
                                            <div key={key.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                                <div className="flex items-center space-x-3">
                                                    <span className="text-sm font-mono text-slate-700">{key.masked}</span>
                                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                                        key.status === 'active' ? 'bg-green-100 text-green-800' :
                                                        key.status === 'exhausted' ? 'bg-yellow-100 text-yellow-800' :
                                                        key.status === 'invalid' ? 'bg-red-100 text-red-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {key.status}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => removeApiKey(key.id)}
                                                    className="text-red-500 hover:text-red-700 text-sm"
                                                >
                                                    Hapus
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-slate-200">
                                <button
                                    onClick={() => setShowTutorialModal(true)}
                                    className="text-sm text-purple-600 hover:text-purple-700"
                                >
                                    Cara mendapatkan Gemini API Key
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tutorial Modal */}
            {showTutorialModal && (
                <div className="modal-backdrop show">
                    <div className="modal-content max-w-2xl w-full mx-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-slate-800">Cara Mendapatkan Gemini API Key</h2>
                            <button 
                                onClick={() => setShowTutorialModal(false)}
                                className="text-slate-500 hover:text-slate-700 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="space-y-4 text-sm text-slate-700">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h3 className="font-semibold text-blue-800 mb-2">📋 Langkah-langkah:</h3>
                                <ol className="list-decimal list-inside space-y-2">
                                    <li>Buka <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a></li>
                                    <li>Login dengan akun Google Anda</li>
                                    <li>Klik "Create API Key"</li>
                                    <li>Pilih project atau buat project baru</li>
                                    <li>Copy API key yang dihasilkan</li>
                                    <li>Paste API key ke aplikasi ini</li>
                                </ol>
                            </div>

                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Penting:</h3>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>API key gratis memiliki limit harian</li>
                                    <li>Jangan bagikan API key ke orang lain</li>
                                    <li>Simpan API key di tempat yang aman</li>
                                    <li>Untuk penggunaan intensif, pertimbangkan upgrade ke plan berbayar</li>
                                </ul>
                            </div>

                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <h3 className="font-semibold text-green-800 mb-2">✅ Tips:</h3>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Anda bisa menambahkan beberapa API key sebagai backup</li>
                                    <li>Aplikasi akan otomatis beralih ke API key lain jika satu habis</li>
                                    <li>Gunakan fitur Debug untuk test API key sebelum digunakan</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Debug Modal */}
            {showDebugModal && (
                <ApiKeyDebug 
                    userApiKeys={userApiKeys}
                    onClose={() => setShowDebugModal(false)}
                />
            )}

            {/* Error Modal */}
            {modalState.error && (
                <div className="modal-backdrop show">
                    <div className="modal-content max-w-md w-full mx-4">
                        <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
                        <p className="text-slate-700 mb-6">{modalState.error}</p>
                        <button
                            onClick={() => closeModal('error')}
                            className="w-full px-4 py-2 text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            )}

            {/* Download Modal */}
            {modalState.download && (
                <div className="modal-backdrop show">
                    <div className="modal-content max-w-md w-full mx-4 text-center">
                        <div className="loader mx-auto mb-4"></div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Preparing Download</h2>
                        <p className="text-slate-600">Creating ZIP file with all images...</p>
                    </div>
                </div>
            )}

            {/* Lightbox Modal */}
            {modalState.lightbox && (
                <div id="lightbox" className="modal-backdrop show" onClick={() => closeModal('lightbox')}>
                    <button className="close-lightbox" onClick={() => closeModal('lightbox')}>×</button>
                    <img
                        id="lightbox-image"
                        src={modalState.lightbox}
                        alt="Full size preview"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
};

export default MainApp;