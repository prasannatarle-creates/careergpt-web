import OpenAI from 'openai';
import { OPENROUTER_API_KEY, OPENAI_API_KEY, LLM_BASE_URL } from './config.js';

// ============ LLM SETUP ============
export function getOpenAIClient() {
  const apiKey = OPENROUTER_API_KEY || OPENAI_API_KEY;
  const baseURL = LLM_BASE_URL;
  
  if (!apiKey) {
    console.warn('No API key provided. LLM features will not work.');
    return null;
  }
  
  return new OpenAI({ 
    apiKey,
    baseURL,
    defaultHeaders: OPENROUTER_API_KEY ? {
      'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
      'X-Title': 'CareerGPT'
    } : {}
  });
}

export function getModelStr(provider, model) {
  if (OPENROUTER_API_KEY) {
    const modelMap = {
      'gpt-4.1': 'openai/gpt-4.1',
      'gpt-4': 'openai/gpt-4.1',
      'claude-4-sonnet-20250514': 'anthropic/claude-sonnet-4',
      'gemini-2.5-flash': 'google/gemini-2.5-flash-preview',
      'grok-3-mini': 'x-ai/grok-3-mini',
      'sonar-pro': 'perplexity/sonar-pro'
    };
    return modelMap[model] || `${provider}/${model}`;
  }
  return `${provider}/${model}`;
}

export const ALL_MODELS = [
  { provider: 'openai', model: 'gpt-4.1', name: 'GPT-4.1', color: '#10a37f', guaranteed: true },
  { provider: 'anthropic', model: 'claude-4-sonnet-20250514', name: 'Claude 4 Sonnet', color: '#d97706', guaranteed: true },
  { provider: 'google', model: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', color: '#4285f4', guaranteed: true },
  { provider: 'x-ai', model: 'grok-3-mini', name: 'Grok 3 Mini', color: '#ef4444', guaranteed: false },
  { provider: 'perplexity', model: 'sonar-pro', name: 'Perplexity Sonar', color: '#22d3ee', guaranteed: false },
];
export const GUARANTEED_MODELS = ALL_MODELS.filter(m => m.guaranteed);
let modelRotationIndex = 0;

// Track which models have been verified working at runtime
export const modelHealth = {};
ALL_MODELS.forEach(m => { modelHealth[m.name] = { healthy: true, lastError: null, failCount: 0 }; });

export async function callModel(client, modelStr, messages, maxTokens = 3000, temperature = 0.7) {
  try {
    const response = await client.chat.completions.create({
      model: modelStr, messages, max_tokens: maxTokens, temperature,
    });
    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error(`Model ${modelStr} error:`, error.message);
    return null;
  }
}

export async function callMultiModel(systemPrompt, userMessage, activeModelNames = null, maxTokens = 3000) {
  const client = getOpenAIClient();
  let modelsToUse = activeModelNames
    ? ALL_MODELS.filter(m => activeModelNames.includes(m.name))
    : ALL_MODELS;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  // Query ALL requested models in parallel with per-model timeouts
  const modelPromises = modelsToUse.map(async (m) => {
    const start = Date.now();
    const timeoutMs = m.guaranteed ? 20000 : 12000;
    try {
      const health = modelHealth[m.name];
      if (health.failCount >= 3 && health.lastError && (Date.now() - health.lastError < 300000)) {
        return { name: m.name, color: m.color, response: null, duration: 0, success: false, skipped: true };
      }
      const modelStr = getModelStr(m.provider, m.model);
      const modelPromise = callModel(client, modelStr, messages, maxTokens);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Model timeout')), timeoutMs)
      );
      const response = await Promise.race([modelPromise, timeoutPromise]);
      if (response) { modelHealth[m.name].failCount = 0; modelHealth[m.name].healthy = true; }
      return { name: m.name, color: m.color, response, duration: Date.now() - start, success: !!response };
    } catch (e) {
      console.warn(`Model ${m.name} failed:`, e.message);
      modelHealth[m.name].failCount++;
      modelHealth[m.name].lastError = Date.now();
      modelHealth[m.name].healthy = false;
      return { name: m.name, color: m.color, response: null, duration: Date.now() - start, success: false };
    }
  });

  const results = await Promise.all(modelPromises);
  console.log(`[callMultiModel] ${results.filter(r => r.success).length}/${results.length} models responded: ${results.filter(r => r.success).map(r => r.name).join(', ')}`);

  let valid = results.filter(r => r.response);
  const failed = results.filter(r => !r.response);

  // MINIMUM 4 MODELS REQUIRED: If fewer than 4 responded, retry failed models once
  const MIN_MODELS = Math.min(4, modelsToUse.length);
  if (valid.length < MIN_MODELS && failed.length > 0) {
    console.log(`[callMultiModel] Only ${valid.length} models responded, need ${MIN_MODELS}. Retrying ${failed.length} failed models...`);
    const retryPromises = failed.map(async (f) => {
      const mInfo = modelsToUse.find(m => m.name === f.name);
      if (!mInfo) return f;
      const start = Date.now();
      try {
        const modelStr = getModelStr(mInfo.provider, mInfo.model);
        const response = await Promise.race([
          callModel(client, modelStr, messages, maxTokens),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Retry timeout')), 25000))
        ]);
        if (response) {
          modelHealth[mInfo.name].failCount = 0;
          modelHealth[mInfo.name].healthy = true;
          return { name: mInfo.name, color: mInfo.color, response, duration: Date.now() - start, success: true };
        }
        return f;
      } catch (e) {
        console.warn(`[callMultiModel] Retry ${mInfo.name} failed:`, e.message);
        return f;
      }
    });
    const retryResults = await Promise.all(retryPromises);
    const retryValid = retryResults.filter(r => r.success && r.response);
    valid = [...valid, ...retryValid];
    console.log(`[callMultiModel] After retry: ${valid.length} models total`);
  }

  if (valid.length === 0) throw new Error('All models failed');
  if (valid.length < MIN_MODELS) {
    console.warn(`[callMultiModel] WARNING: Only ${valid.length}/${MIN_MODELS} models responded (below minimum)`);
  }

  let combinedResponse = valid[0].response;
  let synthesized = false;

  if (valid.length > 1) {
    const synthPrompt = `You are given ${valid.length} independent expert responses to the same question. Your job is to synthesize them into ONE comprehensive, factually accurate response.

RULES:
- Cross-reference facts between responses — only include information confirmed by multiple sources
- If responses conflict, go with the majority or flag the uncertainty
- NEVER invent new information not present in any source response
- Remove any fake URLs, made-up statistics, or hallucinated company names
- Use real, well-known platforms (LinkedIn, Coursera, Udemy, Glassdoor, Indeed, etc.)
- Output markdown format only

Responses to synthesize:

${valid.map(r => `--- ${r.name} ---\n${r.response}`).join('\n\n')}`;
    const fastestValid = [...valid].sort((a, b) => a.duration - b.duration)[0];
    const synthModelInfo = modelsToUse.find(m => m.name === fastestValid.name) || modelsToUse[0];
    const synthModel = getModelStr(synthModelInfo.provider, synthModelInfo.model);
    const synthResult = await callModel(client, synthModel, [
      { role: 'system', content: 'You are a fact-checking synthesis engine. Combine multiple AI responses into one accurate, unified response. Strip out any hallucinated data, fake URLs, or invented statistics. Only include verifiable, factual information. Output markdown.' },
      { role: 'user', content: synthPrompt },
    ]);
    if (synthResult) { combinedResponse = synthResult; synthesized = true; }
  }

  return { combinedResponse, modelResponses: valid, failedModels: results.filter(r => !r.response).map(r => ({ name: r.name })), synthesized, successCount: valid.length, totalModels: modelsToUse.length };
}

export async function callSingleModel(systemPrompt, userMessage, maxTokens = 3000, temperature = 0.7) {
  const client = getOpenAIClient();
  let model = null;
  let attempts = 0;
  while (attempts < ALL_MODELS.length) {
    const candidate = ALL_MODELS[modelRotationIndex % ALL_MODELS.length];
    modelRotationIndex++;
    attempts++;
    const health = modelHealth[candidate.name];
    if (health.failCount >= 3 && health.lastError && (Date.now() - health.lastError < 300000)) {
      console.log(`[callSingleModel] Skipping ${candidate.name} (${health.failCount} consecutive failures)`);
      continue;
    }
    model = candidate;
    break;
  }
  if (!model) model = ALL_MODELS[0];
  
  const modelStr = getModelStr(model.provider, model.model);
  console.log(`[callSingleModel] Using ${model.name} (rotation #${modelRotationIndex})`);
  
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];
  
  const timeoutMs = model.guaranteed ? 20000 : 12000;
  try {
    const resultPromise = callModel(client, modelStr, messages, maxTokens, temperature);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`${model.name} timeout (${timeoutMs}ms)`)), timeoutMs));
    const result = await Promise.race([resultPromise, timeoutPromise]);
    
    if (result) {
      modelHealth[model.name].failCount = 0;
      modelHealth[model.name].healthy = true;
      return result;
    }
  } catch (e) {
    console.warn(`[callSingleModel] ${model.name} failed: ${e.message}`);
    modelHealth[model.name].failCount++;
    modelHealth[model.name].lastError = Date.now();
    modelHealth[model.name].healthy = false;
  }
  
  // Fallback to GPT-4.1 if chosen model failed
  if (model.model !== 'gpt-4.1') {
    console.warn(`[callSingleModel] Falling back to GPT-4.1`);
    const fallbackStr = getModelStr('openai', 'gpt-4.1');
    return await callModel(client, fallbackStr, messages, maxTokens, temperature);
  }
  return null;
}
