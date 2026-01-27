export interface AppConfig {
  apiBaseUrl: string;
  nodeWidth: number;
  nodeHeight: number;
  compactNodeWidth: number;
  compactNodeHeight: number;
  [key: string]: unknown;
}

// Default configuration
const defaultConfig: AppConfig = {
  apiBaseUrl: "/api",
  nodeWidth: 256,
  nodeHeight: 138,
  compactNodeWidth: 100,
  compactNodeHeight: 300,
};

// Singleton to hold the config
let currentConfig: AppConfig = { ...defaultConfig };

export const loadConfig = async () => {
  try {
    const response = await fetch("/config.json");
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
export const getCompactNodeWidth = () => currentConfig.compactNodeWidth;
export const getCompactNodeHeight = () => currentConfig.compactNodeHeight;
