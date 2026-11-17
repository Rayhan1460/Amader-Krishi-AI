import axios, { type AxiosError } from 'axios';
import type {
  AuthResponse,
  HealthResponse,
  ModelMetadata,
  User,
  ChatSession,
  ChatProviderStatus,
  PredictionRecord,
  PredictionResponse,
} from '../types/index.ts';

const TOKEN_KEY = 'agrisphere_session_token';

// Use backend URL from environment or fallback to empty string for Vite proxy/reverse proxy
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  ''
).replace(/\/+$/, '');

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Attach Authorization header if session token exists
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Token helpers
export const tokenStorage = {
  get: (): string | null => sessionStorage.getItem(TOKEN_KEY),
  set: (token: string): void => sessionStorage.setItem(TOKEN_KEY, token),
  clear: (): void => sessionStorage.removeItem(TOKEN_KEY),
};

// Format API error messages safely and informatively
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: string | Array<{ msg: string; loc?: string[] }> }>;
    
    // 1. Structured backend detail message
    const detail = axiosError.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
    if (Array.isArray(detail)) {
      return detail.map((d) => d.msg).join(', ');
    }

    // 2. HTTP status code specific friendly messages
    const status = axiosError.response?.status;
    if (status === 400) {
      return 'Invalid request information. Please verify your details.';
    }
    if (status === 401) {
      return 'Invalid username or password.';
    }
    if (status === 403) {
      return 'Access denied. You do not have permission for this action.';
    }
    if (status === 404) {
      return 'The requested resource or service was not found.';
    }
    if (status === 409) {
      return 'Username or account already exists.';
    }
    if (status === 422) {
      return 'Input validation failed. Please check the entered data.';
    }
    if (status && status >= 500) {
      return 'Backend service temporarily unavailable. Please try again shortly.';
    }

    // 3. Network and connection failures
    if (axiosError.code === 'ECONNABORTED' || axiosError.message?.toLowerCase().includes('timeout')) {
      return 'Request timed out. Please check your network connection and try again.';
    }
    if (
      axiosError.code === 'ERR_NETWORK' ||
      !axiosError.response ||
      axiosError.message === 'Network Error'
    ) {
      return 'Cannot connect to server. Please verify the backend service is running and accessible on port 8000.';
    }

    if (axiosError.message) {
      return axiosError.message;
    }
  }

  if (error instanceof Error) {
    if (error.message === 'Network Error') {
      return 'Cannot connect to server. Please verify the backend service is running and accessible on port 8000.';
    }
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}

// Authentication API methods
export const authApi = {
  async register(payload: { username: string; password: string; email?: string }): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', payload);
    return response.data;
  },

  async login(payload: { username: string; password: string }): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', payload);
    return response.data;
  },

  async getMe(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },
};

// System & Model API methods
export const systemApi = {
  async getHealth(): Promise<HealthResponse> {
    const response = await api.get<HealthResponse>('/health');
    return response.data;
  },

  async listModels(): Promise<Record<string, ModelMetadata>> {
    const response = await api.get<Record<string, ModelMetadata>>('/models/');
    return response.data;
  },

  async getModelDetails(modelId: string): Promise<ModelMetadata> {
    const response = await api.get<ModelMetadata>(`/models/${modelId}`);
    return response.data;
  },
};

// Chat API methods
export const chatApi = {
  async getProviderStatus(): Promise<ChatProviderStatus> {
    const response = await api.get<ChatProviderStatus>('/chat/provider');
    return response.data;
  },

  async listSessions(): Promise<ChatSession[]> {
    const response = await api.get<ChatSession[]>('/chat/sessions');
    return response.data;
  },

  async createSession(title: string = 'Agricultural Consultation'): Promise<ChatSession> {
    const response = await api.post<ChatSession>('/chat/sessions', { title });
    return response.data;
  },

  async getSession(sessionId: number): Promise<ChatSession> {
    const response = await api.get<ChatSession>(`/chat/sessions/${sessionId}`);
    return response.data;
  },

  async postMessage(sessionId: number, content: string): Promise<ChatSession> {
    const response = await api.post<ChatSession>(`/chat/sessions/${sessionId}/messages`, { content });
    return response.data;
  },

  async deleteSession(sessionId: number): Promise<void> {
    await api.delete(`/chat/sessions/${sessionId}`);
  },
};

// Prediction API methods
export const predictionApi = {
  async predict(modelId: string, payload: Record<string, any>): Promise<PredictionResponse> {
    const response = await api.post<PredictionResponse>(`/predict/${modelId}`, payload);
    return response.data;
  },

  async predictImage(modelId: string, file: File): Promise<PredictionResponse> {
    const formData = new FormData();
    formData.append('image_file', file);
    const response = await api.post<PredictionResponse>(`/predict/${modelId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// History API methods
export const historyApi = {
  async listHistory(limit: number = 50, modelId?: string): Promise<PredictionRecord[]> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (modelId) {
      params.append('model_id', modelId);
    }
    const response = await api.get<PredictionRecord[]>(`/history/?${params.toString()}`);
    return response.data;
  },

  async getRecord(recordId: number): Promise<PredictionRecord> {
    const response = await api.get<PredictionRecord>(`/history/${recordId}`);
    return response.data;
  },

  async deleteRecord(recordId: number): Promise<void> {
    await api.delete(`/history/${recordId}`);
  },
};
