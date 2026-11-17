// Type definitions for AgriSphere AI Frontend

export interface User {
  id: number;
  username: string;
  email?: string | null;
  is_active: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface ModelInputSpec {
  image_size?: [number, number];
  color?: string;
  dtype?: string;
  pixel_range?: string;
  preprocessing?: string;
  class_names?: string[];
  n_classes?: number;
  features?: string[];
  categorical?: string[];
  target?: string;
  target_unit?: string;
  price_type?: string;
  unit?: string;
  forecast_horizon?: string;
  last_price_baseline_beats_ml?: boolean;
  example_is_synthetic?: boolean;
}

export interface ModelMetadata {
  id: string;
  task: string;
  type: 'image' | 'crop' | 'yield' | 'flood' | 'price' | string;
  caveat: string;
  input_spec: ModelInputSpec;
  package_path: string;
  source_sha256: string;
  checksum_verified?: boolean;
  included_report_files?: string[];
}

export interface HealthResponse {
  status: string;
  service: string;
  models_count: number;
}

export interface ChatProviderStatus {
  provider: string;
  is_external_llm_configured: boolean;
  mode_label: string;
  model?: string;
  description: string;
  supported_languages: string[];
  configuration_instructions?: string;
  disclaimer?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  provider?: string;
  metadata?: Record<string, any>;
}

export interface ChatSession {
  id: number;
  user_id: number;
  title: string;
  created_at: string;
  messages: ChatMessage[];
}

export interface PredictionRecord {
  id: number;
  user_id: number;
  model_id: string;
  request_payload: any;
  response: any;
  timestamp: string;
}

export interface PredictionResponse {
  model_id: string;
  task: string;
  prediction: any;
  record_id?: number | null;
  caveat: string;
}
