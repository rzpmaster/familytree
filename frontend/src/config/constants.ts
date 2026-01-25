export interface AppConfig {
    apiBaseUrl: string;
    nodeWidth: number;
    nodeHeight: number;
    [key: string]: unknown;
}

// Default configuration
const defaultConfig: AppConfig = {
    apiBaseUrl: '/api',
    nodeWidth: 256,
    nodeHeight: 128
};

// Singleton to hold the config
let currentConfig: AppConfig = { ...defaultConfig };

export const loadConfig = async () => {
    try {
        const response = await fetch('/config.json');
        if (response.ok) {
            const config = await response.json();
            // Merge loaded config into currentConfig
            currentConfig = { ...currentConfig, ...config };
            console.log("Configuration loaded:", currentConfig);
            return currentConfig;
        }
    } catch (error) {
        console.error("Failed to load config.json", error);
    }
    return currentConfig;
};

export const getConfig = (): AppConfig => {
    return currentConfig;
};

// Helper getters for backward compatibility or ease of use
export const getApiBaseUrl = () => currentConfig.apiBaseUrl;
export const getNodeWidth = () => currentConfig.nodeWidth;
export const getNodeHeight = () => currentConfig.nodeHeight;
