// Type definitions for AgriSphere AI Frontend

export interface User {
  id: number;
  username: string;
  email?: string | null;
  is_active: boolean;
  is_demo?: boolean;
  auth_provider?: 'local' | 'google' | 'demo';
  demo_inference_count?: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  is_demo?: boolean;
  username?: string;
  auth_provider?: string;
}

export interface AuthConfigResponse {
  google_auth_enabled: boolean;
  google_client_id: string | null;
  demo_mode_enabled: boolean;
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

// =============================================================================
// PHASE F4A: FARM PROFILES & AGRICULTURAL CALENDAR TYPES
// =============================================================================

export interface FarmProfile {
  id: number;
  user_id: number;
  name: string;
  division: string;
  district: string;
  upazila: string;
  village?: string | null;
  area: number;
  area_unit: string;
  standard_decimal_area: number;
  soil_type?: string | null;
  notes?: string | null;
  is_active: boolean;
  crop_count: number;
  task_count: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FarmCreatePayload {
  name: string;
  division: string;
  district: string;
  upazila: string;
  village?: string | null;
  area: number;
  area_unit: string;
  soil_type?: string | null;
  notes?: string | null;
}

export interface FarmUpdatePayload {
  name?: string;
  division?: string;
  district?: string;
  upazila?: string;
  village?: string | null;
  area?: number;
  area_unit?: string;
  soil_type?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface FarmCrop {
  id: number;
  farm_id: number;
  farm_name?: string | null;
  user_id: number;
  crop_name: string;
  variety?: string | null;
  season: string;
  sowing_date: string;
  transplanting_date?: string | null;
  expected_harvest_date?: string | null;
  status: string;
  notes?: string | null;
  task_count: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CropCreatePayload {
  crop_name: string;
  variety?: string | null;
  season: string;
  sowing_date: string;
  transplanting_date?: string | null;
  expected_harvest_date?: string | null;
  status?: string;
  notes?: string | null;
}

export interface CropUpdatePayload {
  crop_name?: string;
  variety?: string | null;
  season?: string;
  sowing_date?: string;
  transplanting_date?: string | null;
  expected_harvest_date?: string | null;
  status?: string;
  notes?: string | null;
}

export type TaskCategory =
  | 'land_preparation'
  | 'sowing'
  | 'transplanting'
  | 'irrigation'
  | 'nutrient_management'
  | 'crop_observation'
  | 'harvest_planning'
  | 'general';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'completed' | 'cancelled';

export interface CalendarTask {
  id: number;
  user_id: number;
  farm_id: number;
  farm_name?: string | null;
  crop_id?: number | null;
  crop_name?: string | null;
  title: string;
  category: string;
  due_date: string;
  due_time?: string | null;
  status: string;
  priority: string;
  notes?: string | null;
  completed_at?: string | null;
  rescheduled_to?: string | null;
  schedule_instance_id?: number | null;
  is_generated?: boolean;
  stage_name?: string | null;
  source_org?: string | null;
  is_overdue: boolean;
  is_due_today: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TaskCreatePayload {
  farm_id: number;
  crop_id?: number | null;
  title: string;
  category: string;
  due_date: string;
  due_time?: string | null;
  priority: string;
  notes?: string | null;
}

export interface TaskUpdatePayload {
  farm_id?: number;
  crop_id?: number | null;
  title?: string;
  category?: string;
  due_date?: string;
  due_time?: string | null;
  priority?: string;
  status?: string;
  notes?: string | null;
}

export interface TaskStatusPatchPayload {
  status: 'pending' | 'completed' | 'cancelled';
}

export interface TaskReschedulePatchPayload {
  due_date: string;
  due_time?: string | null;
  notes?: string | null;
}

export interface CalendarSummary {
  current_dhaka_date: string;
  total_farms: number;
  active_crops: number;
  today_tasks_count: number;
  upcoming_tasks_count: number;
  overdue_tasks_count: number;
  completed_tasks_count: number;
  today_tasks: CalendarTask[];
  upcoming_tasks: CalendarTask[];
  overdue_tasks: CalendarTask[];
}

export interface BDDivisionsMap {
  [division: string]: string[];
}

export interface CropScheduleTemplateStage {
  stage_id: string;
  stage_name: string;
  stage_name_bn: string;
  day_offset_start: number;
  day_offset_end: number;
  recommended_category: string;
  action_bn: string;
  action_en: string;
  notes_bn: string;
  notes_en: string;
  scientific_basis: string;
  source_reference?: string;
  is_optional?: boolean;
  priority?: string;
}

export interface CropScheduleTemplate {
  template_id: string;
  crop: string;
  crop_bn: string;
  variety?: string | null;
  season: string;
  season_bn: string;
  applicable_regions: string[];
  source_agency: string;
  source_url: string;
  source_version: string;
  recommended_sowing_window: string;
  stages: CropScheduleTemplateStage[];
  limitations: string;
}

// =============================================================================
// PHASE F4B: SMART SCHEDULE TYPES
// =============================================================================
export interface GeneratedTaskItem {
  temp_id: string;
  stage_id: string;
  stage_name: string;
  stage_name_bn: string;
  title: string;
  category: string;
  due_date: string;
  due_time?: string | null;
  priority: string;
  notes: string;
  scientific_basis: string;
  source_agency: string;
  source_reference: string;
  is_optional: boolean;
  included: boolean;
}

export interface ScheduleGeneratePayload {
  farm_id: number;
  crop_id: number;
  planting_date: string;
  target_variety?: string;
  season?: string;
}

export interface ScheduleGenerateResult {
  status: 'success' | 'unsupported';
  template_id?: string | null;
  crop_id: number;
  crop_name: string;
  crop_name_bn: string;
  variety?: string | null;
  season: string;
  season_bn: string;
  farm_id: number;
  farm_name: string;
  district: string;
  division: string;
  planting_date: string;
  estimated_harvest_date: string;
  source_agency: string;
  source_reference: string;
  source_url: string;
  source_version: string;
  warnings: string[];
  limitations: string;
  schedule_hash: string;
  already_generated: boolean;
  existing_instance_id?: number | null;
  tasks: GeneratedTaskItem[];
  total_tasks: number;
  support_message_bn?: string | null;
  support_message_en?: string | null;
}

export interface ScheduleConfirmPayload {
  farm_id: number;
  crop_id: number;
  template_id: string;
  planting_date: string;
  schedule_hash: string;
  tasks: GeneratedTaskItem[];
}

export interface ScheduleConfirmResult {
  success: boolean;
  schedule_instance_id: number;
  farm_id: number;
  crop_id: number;
  tasks_created_count: number;
  schedule_hash: string;
  message: string;
  message_bn: string;
}

export interface CropScheduleInstance {
  id: number;
  user_id: number;
  farm_id: number;
  crop_id: number;
  farm_name?: string | null;
  crop_name?: string | null;
  template_id: string;
  schedule_hash: string;
  planting_date: string;
  estimated_harvest_date?: string | null;
  status: string;
  source_agency: string;
  source_version: string;
  tasks_count: number;
  created_at?: string | null;
  updated_at?: string | null;
}

// ============================================================================
// Phase F4C: Weather Intelligence, Advisories & Smart Reminders
// ============================================================================
export interface WeatherUnits {
  temperature: string;
  precipitation: string;
  wind_speed: string;
  relative_humidity: string;
  time: string;
}

export interface DailyForecastItem {
  date: string;
  day_name_bn: string;
  day_name_en: string;
  temp_min: number;
  temp_max: number;
  precipitation_sum_mm: number;
  precipitation_probability_max: number;
  relative_humidity_mean: number;
  wind_speed_max_kmh: number;
  weather_code: number;
  condition_bn: string;
  condition_en: string;
  icon: string;
  color: string;
}

export interface CurrentWeatherSummary {
  as_of: string;
  temp_current?: number | null;
  temp_min: number;
  temp_max: number;
  precipitation_mm: number;
  precipitation_prob: number;
  humidity: number;
  wind_kmh: number;
  condition_bn: string;
  condition_en: string;
  weather_code: number;
  icon: string;
  is_rainy?: boolean;
  is_high_temp?: boolean;
  is_cold_wave?: boolean;
  is_windy?: boolean;
}

export interface FarmLocationMetadata {
  farm_id: number;
  farm_name: string;
  division: string;
  district: string;
  upazila: string;
  village?: string | null;
  latitude: number;
  longitude: number;
  is_custom_coordinate: boolean;
  location_label_bn: string;
  location_label_en: string;
}

export interface FarmWeatherForecastResponse {
  status: 'ok' | 'cached' | 'unavailable';
  provider: string;
  provider_url: string;
  official_bmd_reference: string;
  official_bamis_reference: string;
  timezone: string;
  location: FarmLocationMetadata;
  units: WeatherUnits;
  generated_at: string;
  is_cached: boolean;
  cache_expires_at?: string | null;
  current: CurrentWeatherSummary;
  forecast: DailyForecastItem[];
  message_bn?: string | null;
  message_en?: string | null;
}

export interface CalendarWeatherAdvisory {
  advisory_id: string;
  farm_id: number;
  task_id: number;
  task_title: string;
  task_category: string;
  task_due_date: string;
  weather_variable: string;
  forecast_value: string;
  severity: 'info' | 'warning' | 'urgent';
  title_bn: string;
  reason_bn: string;
  action_suggestion_bn: string;
  title_en: string;
  reason_en: string;
  action_suggestion_en: string;
  can_reschedule: boolean;
  suggested_reschedule_days: number[];
  source: string;
  scientific_basis: string;
  uncertainty_disclosure_bn: string;
  created_at: string;
}

export interface FarmCalendarAdvisoriesResponse {
  farm_id: number;
  farm_name: string;
  total_advisories: number;
  advisories: CalendarWeatherAdvisory[];
  disclaimer_bn: string;
  official_warning_links: Record<string, string>;
}

export interface WeatherProviderStatusResponse {
  provider_name: string;
  license: string;
  is_operational: boolean;
  last_ping_status: string;
  response_time_ms?: number | null;
  cache_entries: number;
  official_references: Record<string, string>;
  terms_disclosure: string;
}

export interface ReminderItem {
  id: number;
  user_id: number;
  farm_id?: number | null;
  farm_name?: string | null;
  task_id?: number | null;
  task_title?: string | null;
  reminder_type: 'due_today' | 'upcoming_task' | 'overdue_task' | 'weather_advisory' | 'schedule_milestone';
  title_bn: string;
  message_bn: string;
  title_en?: string | null;
  message_en?: string | null;
  severity: 'info' | 'warning' | 'urgent';
  action_type?: string | null;
  action_payload?: Record<string, any> | null;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

export interface ReminderCounts {
  total_active: number;
  unread_count: number;
  due_today_count: number;
  overdue_count: number;
  weather_advisory_count: number;
}

export interface ReminderListResponse {
  reminders: ReminderItem[];
  counts: ReminderCounts;
}

// =============================================================================
// PHASE F5A: FARM DIGITAL TWIN & FARM 360° DASHBOARD
// =============================================================================
export interface FarmProfileDetail {
  id: number;
  name: string;
  division: string;
  district: string;
  upazila: string;
  village?: string | null;
  area: number;
  area_unit: string;
  soil_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  created_at?: string | null;
}

export interface FarmCropSummaryItem {
  id: number;
  crop_name: string;
  crop_name_bn: string;
  variety?: string | null;
  season: string;
  season_bn: string;
  sowing_date: string;
  transplanting_date?: string | null;
  expected_harvest_date?: string | null;
  status: string;
  status_bn: string;
  notes?: string | null;
}

export interface FarmTaskSummaryItem {
  id: number;
  crop_id?: number | null;
  crop_name?: string | null;
  title: string;
  category: string;
  category_bn: string;
  due_date: string;
  due_time?: string | null;
  priority: string;
  status: string;
  is_overdue: boolean;
  is_due_today: boolean;
  is_ai_generated: boolean;
  source_agency?: string | null;
}

export interface FarmScheduleProgressItem {
  id: number;
  crop_id: number;
  crop_name: string;
  crop_name_bn: string;
  template_id: string;
  source_agency: string;
  planting_date: string;
  estimated_harvest_date?: string | null;
  total_tasks: number;
  completed_tasks: number;
  progress_percent: number;
  status: string;
}

export interface FarmWeatherOverview {
  status: string; // "ok" | "unavailable"
  location_label_bn: string;
  location_label_en: string;
  is_cached?: boolean;
  temp_current?: number | null;
  temp_min?: number | null;
  temp_max?: number | null;
  precipitation_mm: number;
  precipitation_prob: number;
  humidity: number;
  wind_kmh: number;
  condition_bn: string;
  condition_en: string;
  icon: string;
  advisories_count: number;
  active_advisories: Array<Record<string, any>>;
}

export interface FarmAIShortcut {
  id: string;
  model_id: string;
  title_bn: string;
  title_en: string;
  desc_bn: string;
  desc_en: string;
  icon: string;
  category: string;
  prefill_data: Record<string, any>;
}

export interface FarmDigitalTwinMetadata {
  is_live_physical_simulation: boolean;
  data_source: string;
  disclaimer_bn: string;
  disclaimer_en: string;
}

export interface FarmOverviewResponse {
  farm: FarmProfileDetail;
  crops_summary: {
    total_crops: number;
    active_crops_count: number;
    harvested_crops_count: number;
    crops: FarmCropSummaryItem[];
  };
  tasks_summary: {
    total_tasks: number;
    completed_tasks: number;
    pending_tasks: number;
    overdue_tasks: number;
    due_today_tasks: number;
    upcoming_tasks: FarmTaskSummaryItem[];
    overdue_tasks_list: FarmTaskSummaryItem[];
    all_tasks: FarmTaskSummaryItem[];
  };
  schedules_summary: {
    total_schedules: number;
    active_schedules_count: number;
    schedules: FarmScheduleProgressItem[];
  };
  weather_summary: FarmWeatherOverview;
  ai_shortcuts: FarmAIShortcut[];
  twin_metadata: FarmDigitalTwinMetadata;
}

// ============================================================================
// Phase F6C-1 / UI-R2A: Contextual Farm Actions & Review Models
// ============================================================================
export interface FarmActionItem {
  action_id: string;
  rule_id: string;
  farm_id: number;
  crop_id?: number | null;
  related_record_id?: number | null;
  title_bn: string;
  title_en: string;
  explanation_bn: string;
  explanation_en: string;
  priority: 'high' | 'medium' | 'low';
  source_module: 'calendar' | 'soil_health' | 'crop_monitoring' | 'weather' | string;
  source_date?: string | null;
  data_freshness: 'current' | 'dated' | 'unavailable' | 'missing' | string;
  destination_tab: 'calendar' | 'soil_health' | 'crop_monitoring' | 'harvest' | 'farm_twin' | string;
}

export interface FarmActionsResponse {
  farm_id: number;
  farm_name: string;
  actions: FarmActionItem[];
  total_actions: number;
  priority_counts: {
    high: number;
    medium: number;
    low: number;
  };
  records_reviewed_count: number;
  data_availability: Record<string, string>;
  generated_at: string;
}


// =============================================================================
// Phase F5B: Soil Health & Laboratory Test Types
// =============================================================================

export type SoilTestSource = 'laboratory' | 'farmer_entered';

export interface SoilTest {
  id: number;
  user_id: number;
  farm_id: number;
  crop_id?: number | null;
  sample_label: string;
  sample_date: string; // YYYY-MM-DD
  test_source: SoilTestSource;
  laboratory_name?: string | null;

  // Primary nutrients (nullable float: NEVER default unmeasured values to 0)
  nitrogen_n?: number | null;
  phosphorus_p?: number | null;
  potassium_k?: number | null;

  // Soil chemical and physical properties
  soil_ph?: number | null;
  organic_matter_percent?: number | null;
  electrical_conductivity?: number | null;
  soil_moisture_percent?: number | null;
  soil_type?: string | null;

  // Explicit measurement provenance and units
  measurement_unit_n: string; // default "mg/kg"
  measurement_unit_p: string; // default "mg/kg"
  measurement_unit_k: string; // default "mg/kg"
  ph_measurement_method?: string | null;

  farmer_notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SoilTestCreatePayload {
  farm_id: number;
  crop_id?: number | null;
  sample_label: string;
  sample_date: string;
  test_source?: SoilTestSource;
  laboratory_name?: string | null;
  nitrogen_n?: number | null;
  phosphorus_p?: number | null;
  potassium_k?: number | null;
  soil_ph?: number | null;
  organic_matter_percent?: number | null;
  electrical_conductivity?: number | null;
  soil_moisture_percent?: number | null;
  soil_type?: string | null;
  measurement_unit_n?: string;
  measurement_unit_p?: string;
  measurement_unit_k?: string;
  ph_measurement_method?: string | null;
  farmer_notes?: string | null;
}

export interface SoilTestUpdatePayload {
  crop_id?: number | null;
  sample_label?: string;
  sample_date?: string;
  test_source?: SoilTestSource;
  laboratory_name?: string | null;
  nitrogen_n?: number | null;
  phosphorus_p?: number | null;
  potassium_k?: number | null;
  soil_ph?: number | null;
  organic_matter_percent?: number | null;
  electrical_conductivity?: number | null;
  soil_moisture_percent?: number | null;
  soil_type?: string | null;
  measurement_unit_n?: string;
  measurement_unit_p?: string;
  measurement_unit_k?: string;
  ph_measurement_method?: string | null;
  farmer_notes?: string | null;
}

export interface CropRecommendationFeatureSpec {
  feature_name: string;
  feature_type: string;
  required_in_model: boolean;
  training_min: number;
  training_max: number;
  training_mean: number;
  documented_unit?: string | null;
  unit_caveat: string;
}

export interface CropRecommendationModelInputSchema {
  model_id: string;
  model_type: string;
  target_classes_count: number;
  target_classes: string[];
  features_spec: Record<string, CropRecommendationFeatureSpec>;
  official_caveat: string;
}

// =============================================================================
// PHASE F5C: CROP RECOMMENDATION READINESS & ADAPTER TYPES
// =============================================================================
export interface FeatureReadinessDetail {
  feature_name: string;
  required: boolean;
  training_min: number;
  training_max: number;
  training_mean: number;
  training_unit?: string | null;
  available_value?: number | null;
  available_unit?: string | null;
  compatibility_status: string;
  provenance?: string | null;
  warning: string;
  allow_auto_prefill: boolean;
}

export interface ModelReadinessAssessment {
  farm_id: number;
  farm_name: string;
  district?: string | null;
  upazila?: string | null;
  soil_test_id?: number | null;
  soil_test_date?: string | null;
  soil_test_source?: string | null;
  soil_test_lab?: string | null;
  model_id: string;
  model_task: string;
  target_classes_count: number;
  required_features: string[];
  available_features_count: number;
  missing_features: string[];
  features: Record<string, FeatureReadinessDetail>;
  overall_compatibility: string;
  automatic_prefill_permitted: boolean;
  scientific_caveat: string;
  recommended_action: string;
}

export interface FarmCropRecommendationRequest {
  farm_id: number;
  soil_test_id?: number | null;
  features: Record<string, number>;
  user_confirmed_disclaimer: boolean;
  input_source_mode?: string;
}

export interface FarmCropRecommendationResponse {
  model_id: string;
  task: string;
  farm_id: number;
  farm_name: string;
  soil_test_id?: number | null;
  input_source_mode: string;
  submitted_features: Record<string, number>;
  prediction: {
    model_id: string;
    recommended_crop: string;
    top_alternatives?: Record<string, number>;
    caveat?: string;
  };
  record_id?: number | null;
  scientific_caveat: string;
  unit_warning: string;
  provenance: {
    farm_id: number;
    soil_test_id?: number | null;
    input_mode: string;
    confirmed_disclaimer: boolean;
    auto_prefilled: boolean;
  };
}

// =============================================================================
// PHASE F5D: CULTIVATION ACTIVITIES & CROP OBSERVATIONS TYPES
// =============================================================================

export type CultivationActivityType =
  | 'land_preparation'
  | 'sowing'
  | 'irrigation'
  | 'nutrient_management'
  | 'crop_inspection'
  | 'field_maintenance'
  | 'harvest'
  | 'other';

export type CultivationActivityStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface CultivationActivity {
  id: number;
  user_id: number;
  farm_id: number;
  crop_id: number;
  calendar_task_id?: number | null;
  activity_type: CultivationActivityType | string;
  activity_date: string; // YYYY-MM-DD
  title: string;
  description?: string | null;
  farmer_notes?: string | null;
  status: CultivationActivityStatus | string;
  created_at?: string | null;
  updated_at?: string | null;
  farm_name?: string | null;
  crop_name?: string | null;
}

export interface CultivationActivityCreatePayload {
  farm_id: number;
  crop_id: number;
  calendar_task_id?: number | null;
  activity_type: CultivationActivityType | string;
  activity_date: string;
  title: string;
  description?: string | null;
  farmer_notes?: string | null;
  status?: CultivationActivityStatus | string;
}

export interface CultivationActivityUpdatePayload {
  calendar_task_id?: number | null;
  activity_type?: CultivationActivityType | string;
  activity_date?: string;
  title?: string;
  description?: string | null;
  farmer_notes?: string | null;
  status?: CultivationActivityStatus | string;
}

export type CropObservationCondition =
  | 'healthy'
  | 'minor_issue'
  | 'moderate_issue'
  | 'severe_issue'
  | 'unknown';

export interface CropObservation {
  id: number;
  user_id: number;
  farm_id: number;
  crop_id: number;
  observation_date: string; // YYYY-MM-DD
  title: string;
  plant_growth_stage?: string | null;
  growth_notes?: string | null;
  visible_symptoms?: string | null;
  farmer_reported_condition: CropObservationCondition | string;
  activity_id?: number | null;
  prediction_record_id?: number | null;
  prediction_summary?: {
    id: number;
    model_id: string;
    predicted_class?: string | null;
    confidence?: number | null;
    timestamp?: string | null;
    caveat?: string | null;
  } | null;
  source: string; // "farmer_entered"
  created_at?: string | null;
  updated_at?: string | null;
  farm_name?: string | null;
  crop_name?: string | null;
}

export interface LinkPredictionPayload {
  prediction_record_id: number;
}

export interface CropDiseaseModelSupport {
  crop_id: number;
  crop_name: string;
  is_supported: boolean;
  model_id: 'tomato_disease_v3' | 'rice_disease' | null;
  model_name_bn: string | null;
  model_name_en: string | null;
  task: string | null;
  supported_classes: string[];
  caveat: string | null;
  field_limitations?: string | null;
  unsupported_reason: string | null;
}

export interface CropObservationCreatePayload {
  farm_id: number;
  crop_id: number;
  observation_date: string;
  title: string;
  plant_growth_stage?: string | null;
  growth_notes?: string | null;
  visible_symptoms?: string | null;
  farmer_reported_condition: CropObservationCondition | string;
  activity_id?: number | null;
  prediction_record_id?: number | null;
}

export interface CropObservationUpdatePayload {
  observation_date?: string;
  title?: string;
  plant_growth_stage?: string | null;
  growth_notes?: string | null;
  visible_symptoms?: string | null;
  farmer_reported_condition?: CropObservationCondition | string;
  activity_id?: number | null;
  prediction_record_id?: number | null;
}

export type TimelineItemType = 'activity' | 'observation';

export interface CultivationTimelineItem {
  id: string; // `act-${id}` or `obs-${id}`
  rawId: number;
  type: TimelineItemType;
  date: string;
  title: string;
  crop_id: number;
  crop_name?: string | null;
  farm_id: number;
  farm_name?: string | null;
  statusOrCondition: string;
  notes?: string | null;
  activityType?: string;
  growthStage?: string | null;
  visibleSymptoms?: string | null;
  calendarTaskId?: number | null;
  rawActivity?: CultivationActivity;
  rawObservation?: CropObservation;
}

// ==========================================
// Phase F5E: Harvest Records & Actual Yield
// ==========================================

export type HarvestQuantitySource = 'weighed' | 'farmer_estimated';
export type HarvestType = 'partial' | 'final';

export interface HarvestRecord {
  id: number;
  user_id: number;
  farm_id: number;
  crop_id: number;
  harvest_date: string;
  harvest_label: string;
  measured_quantity_kg: number;
  quantity_source: HarvestQuantitySource;
  harvested_area?: number | null;
  harvested_area_unit?: string | null;
  harvest_type: HarvestType;
  cultivation_activity_id?: number | null;
  calendar_task_id?: number | null;
  farmer_notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  farm_name?: string | null;
  crop_name?: string | null;
  crop_variety?: string | null;
}

export interface HarvestRecordCreatePayload {
  farm_id: number;
  crop_id: number;
  harvest_date: string;
  harvest_label: string;
  measured_quantity_kg: number;
  quantity_source?: HarvestQuantitySource;
  harvested_area?: number | null;
  harvested_area_unit?: string | null;
  harvest_type?: HarvestType;
  cultivation_activity_id?: number | null;
  calendar_task_id?: number | null;
  farmer_notes?: string | null;
}

export interface HarvestRecordUpdatePayload {
  harvest_date?: string;
  harvest_label?: string;
  measured_quantity_kg?: number;
  quantity_source?: HarvestQuantitySource;
  harvested_area?: number | null;
  harvested_area_unit?: string | null;
  harvest_type?: HarvestType;
  cultivation_activity_id?: number | null;
  calendar_task_id?: number | null;
  farmer_notes?: string | null;
}

export interface HarvestYieldMetric {
  yield_t_ha?: number | null;
  yield_kg_ha?: number | null;
  yield_kg_decimal?: number | null;
  harvested_area_hectares?: number | null;
  harvested_area_display?: string | null;
  calculation_status: 'calculated' | 'not_available';
  area_basis?: string | null;
  is_self_reported: boolean;
  disclaimer_bn: string;
}

export interface CropHarvestSummary {
  crop_id: number;
  crop_name: string;
  variety?: string | null;
  season: string;
  total_quantity_kg: number;
  records_count: number;
  partial_count: number;
  final_count: number;
  weighed_quantity_kg: number;
  estimated_quantity_kg: number;
  latest_harvest_date?: string | null;
  yield_metric: HarvestYieldMetric;
}

export interface FarmHarvestSummary {
  farm_id: number;
  farm_name: string;
  total_quantity_kg: number;
  records_count: number;
  crops: CropHarvestSummary[];
}

export interface HarvestSummaryResponse {
  total_measured_quantity_kg: number;
  total_records_count: number;
  partial_harvests_count: number;
  final_harvests_count: number;
  partial_quantity_kg: number;
  final_quantity_kg: number;
  weighed_records_count: number;
  weighed_quantity_kg: number;
  farmer_estimated_records_count: number;
  farmer_estimated_quantity_kg: number;
  latest_harvest_date?: string | null;
  earliest_harvest_date?: string | null;
  filter_farm_id?: number | null;
  filter_crop_id?: number | null;
  farm_breakdown: FarmHarvestSummary[];
  crop_breakdown: CropHarvestSummary[];
  overall_yield_metric: HarvestYieldMetric;
}

// =============================================================================
// Phase F6A/F6B: Unified Farm Intelligence & Decision Dashboard
// =============================================================================

export interface SoilTestSummaryItem {
  id: number;
  sample_label: string;
  sample_date: string;
  test_source: string; // "laboratory" | "farmer_entered"
  laboratory_name?: string | null;
  crop_id?: number | null;
  crop_name?: string | null;
  soil_ph?: number | null;
  nitrogen_n?: number | null;
  phosphorus_p?: number | null;
  potassium_k?: number | null;
  organic_matter_percent?: number | null;
  electrical_conductivity?: number | null;
  soil_moisture_percent?: number | null;
  soil_type?: string | null;
  measurement_unit_n: string;
  measurement_unit_p: string;
  measurement_unit_k: string;
  ph_measurement_method?: string | null;
  farmer_notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FarmSoilIntelligenceSummary {
  has_soil_test: boolean;
  total_tests_count: number;
  latest_soil_test?: SoilTestSummaryItem | null;
  latest_test_date?: string | null;
  missing_nutrients: string[];
  measured_nutrients: string[];
  provenance_mode: string; // "laboratory_verified" | "farmer_reported" | "none"
  scientific_caveat_bn: string;
  scientific_caveat_en: string;
}

export interface CultivationActivitySummaryItem {
  id: number;
  activity_type: string;
  activity_date: string;
  title: string;
  crop_id: number;
  crop_name?: string | null;
  calendar_task_id?: number | null;
  status: string;
  description?: string | null;
  farmer_notes?: string | null;
  created_at?: string | null;
}

export interface FarmCultivationIntelligenceSummary {
  has_activities: boolean;
  total_activities_count: number;
  recent_activities: CultivationActivitySummaryItem[];
  latest_activity_date?: string | null;
  activity_types_breakdown: Record<string, number>;
}

export interface CropObservationSummaryItem {
  id: number;
  observation_date: string;
  title: string;
  crop_id: number;
  crop_name?: string | null;
  plant_growth_stage?: string | null;
  growth_notes?: string | null;
  visible_symptoms?: string | null;
  farmer_reported_condition: string;
  prediction_record_id?: number | null;
  prediction_summary?: Record<string, any> | null;
  is_ai_diagnosis: boolean;
  source: string;
  created_at?: string | null;
}

export interface FarmObservationIntelligenceSummary {
  has_observations: boolean;
  total_observations_count: number;
  recent_observations: CropObservationSummaryItem[];
  latest_observation_date?: string | null;
  conditions_breakdown: Record<string, number>;
  linked_predictions_count: number;
  scientific_caveat_bn: string;
  scientific_caveat_en: string;
}

export interface HarvestRecordSummaryItem {
  id: number;
  harvest_date: string;
  harvest_label: string;
  crop_id: number;
  crop_name?: string | null;
  crop_variety?: string | null;
  measured_quantity_kg: number;
  quantity_source: string; // "weighed" | "farmer_estimated"
  harvest_type: string; // "partial" | "final"
  harvested_area?: number | null;
  harvested_area_unit?: string | null;
  farmer_notes?: string | null;
  created_at?: string | null;
}

export interface FarmHarvestIntelligenceSummary {
  has_harvest_records: boolean;
  total_records_count: number;
  total_quantity_kg: number;
  total_quantity_maund: number;
  weighed_quantity_kg: number;
  estimated_quantity_kg: number;
  partial_harvests_count: number;
  final_harvests_count: number;
  latest_harvest_date?: string | null;
  latest_harvest_record?: HarvestRecordSummaryItem | null;
  recent_harvests: HarvestRecordSummaryItem[];
  yield_metric_status: string;
  yield_metric_disclaimer_bn?: string | null;
  per_crop_totals: Record<string, any>;
}

export interface FarmPredictionReferenceItem {
  prediction_id: number;
  model_id: string;
  timestamp?: string | null;
  association_type: string;
  associated_crop_id?: number | null;
  associated_crop_name?: string | null;
  predicted_outcome: Record<string, any>;
  is_ai_generated: boolean;
  caveat?: string | null;
}

export interface FarmPredictionsIntelligenceSummary {
  has_predictions: boolean;
  total_associated_predictions: number;
  predictions: FarmPredictionReferenceItem[];
  models_represented: string[];
  scientific_caveat_bn: string;
  scientific_caveat_en: string;
}

export interface FarmUpcomingActionsSummary {
  total_pending_tasks: number;
  overdue_tasks_count: number;
  due_today_tasks_count: number;
  upcoming_tasks_count: number;
  overdue_tasks: FarmTaskSummaryItem[];
  due_today_tasks: FarmTaskSummaryItem[];
  upcoming_tasks: FarmTaskSummaryItem[];
  recent_activities: CultivationActivitySummaryItem[];
  safety_advisory_bn: string;
  safety_advisory_en: string;
}

export interface FarmIntelligenceProvenanceItem {
  domain: string;
  source_module: string;
  origin_type: string;
  record_count: number;
  latest_date?: string | null;
  status: string;
  notes: string;
}

export interface FarmIntelligenceProvenanceAudit {
  items: FarmIntelligenceProvenanceItem[];
  audit_timestamp: string;
  no_synthetic_scores_guarantee: boolean;
}

export interface FarmScientificLimitations {
  farmer_observation_is_not_ai_diagnosis: string;
  soil_test_model_compatibility_warning: string;
  regional_yield_not_farm_guarantee: string;
  historical_price_not_live_quote: string;
  static_flood_not_live_warning: string;
  weather_guidance_is_informational: string;
  synthetic_health_score_disclaimer: string;
}

export interface FarmUnifiedIntelligenceResponse {
  farm: FarmProfileDetail;
  crops_summary: {
    total_crops: number;
    active_crops_count: number;
    harvested_crops_count: number;
    crops: FarmCropSummaryItem[];
  };
  soil_summary: FarmSoilIntelligenceSummary;
  tasks_summary: {
    total_tasks: number;
    completed_tasks: number;
    pending_tasks: number;
    overdue_tasks: number;
    due_today_tasks: number;
    upcoming_tasks: FarmTaskSummaryItem[];
    overdue_tasks_list: FarmTaskSummaryItem[];
    all_tasks: FarmTaskSummaryItem[];
  };
  schedules_summary: {
    total_schedules: number;
    active_schedules_count: number;
    schedules: FarmScheduleProgressItem[];
  };
  cultivation_summary: FarmCultivationIntelligenceSummary;
  observations_summary: FarmObservationIntelligenceSummary;
  harvest_summary: FarmHarvestIntelligenceSummary;
  predictions_summary: FarmPredictionsIntelligenceSummary;
  weather_summary: FarmWeatherOverview;
  upcoming_actions: FarmUpcomingActionsSummary;
  provenance_audit: FarmIntelligenceProvenanceAudit;
  scientific_limitations: FarmScientificLimitations;
  twin_metadata: FarmDigitalTwinMetadata;
}

// ============================================================================
// Phase F6C-1 / UI-R2A: Contextual Farm Actions & Review Models
// ============================================================================
export interface FarmActionItem {
  action_id: string;
  rule_id: string;
  farm_id: number;
  crop_id?: number | null;
  related_record_id?: number | null;
  title_bn: string;
  title_en: string;
  explanation_bn: string;
  explanation_en: string;
  priority: 'high' | 'medium' | 'low';
  source_module: 'calendar' | 'soil_health' | 'crop_monitoring' | 'weather' | string;
  source_date?: string | null;
  data_freshness: 'current' | 'dated' | 'unavailable' | 'missing' | string;
  destination_tab: 'calendar' | 'soil_health' | 'crop_monitoring' | 'harvest' | 'farm_twin' | string;
}

export interface FarmActionsResponse {
  farm_id: number;
  farm_name: string;
  actions: FarmActionItem[];
  total_actions: number;
  priority_counts: {
    high: number;
    medium: number;
    low: number;
  };
  records_reviewed_count: number;
  data_availability: Record<string, string>;
  generated_at: string;
}







