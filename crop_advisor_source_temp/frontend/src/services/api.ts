import axios, { type AxiosError } from 'axios';
import type {
  AuthResponse,
  AuthConfigResponse,
  HealthResponse,
  ModelMetadata,
  User,
  ChatSession,
  ChatProviderStatus,
  PredictionRecord,
  PredictionResponse,
  FarmProfile,
  FarmCreatePayload,
  FarmUpdatePayload,
  FarmCrop,
  CropCreatePayload,
  CropUpdatePayload,
  CalendarTask,
  TaskCreatePayload,
  TaskUpdatePayload,
  TaskReschedulePatchPayload,
  CalendarSummary,
  BDDivisionsMap,
  CropScheduleTemplate,
  ScheduleGeneratePayload,
  ScheduleGenerateResult,
  ScheduleConfirmPayload,
  ScheduleConfirmResult,
  CropScheduleInstance,
  FarmWeatherForecastResponse,
  CurrentWeatherSummary,
  FarmCalendarAdvisoriesResponse,
  WeatherProviderStatusResponse,
  ReminderListResponse,
  FarmOverviewResponse,
  SoilTest,
  SoilTestCreatePayload,
  SoilTestUpdatePayload,
  CropRecommendationModelInputSchema,
  ModelReadinessAssessment,
  FarmCropRecommendationRequest,
  FarmCropRecommendationResponse,
  CultivationActivity,
  CultivationActivityCreatePayload,
  CultivationActivityUpdatePayload,
  CropObservation,
  CropObservationCreatePayload,
  CropObservationUpdatePayload,
  CropDiseaseModelSupport,
  HarvestRecord,
  HarvestRecordCreatePayload,
  HarvestRecordUpdatePayload,
  HarvestSummaryResponse,
  FarmUnifiedIntelligenceResponse,
  FarmActionsResponse,
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

  async loginWithGoogle(credential: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/google', { credential });
    return response.data;
  },

  async loginAsDemo(): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/demo');
    return response.data;
  },

  async getAuthConfig(): Promise<AuthConfigResponse> {
    const response = await api.get<AuthConfigResponse>('/auth/config');
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

// =============================================================================
// PHASE F4A: FARM PROFILES API METHODS
// =============================================================================
export const farmApi = {
  async listFarms(): Promise<FarmProfile[]> {
    const response = await api.get<FarmProfile[]>('/farms');
    return response.data;
  },

  async createFarm(payload: FarmCreatePayload): Promise<FarmProfile> {
    const response = await api.post<FarmProfile>('/farms', payload);
    return response.data;
  },

  async getFarm(farmId: number): Promise<FarmProfile> {
    const response = await api.get<FarmProfile>(`/farms/${farmId}`);
    return response.data;
  },

  async updateFarm(farmId: number, payload: FarmUpdatePayload): Promise<FarmProfile> {
    const response = await api.put<FarmProfile>(`/farms/${farmId}`, payload);
    return response.data;
  },

  async deleteFarm(farmId: number): Promise<void> {
    await api.delete(`/farms/${farmId}`);
  },

  async listCropsForFarm(farmId: number): Promise<FarmCrop[]> {
    const response = await api.get<FarmCrop[]>(`/farms/${farmId}/crops`);
    return response.data;
  },

  async addCrop(farmId: number, payload: CropCreatePayload): Promise<FarmCrop> {
    const response = await api.post<FarmCrop>(`/farms/${farmId}/crops`, payload);
    return response.data;
  },

  async listAllCrops(): Promise<FarmCrop[]> {
    const response = await api.get<FarmCrop[]>('/crops');
    return response.data;
  },

  async getCrop(cropId: number): Promise<FarmCrop> {
    const response = await api.get<FarmCrop>(`/crops/${cropId}`);
    return response.data;
  },

  async updateCrop(cropId: number, payload: CropUpdatePayload): Promise<FarmCrop> {
    const response = await api.put<FarmCrop>(`/crops/${cropId}`, payload);
    return response.data;
  },

  async deleteCrop(cropId: number): Promise<void> {
    await api.delete(`/crops/${cropId}`);
  },
};

// =============================================================================
// PHASE F4A: CALENDAR & TASK MANAGEMENT API METHODS
// =============================================================================
export const calendarApi = {
  async listTasks(params?: {
    farm_id?: number;
    crop_id?: number;
    category?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<CalendarTask[]> {
    const query = new URLSearchParams();
    if (params?.farm_id) query.append('farm_id', params.farm_id.toString());
    if (params?.crop_id) query.append('crop_id', params.crop_id.toString());
    if (params?.category) query.append('category', params.category);
    if (params?.status) query.append('status', params.status);
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const response = await api.get<CalendarTask[]>(`/calendar/tasks${queryString}`);
    return response.data;
  },

  async createTask(payload: TaskCreatePayload): Promise<CalendarTask> {
    const response = await api.post<CalendarTask>('/calendar/tasks', payload);
    return response.data;
  },

  async getTask(taskId: number): Promise<CalendarTask> {
    const response = await api.get<CalendarTask>(`/calendar/tasks/${taskId}`);
    return response.data;
  },

  async updateTask(taskId: number, payload: TaskUpdatePayload): Promise<CalendarTask> {
    const response = await api.put<CalendarTask>(`/calendar/tasks/${taskId}`, payload);
    return response.data;
  },

  async patchTaskStatus(taskId: number, status: 'pending' | 'completed' | 'cancelled'): Promise<CalendarTask> {
    const response = await api.patch<CalendarTask>(`/calendar/tasks/${taskId}/status`, { status });
    return response.data;
  },

  async rescheduleTask(taskId: number, payload: TaskReschedulePatchPayload): Promise<CalendarTask> {
    const response = await api.patch<CalendarTask>(`/calendar/tasks/${taskId}/reschedule`, payload);
    return response.data;
  },

  async deleteTask(taskId: number): Promise<void> {
    await api.delete(`/calendar/tasks/${taskId}`);
  },

  async getSummary(): Promise<CalendarSummary> {
    const response = await api.get<CalendarSummary>('/calendar/summary');
    return response.data;
  },

  async getDivisions(): Promise<BDDivisionsMap> {
    const response = await api.get<BDDivisionsMap>('/calendar/divisions');
    return response.data;
  },

  async getTemplates(): Promise<CropScheduleTemplate[]> {
    const response = await api.get<CropScheduleTemplate[]>('/calendar/schedule/templates');
    return response.data;
  },

  // Phase F4B: Smart Schedule API
  async generateSchedule(payload: ScheduleGeneratePayload): Promise<ScheduleGenerateResult> {
    const response = await api.post<ScheduleGenerateResult>('/calendar/schedule/generate', payload);
    return response.data;
  },

  async confirmSchedule(payload: ScheduleConfirmPayload): Promise<ScheduleConfirmResult> {
    const response = await api.post<ScheduleConfirmResult>('/calendar/schedule/confirm', payload);
    return response.data;
  },

  async listSchedules(params?: { farm_id?: number; crop_id?: number }): Promise<CropScheduleInstance[]> {
    const query = new URLSearchParams();
    if (params?.farm_id) query.append('farm_id', params.farm_id.toString());
    if (params?.crop_id) query.append('crop_id', params.crop_id.toString());
    const queryString = query.toString() ? `?${query.toString()}` : '';
    const response = await api.get<CropScheduleInstance[]>(`/calendar/schedules${queryString}`);
    return response.data;
  },

  async getSchedule(scheduleId: number): Promise<{ schedule: CropScheduleInstance; tasks: CalendarTask[] }> {
    const response = await api.get<{ schedule: CropScheduleInstance; tasks: CalendarTask[] }>(`/calendar/schedules/${scheduleId}`);
    return response.data;
  },
};

// ============================================================================
// Phase F4C: Weather Intelligence API Service
// ============================================================================
export const weatherApi = {
  async getForecast(farmId: number, bypassCache: boolean = false): Promise<FarmWeatherForecastResponse> {
    const query = bypassCache ? '?bypass_cache=true' : '';
    const response = await api.get<FarmWeatherForecastResponse>(`/weather/farms/${farmId}/forecast${query}`);
    return response.data;
  },

  async getSummary(farmId: number): Promise<CurrentWeatherSummary> {
    const response = await api.get<CurrentWeatherSummary>(`/weather/farms/${farmId}/summary`);
    return response.data;
  },

  async getAdvisories(farmId: number): Promise<FarmCalendarAdvisoriesResponse> {
    const response = await api.get<FarmCalendarAdvisoriesResponse>(`/weather/farms/${farmId}/calendar-advisories`);
    return response.data;
  },

  async getProviderStatus(): Promise<WeatherProviderStatusResponse> {
    const response = await api.get<WeatherProviderStatusResponse>('/weather/providers/status');
    return response.data;
  },

  async updateLocation(farmId: number, payload: { latitude: number; longitude: number }): Promise<{ message: string; farm_id: number; latitude: number; longitude: number }> {
    const response = await api.patch<{ message: string; farm_id: number; latitude: number; longitude: number }>(`/farms/${farmId}/location`, payload);
    return response.data;
  },
};

// ============================================================================
// Phase F4C: Smart Reminders API Service
// ============================================================================
export const reminderApi = {
  async list(farmId?: number, sync: boolean = true): Promise<ReminderListResponse> {
    const query = new URLSearchParams();
    if (farmId) query.append('farm_id', farmId.toString());
    if (!sync) query.append('sync', 'false');
    const queryString = query.toString() ? `?${query.toString()}` : '';
    const response = await api.get<ReminderListResponse>(`/calendar/reminders${queryString}`);
    return response.data;
  },

  async sync(): Promise<{ message: string; new_reminders_count: number }> {
    const response = await api.post<{ message: string; new_reminders_count: number }>('/calendar/reminders/sync');
    return response.data;
  },

  async markRead(reminderId: number): Promise<{ message: string; id: number }> {
    const response = await api.patch<{ message: string; id: number }>(`/calendar/reminders/${reminderId}/read`);
    return response.data;
  },

  async dismiss(reminderId: number): Promise<{ message: string; id: number }> {
    const response = await api.patch<{ message: string; id: number }>(`/calendar/reminders/${reminderId}/dismiss`);
    return response.data;
  },

  async markAllRead(): Promise<{ message: string; marked_count: number }> {
    const response = await api.post<{ message: string; marked_count: number }>('/calendar/reminders/read-all');
    return response.data;
  },
};

// ============================================================================
// Phase F5A: Farm Digital Twin & 360° Dashboard API Service
// ============================================================================
export const farmTwinApi = {
  async getOverview(farmId: number): Promise<FarmOverviewResponse> {
    const response = await api.get<FarmOverviewResponse>(`/farms/${farmId}/overview`);
    return response.data;
  },
};

// ============================================================================
// Phase F6A/F6B: Unified Farm Intelligence & Decision Dashboard API Service
// ============================================================================
export const farmIntelligenceApi = {
  async getIntelligence(farmId: number): Promise<FarmUnifiedIntelligenceResponse> {
    const response = await api.get<FarmUnifiedIntelligenceResponse>(`/farms/${farmId}/intelligence`);
    return response.data;
  },

  async getActions(farmId: number): Promise<FarmActionsResponse> {
    const response = await api.get<FarmActionsResponse>(`/farms/${farmId}/actions`);
    return response.data;
  },
};

// ============================================================================
// Phase F5B: Soil Health & Laboratory Test API Service
// ============================================================================
export const soilApi = {
  async getSoilTests(params?: {
    farm_id?: number;
    crop_id?: number;
    test_source?: string;
  }): Promise<SoilTest[]> {
    const response = await api.get<SoilTest[]>('/soil/tests', { params });
    return response.data;
  },

  async getFarmSoilTests(farmId: number): Promise<SoilTest[]> {
    const response = await api.get<SoilTest[]>(`/farms/${farmId}/soil-tests`);
    return response.data;
  },

  async getSoilTest(id: number): Promise<SoilTest> {
    const response = await api.get<SoilTest>(`/soil/tests/${id}`);
    return response.data;
  },

  async createSoilTest(payload: SoilTestCreatePayload): Promise<SoilTest> {
    const response = await api.post<SoilTest>('/soil/tests', payload);
    return response.data;
  },

  async updateSoilTest(id: number, payload: SoilTestUpdatePayload): Promise<SoilTest> {
    const response = await api.put<SoilTest>(`/soil/tests/${id}`, payload);
    return response.data;
  },

  async deleteSoilTest(id: number): Promise<{ detail: string; id: number }> {
    const response = await api.delete<{ detail: string; id: number }>(`/soil/tests/${id}`);
    return response.data;
  },

  async getModelInputSpec(): Promise<CropRecommendationModelInputSchema> {
    const response = await api.get<CropRecommendationModelInputSchema>('/soil/model-input-spec');
    return response.data;
  },

  async getFarmCropReadiness(farmId: number, soilTestId?: number): Promise<ModelReadinessAssessment> {
    const url = soilTestId
      ? `/farms/${farmId}/soil-tests/${soilTestId}/crop-readiness`
      : `/farms/${farmId}/crop-readiness`;
    const response = await api.get<ModelReadinessAssessment>(url);
    return response.data;
  },

  async getSoilTestCropReadiness(testId: number): Promise<ModelReadinessAssessment> {
    const response = await api.get<ModelReadinessAssessment>(`/soil/tests/${testId}/crop-readiness`);
    return response.data;
  },

  async predictFarmCrop(payload: FarmCropRecommendationRequest): Promise<FarmCropRecommendationResponse> {
    const response = await api.post<FarmCropRecommendationResponse>('/predict/crop_recommendation/farm-adapter', payload);
    return response.data;
  },
};

export const cropRecommendationApi = {
  getReadiness: soilApi.getFarmCropReadiness,
  getTestReadiness: soilApi.getSoilTestCropReadiness,
  predictFarmCrop: soilApi.predictFarmCrop,
  getModelSpec: soilApi.getModelInputSpec,
};

export const cultivationApi = {
  async listActivities(params?: {
    farm_id?: number;
    crop_id?: number;
    activity_type?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }): Promise<CultivationActivity[]> {
    const response = await api.get<CultivationActivity[]>('/cultivation/activities', { params });
    return response.data;
  },

  async getActivity(id: number): Promise<CultivationActivity> {
    const response = await api.get<CultivationActivity>(`/cultivation/activities/${id}`);
    return response.data;
  },

  async createActivity(payload: CultivationActivityCreatePayload): Promise<CultivationActivity> {
    const response = await api.post<CultivationActivity>('/cultivation/activities', payload);
    return response.data;
  },

  async updateActivity(id: number, payload: CultivationActivityUpdatePayload): Promise<CultivationActivity> {
    const response = await api.put<CultivationActivity>(`/cultivation/activities/${id}`, payload);
    return response.data;
  },

  async deleteActivity(id: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/cultivation/activities/${id}`);
    return response.data;
  },

  async listObservations(params?: {
    farm_id?: number;
    crop_id?: number;
    condition?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }): Promise<CropObservation[]> {
    const response = await api.get<CropObservation[]>('/cultivation/observations', { params });
    return response.data;
  },

  async getObservation(id: number): Promise<CropObservation> {
    const response = await api.get<CropObservation>(`/cultivation/observations/${id}`);
    return response.data;
  },

  async createObservation(payload: CropObservationCreatePayload): Promise<CropObservation> {
    const response = await api.post<CropObservation>('/cultivation/observations', payload);
    return response.data;
  },

  async updateObservation(id: number, payload: CropObservationUpdatePayload): Promise<CropObservation> {
    const response = await api.put<CropObservation>(`/cultivation/observations/${id}`, payload);
    return response.data;
  },

  async deleteObservation(id: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/cultivation/observations/${id}`);
    return response.data;
  },

  async checkCropDiseaseModel(cropId: number): Promise<CropDiseaseModelSupport> {
    const response = await api.get<CropDiseaseModelSupport>(`/cultivation/crops/${cropId}/disease-model`);
    return response.data;
  },

  async linkPrediction(observationId: number, predictionRecordId: number): Promise<CropObservation> {
    const response = await api.post<CropObservation>(`/cultivation/observations/${observationId}/link-prediction`, {
      prediction_record_id: predictionRecordId,
    });
    return response.data;
  },

  async unlinkPrediction(observationId: number): Promise<CropObservation> {
    const response = await api.delete<CropObservation>(`/cultivation/observations/${observationId}/link-prediction`);
    return response.data;
  },
};

export const harvestApi = {
  async listRecords(params?: {
    farm_id?: number;
    crop_id?: number;
    start_date?: string;
    end_date?: string;
    harvest_type?: string;
    quantity_source?: string;
  }): Promise<HarvestRecord[]> {
    const response = await api.get<HarvestRecord[]>('/harvest/records', { params });
    return response.data;
  },

  async getRecord(id: number): Promise<HarvestRecord> {
    const response = await api.get<HarvestRecord>(`/harvest/records/${id}`);
    return response.data;
  },

  async createRecord(payload: HarvestRecordCreatePayload): Promise<HarvestRecord> {
    const response = await api.post<HarvestRecord>('/harvest/records', payload);
    return response.data;
  },

  async updateRecord(id: number, payload: HarvestRecordUpdatePayload): Promise<HarvestRecord> {
    const response = await api.put<HarvestRecord>(`/harvest/records/${id}`, payload);
    return response.data;
  },

  async deleteRecord(id: number): Promise<{ detail: string; id: number }> {
    const response = await api.delete<{ detail: string; id: number }>(`/harvest/records/${id}`);
    return response.data;
  },

  async listFarmRecords(farmId: number, params?: {
    crop_id?: number;
    start_date?: string;
    end_date?: string;
    harvest_type?: string;
  }): Promise<HarvestRecord[]> {
    const response = await api.get<HarvestRecord[]>(`/farms/${farmId}/harvest-records`, { params });
    return response.data;
  },

  async getSummary(params?: {
    farm_id?: number;
    crop_id?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<HarvestSummaryResponse> {
    const response = await api.get<HarvestSummaryResponse>('/harvest/summary', { params });
    return response.data;
  },

  async getFarmSummary(farmId: number, params?: {
    crop_id?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<HarvestSummaryResponse> {
    const response = await api.get<HarvestSummaryResponse>(`/farms/${farmId}/harvest-summary`, { params });
    return response.data;
  },
};




