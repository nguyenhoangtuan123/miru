// API Configuration for different environments
const CONFIG = {
    // Detect environment
    getEnvironment() {
        const hostname = window.location.hostname;

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'development';
        } else if (hostname.includes('vercel.app')) {
            return 'vercel';
        } else if (hostname.includes('railway.app')) {
            return 'railway';
        } else if (hostname.includes('onrender.com')) {
            return 'render';
        }
        return 'production';
    },

    // Get API base URL
    getApiUrl() {
        const env = this.getEnvironment();

        switch (env) {
            case 'development':
                return 'http://localhost:8008';

            case 'render':
                // Legacy Render deployment (deprecated)
                return 'https://reflection-backend-twh1.onrender.com';

            case 'vercel':
                // When frontend is on Vercel, backend is on Railway
                return 'https://web-production-56fc05.up.railway.app';

            case 'railway':
                // When frontend is also on Railway
                return 'https://web-production-56fc05.up.railway.app';

            default:
                return 'http://localhost:8008';
        }
    },

    // Get WebSocket URL
    getWsUrl() {
        const apiUrl = this.getApiUrl();
        // Replace http/https with ws/wss
        return apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    }
};

// Export for use in other scripts
window.APP_CONFIG = CONFIG;

// Log current environment (for debugging)
console.log('🌍 Environment:', CONFIG.getEnvironment());
console.log('🔗 API URL:', CONFIG.getApiUrl());
console.log('🔌 WebSocket URL:', CONFIG.getWsUrl());
