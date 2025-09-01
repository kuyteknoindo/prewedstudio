// Debug script untuk memeriksa API key management
console.log('=== API Key Debug Information ===');

// Simulasi pengecekan API key dari localStorage
const checkLocalStorage = () => {
    try {
        const keys = localStorage.getItem('gemini_api_keys');
        console.log('API Keys in localStorage:', keys);
        
        if (keys) {
            const parsedKeys = JSON.parse(keys);
            console.log('Parsed API Keys:', parsedKeys);
            console.log('Number of keys:', parsedKeys.length);
            
            parsedKeys.forEach((key, index) => {
                console.log(`Key ${index + 1}:`, {
                    id: key.id,
                    masked: key.masked,
                    status: key.status,
                    hasValue: !!key.value
                });
            });
        } else {
            console.log('No API keys found in localStorage');
        }
    } catch (error) {
        console.error('Error checking localStorage:', error);
    }
};

// Simulasi pengecekan environment variables
const checkEnvVars = () => {
    console.log('Environment variables:');
    console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Set' : 'Not set');
    console.log('API_KEY:', process.env.API_KEY ? 'Set' : 'Not set');
};

checkLocalStorage();
checkEnvVars();

// Simulasi test API key
const testApiKey = async (apiKey) => {
    try {
        console.log(`Testing API key: ${apiKey.substring(0, 10)}...`);
        
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: 'Hello' }]
                }]
            })
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            const errorData = await response.json();
            console.log('Error response:', errorData);
            
            if (response.status === 429) {
                console.log('❌ API Key EXHAUSTED - Quota exceeded');
                return 'exhausted';
            } else if (response.status === 400 && errorData.error?.message?.includes('API key not valid')) {
                console.log('❌ API Key INVALID');
                return 'invalid';
            } else {
                console.log('❌ Other error:', errorData);
                return 'invalid';
            }
        } else {
            console.log('✅ API Key ACTIVE');
            return 'active';
        }
    } catch (error) {
        console.log('❌ Network or other error:', error);
        return 'invalid';
    }
};

// Export untuk digunakan di console browser
window.debugApiKey = testApiKey;
window.checkApiKeys = checkLocalStorage;

console.log('=== Debug functions available ===');
console.log('- window.debugApiKey(apiKey) - Test specific API key');
console.log('- window.checkApiKeys() - Check stored API keys');