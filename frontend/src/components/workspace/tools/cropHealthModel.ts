import { isAxiosError } from 'axios';
import { api, getErrorMessage, historyApi } from '../../../services/api.ts';
import type { PredictionRecord, PredictionResponse } from '../../../types/index.ts';

export type Crop = 'tomato' | 'rice';
export type Language = 'bn' | 'en';
export type ScanStatus = 'possible' | 'healthy' | 'uncertain';
export type CropGuide = {
  status: ScanStatus;
  summary: string;
  steps: string[];
  source_url: string;
  provider: 'guide' | 'gemini';
  gemini_available: boolean;
};

export const models: Record<Crop, string> = { tomato: 'tomato_disease_v3', rice: 'rice_disease' };
export const cropNames = { tomato: ['টমেটো', 'Tomato'], rice: ['ধান', 'Rice'] } as const;
const names: Record<string, [string, string]> = {
  Tomato___Bacterial_spot: ['ব্যাকটেরিয়াজনিত দাগ', 'Bacterial spot'],
  Tomato___Early_blight: ['আর্লি ব্লাইট', 'Early blight'],
  Tomato___Late_blight: ['লেট ব্লাইট', 'Late blight'],
  Tomato___Leaf_Mold: ['লিফ মোল্ড', 'Leaf mold'],
  Tomato___Septoria_leaf_spot: ['সেপ্টোরিয়া পাতার দাগ', 'Septoria leaf spot'],
  'Tomato___Spider_mites Two-spotted_spider_mite': ['মাকড়ের আক্রমণ', 'Spider mites'],
  Tomato___Tomato_Yellow_Leaf_Curl_Virus: ['পাতা কুঁকড়ানো ভাইরাসের লক্ষণ', 'Tomato yellow leaf curl'],
  Tomato___healthy: ['সুস্থ পাতার সঙ্গে মিল', 'Healthy-leaf match'],
  Healthy: ['সুস্থ পাতার সঙ্গে মিল', 'Healthy-leaf match'],
  Insect: ['পোকার আক্রমণের লক্ষণ', 'Insect damage'],
  'Leaf Scald': ['পাতা ঝলসানো', 'Leaf scald'],
  'Rice Blast': ['ধানের ব্লাস্ট', 'Rice blast'],
  'Rice Leaffolder': ['পাতা মোড়ানো পোকা', 'Rice leaffolder'],
  'Rice Stripes': ['ধানের পাতায় ডোরার লক্ষণ', 'Rice stripes'],
  'Rice Tungro': ['ধানের টুংরো', 'Rice tungro'],
};

export function labelName(label: string, language: Language) {
  return names[label]?.[language === 'bn' ? 0 : 1] ?? label.replace(/^Tomato___/, '').replace(/_/g, ' ');
}

type ClassMatch = { label: string; score: number };
type Uncertainty = 'missing_scores' | 'unmapped_label' | 'low_score' | 'close_scores';

function scoreValue(value: unknown): number | null {
  return typeof value === 'number' && value >= 0 && value <= 1 ? value : null;
}

export function confidenceInfo(prediction: unknown) {
  const result = (prediction && typeof prediction === 'object' ? prediction : {}) as Record<string, unknown>;
  const label = typeof result.predicted_class === 'string' ? result.predicted_class : '';
  const score = scoreValue(result.confidence);
  const distribution = result.class_probabilities;
  const ranking: ClassMatch[] = [];
  if (distribution && typeof distribution === 'object' && !Array.isArray(distribution)) {
    for (const [name, value] of Object.entries(distribution)) {
      const match = scoreValue(value);
      if (match != null) ranking.push({ label: name, score: match });
    }
    ranking.sort((a, b) => b.score - a.score);
  }
  const runnerUp = ranking.find(match => match.label !== label);
  let reason: Uncertainty | null = null;
  if (!label || score == null || !ranking.some(match => match.label === label) || !runnerUp) reason = 'missing_scores';
  else if (!Object.hasOwn(names, label)) reason = 'unmapped_label';
  else if (score - runnerUp.score < 0.14) reason = 'close_scores';
  else if (score < 0.72) reason = 'low_score';
  const status: ScanStatus = reason ? 'uncertain' : label.toLowerCase().endsWith('healthy') ? 'healthy' : 'possible';
  return { label, score, status, reason, ranking: ranking.slice(0, 2) };
}

export async function scanLeaf(crop: Crop, file: File, signal: AbortSignal) {
  const form = new FormData();
  form.append('image_file', file);
  const { data } = await api.post<PredictionResponse>(`/predict/${models[crop]}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000, signal,
  });
  if (data?.model_id !== models[crop] || !data.prediction || typeof data.prediction !== 'object') {
    throw new Error('Invalid prediction response');
  }
  return data;
}

export async function getCropGuide(id: number, language: Language, explain: boolean, signal: AbortSignal) {
  const { data } = await api.post<CropGuide>(`/predict/crop-health/${id}/summary`, { language, explain }, { signal, timeout: 8500 });
  if (typeof data?.summary !== 'string' || !Array.isArray(data.steps)) throw new Error('Invalid guide response');
  return data;
}

export async function scanHistory(): Promise<PredictionRecord[]> {
  const collections = await Promise.all(Object.values(models).map(model => historyApi.listHistory(30, model)));
  return collections.flat().sort((left, right) => right.id - left.id).slice(0, 60);
}

export function scanError(error: unknown, language: Language) {
  const bn = language === 'bn';
  if (isAxiosError(error)) {
    const code = error.response?.status;
    if (!code) return bn ? 'সার্ভারের সঙ্গে যোগাযোগ হয়নি। আবার চেষ্টা করুন।' : 'Could not reach the server. Try again.';
    if (code === 401 || code === 403) return bn ? 'আবার লগইন করে চেষ্টা করুন।' : 'Sign in again and retry.';
    if (code === 404) return bn ? 'সার্ভারে এই স্ক্যান সেবা পাওয়া যাচ্ছে না।' : 'This scan service is unavailable on the server.';
    if (code >= 500) return bn ? 'সার্ভার এখন ছবিটি বিশ্লেষণ করতে পারছে না। আবার চেষ্টা করুন।' : 'The server could not analyze the image. Try again later.';
    const message = getErrorMessage(error);
    if (!bn || /[\u0980-\u09ff]/.test(message)) return message;
  }
  return bn ? 'বিশ্লেষণ করা যায়নি। অন্য একটি পরিষ্কার ছবি দিয়ে চেষ্টা করুন।' : 'Could not analyze the leaf. Try another clear photo.';
}
