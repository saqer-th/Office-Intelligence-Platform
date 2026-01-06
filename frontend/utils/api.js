export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

if (!API_BASE_URL) {
    console.warn("NEXT_PUBLIC_API_URL is not defined. API calls may fail.");
}

/**
 * Helper to get the full API URL for a specific endpoint.
 * @param {string} endpoint - The API endpoint (e.g., '/offices').
 * @returns {string} The full URL.
 */
export const getApiUrl = (endpoint) => {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${API_BASE_URL}${path}`;
};
