// ============ SHARED CONFIG CONSTANTS ============
export const MONGO_URL = process.env.MONGO_URL;
export const DB_NAME = process.env.DB_NAME || 'careergpt';
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || OPENROUTER_API_KEY || process.env.EMERGENT_LLM_KEY;
export const LLM_BASE_URL = process.env.LLM_BASE_URL || (OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
export const JWT_SECRET = process.env.JWT_SECRET || 'careergpt-jwt-secret-2025';
