# Weather domain models, schemas, and Bangladesh geographic coordinates (Phase F4C)
# Strictly adheres to Open-Meteo API specifications (CC BY 4.0), WMO weather standards,
# and verified district centroids for all 64 districts of Bangladesh.

from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


# =============================================================================
# 1. BANGLADESH 64 DISTRICTS VERIFIED GEOGRAPHIC REFERENCE CENTROIDS
# =============================================================================
# Approximate administrative centroid coordinates used as representative forecast points.
# Always transparently disclosed to farmers as district center approximations.

BANGLADESH_DISTRICT_COORDINATES: Dict[str, Dict[str, Any]] = {
    # Dhaka Division
    "Dhaka": {"bn": "ঢাকা", "lat": 23.8103, "lon": 90.4125, "division": "Dhaka"},
    "Gazipur": {"bn": "গাজীপুর", "lat": 23.9999, "lon": 90.4203, "division": "Dhaka"},
    "Narayanganj": {"bn": "নারায়ণগঞ্জ", "lat": 23.6238, "lon": 90.5000, "division": "Dhaka"},
    "Narsingdi": {"bn": "নরসিংদী", "lat": 23.9197, "lon": 90.7176, "division": "Dhaka"},
    "Manikganj": {"bn": "মানিকগঞ্জ", "lat": 23.8617, "lon": 90.0003, "division": "Dhaka"},
    "Munshiganj": {"bn": "মুন্সীগঞ্জ", "lat": 23.5422, "lon": 90.5305, "division": "Dhaka"},
    "Tangail": {"bn": "টাঙ্গাইল", "lat": 24.2513, "lon": 89.9167, "division": "Dhaka"},
    "Kishoreganj": {"bn": "কিশোরগঞ্জ", "lat": 24.4449, "lon": 90.7766, "division": "Dhaka"},
    "Faridpur": {"bn": "ফরিদপুর", "lat": 23.6071, "lon": 89.8429, "division": "Dhaka"},
    "Gopalganj": {"bn": "গোপালগঞ্জ", "lat": 23.0051, "lon": 89.8266, "division": "Dhaka"},
    "Madaripur": {"bn": "মাদারীপুর", "lat": 23.1641, "lon": 90.1897, "division": "Dhaka"},
    "Rajbari": {"bn": "রাজবাড়ী", "lat": 23.7574, "lon": 89.6445, "division": "Dhaka"},
    "Shariatpur": {"bn": "শরীয়তপুর", "lat": 23.2423, "lon": 90.4348, "division": "Dhaka"},

    # Chattogram Division
    "Chattogram": {"bn": "চট্টগ্রাম", "lat": 22.3569, "lon": 91.7832, "division": "Chattogram"},
    "Chittagong": {"bn": "চট্টগ্রাম", "lat": 22.3569, "lon": 91.7832, "division": "Chattogram"},
    "Cox's Bazar": {"bn": "কক্সবাজার", "lat": 21.4272, "lon": 92.0058, "division": "Chattogram"},
    "Coxsbazar": {"bn": "কক্সবাজার", "lat": 21.4272, "lon": 92.0058, "division": "Chattogram"},
    "Cumilla": {"bn": "কুমিল্লা", "lat": 23.4682, "lon": 91.1788, "division": "Chattogram"},
    "Comilla": {"bn": "কুমিল্লা", "lat": 23.4682, "lon": 91.1788, "division": "Chattogram"},
    "Brahmanbaria": {"bn": "ব্রাহ্মণবাড়িয়া", "lat": 23.9571, "lon": 91.1119, "division": "Chattogram"},
    "Chandpur": {"bn": "চাঁদপুর", "lat": 23.2333, "lon": 90.6667, "division": "Chattogram"},
    "Feni": {"bn": "ফেনী", "lat": 23.0159, "lon": 91.3976, "division": "Chattogram"},
    "Lakshmipur": {"bn": "লক্ষ্মীপুর", "lat": 22.9425, "lon": 90.8412, "division": "Chattogram"},
    "Noakhali": {"bn": "নোয়াখালী", "lat": 22.8696, "lon": 91.0998, "division": "Chattogram"},
    "Khagrachhari": {"bn": "খাগড়াছড়ি", "lat": 23.1193, "lon": 91.9847, "division": "Chattogram"},
    "Rangamati": {"bn": "রাঙ্গামাটি", "lat": 22.7324, "lon": 92.2985, "division": "Chattogram"},
    "Bandarban": {"bn": "বান্দরবান", "lat": 22.1953, "lon": 92.2184, "division": "Chattogram"},

    # Rajshahi Division
    "Rajshahi": {"bn": "রাজশাহী", "lat": 24.3745, "lon": 88.6042, "division": "Rajshahi"},
    "Bogura": {"bn": "বগুড়া", "lat": 24.8465, "lon": 89.3777, "division": "Rajshahi"},
    "Bogra": {"bn": "বগুড়া", "lat": 24.8465, "lon": 89.3777, "division": "Rajshahi"},
    "Joypurhat": {"bn": "জয়পুরহাট", "lat": 25.1015, "lon": 89.0270, "division": "Rajshahi"},
    "Naogaon": {"bn": "নওগাঁ", "lat": 24.7936, "lon": 88.9318, "division": "Rajshahi"},
    "Natore": {"bn": "নাটোর", "lat": 24.4206, "lon": 89.0003, "division": "Rajshahi"},
    "Chapainawabganj": {"bn": "চাঁপাইনবাবগঞ্জ", "lat": 24.5965, "lon": 88.2775, "division": "Rajshahi"},
    "Pabna": {"bn": "পাবনা", "lat": 24.0064, "lon": 89.2372, "division": "Rajshahi"},
    "Sirajganj": {"bn": "সিরাজগঞ্জ", "lat": 24.4534, "lon": 89.7008, "division": "Rajshahi"},

    # Rangpur Division
    "Rangpur": {"bn": "রংপুর", "lat": 25.7439, "lon": 89.2752, "division": "Rangpur"},
    "Dinajpur": {"bn": "দিনাজপুর", "lat": 25.6217, "lon": 88.6354, "division": "Rangpur"},
    "Gaibandha": {"bn": "গাইবান্ধা", "lat": 25.3288, "lon": 89.5406, "division": "Rangpur"},
    "Kurigram": {"bn": "কুড়িগ্রাম", "lat": 25.8054, "lon": 89.6362, "division": "Rangpur"},
    "Lalmonirhat": {"bn": "লালমনিরহাট", "lat": 25.9923, "lon": 89.2847, "division": "Rangpur"},
    "Nilphamari": {"bn": "নীলফামারী", "lat": 25.9318, "lon": 88.8560, "division": "Rangpur"},
    "Panchagarh": {"bn": "পঞ্চগড়", "lat": 26.3411, "lon": 88.5542, "division": "Rangpur"},
    "Thakurgaon": {"bn": "ঠাকুরগাঁও", "lat": 26.0337, "lon": 88.4617, "division": "Rangpur"},

    # Khulna Division
    "Khulna": {"bn": "খুলনা", "lat": 22.8456, "lon": 89.5403, "division": "Khulna"},
    "Bagerhat": {"bn": "বাগেরহাট", "lat": 22.6516, "lon": 89.7859, "division": "Khulna"},
    "Chuadanga": {"bn": "চুয়াডাঙ্গা", "lat": 23.6402, "lon": 88.8418, "division": "Khulna"},
    "Jashore": {"bn": "যশোর", "lat": 23.1664, "lon": 89.2081, "division": "Khulna"},
    "Jessore": {"bn": "যশোর", "lat": 23.1664, "lon": 89.2081, "division": "Khulna"},
    "Jhenaidah": {"bn": "ঝিনাইদহ", "lat": 23.5448, "lon": 89.1539, "division": "Khulna"},
    "Kushtia": {"bn": "কুষ্টিয়া", "lat": 23.9013, "lon": 89.1205, "division": "Khulna"},
    "Magura": {"bn": "মাগুরা", "lat": 23.4873, "lon": 89.4199, "division": "Khulna"},
    "Meherpur": {"bn": "মেহেরপুর", "lat": 23.7622, "lon": 88.6318, "division": "Khulna"},
    "Narail": {"bn": "নড়াইল", "lat": 23.1725, "lon": 89.5127, "division": "Khulna"},
    "Satkhira": {"bn": "সাতক্ষীরা", "lat": 22.7185, "lon": 89.0705, "division": "Khulna"},

    # Barishal Division
    "Barishal": {"bn": "বরিশাল", "lat": 22.7010, "lon": 90.3535, "division": "Barishal"},
    "Barisal": {"bn": "বরিশাল", "lat": 22.7010, "lon": 90.3535, "division": "Barishal"},
    "Barguna": {"bn": "বরগুনা", "lat": 22.0953, "lon": 90.0772, "division": "Barishal"},
    "Bhola": {"bn": "ভোলা", "lat": 22.6859, "lon": 90.6482, "division": "Barishal"},
    "Jhalokati": {"bn": "ঝালকাঠি", "lat": 22.6406, "lon": 90.1987, "division": "Barishal"},
    "Patuakhali": {"bn": "পটুয়াখালী", "lat": 22.3596, "lon": 90.3299, "division": "Barishal"},
    "Pirojpur": {"bn": "পিরোজপুর", "lat": 22.5841, "lon": 89.9720, "division": "Barishal"},

    # Sylhet Division
    "Sylhet": {"bn": "সিলেট", "lat": 24.8949, "lon": 91.8687, "division": "Sylhet"},
    "Habiganj": {"bn": "হবিগঞ্জ", "lat": 24.3749, "lon": 91.4155, "division": "Sylhet"},
    "Moulvibazar": {"bn": "মৌলভীবাজার", "lat": 24.4829, "lon": 91.7774, "division": "Sylhet"},
    "Maulvibazar": {"bn": "মৌলভীবাজার", "lat": 24.4829, "lon": 91.7774, "division": "Sylhet"},
    "Sunamganj": {"bn": "সুনামগঞ্জ", "lat": 25.0658, "lon": 91.3950, "division": "Sylhet"},

    # Mymensingh Division
    "Mymensingh": {"bn": "ময়মনসিংহ", "lat": 24.7471, "lon": 90.4203, "division": "Mymensingh"},
    "Jamalpur": {"bn": "জামালপুর", "lat": 24.9375, "lon": 89.9378, "division": "Mymensingh"},
    "Netrokona": {"bn": "নেত্রকোণা", "lat": 24.8703, "lon": 90.7279, "division": "Mymensingh"},
    "Sherpur": {"bn": "শেরপুর", "lat": 25.0205, "lon": 90.0153, "division": "Mymensingh"},
}


# =============================================================================
# 2. WMO WEATHER CODE MAPPINGS (BILINGUAL & AGRONOMIC CONTEXT)
# =============================================================================
WMO_CODE_METADATA: Dict[int, Dict[str, str]] = {
    0: {"en": "Clear sky", "bn": "পরিষ্কার আকাশ", "icon": "sun", "color": "text-amber-400"},
    1: {"en": "Mainly clear", "bn": "স্বচ্ছ রোদোজ্জ্বল", "icon": "sun", "color": "text-amber-400"},
    2: {"en": "Partly cloudy", "bn": "আংশিক মেঘলা", "icon": "cloud-sun", "color": "text-emerald-400"},
    3: {"en": "Overcast", "bn": "মেঘলা আকাশ", "icon": "cloud", "color": "text-slate-400"},
    45: {"en": "Fog", "bn": "কুয়াশাচ্ছন্ন", "icon": "cloud-fog", "color": "text-slate-300"},
    48: {"en": "Depositing rime fog", "bn": "ঘন কুয়াশা", "icon": "cloud-fog", "color": "text-slate-300"},
    51: {"en": "Light drizzle", "bn": "হালকা গুঁড়ি গুঁড়ি বৃষ্টি", "icon": "cloud-drizzle", "color": "text-sky-300"},
    53: {"en": "Moderate drizzle", "bn": "মাঝারি গুঁড়ি গুঁড়ি বৃষ্টি", "icon": "cloud-drizzle", "color": "text-sky-400"},
    55: {"en": "Dense drizzle", "bn": "ঘন গুঁড়ি গুঁড়ি বৃষ্টি", "icon": "cloud-drizzle", "color": "text-sky-400"},
    61: {"en": "Slight rain", "bn": "হালকা বৃষ্টি", "icon": "cloud-rain", "color": "text-blue-400"},
    63: {"en": "Moderate rain", "bn": "মাঝারি বৃষ্টি", "icon": "cloud-rain", "color": "text-blue-500"},
    65: {"en": "Heavy rain", "bn": "ভারী বর্ষণ", "icon": "cloud-rain-heavy", "color": "text-blue-600"},
    71: {"en": "Slight snow", "bn": "হালকা তুষারপাত", "icon": "snowflake", "color": "text-indigo-300"},
    80: {"en": "Slight rain showers", "bn": "হালকা পশলা বৃষ্টি", "icon": "cloud-rain", "color": "text-blue-400"},
    81: {"en": "Moderate rain showers", "bn": "মাঝারি পশলা বৃষ্টি", "icon": "cloud-rain", "color": "text-blue-500"},
    82: {"en": "Violent rain showers", "bn": "প্রবল পশলা বৃষ্টি", "icon": "cloud-lightning", "color": "text-purple-500"},
    95: {"en": "Thunderstorm", "bn": "বজ্রঝড় / কালবৈশাখী", "icon": "cloud-lightning", "color": "text-amber-500"},
    96: {"en": "Thunderstorm with slight hail", "bn": "শিলাবৃষ্টিসহ বজ্রঝড়", "icon": "cloud-hail", "color": "text-red-400"},
    99: {"en": "Thunderstorm with heavy hail", "bn": "তীব্র শিলাবৃষ্টি ও বজ্রঝড়", "icon": "cloud-hail", "color": "text-red-500"},
}


def get_weather_condition(code: int) -> Dict[str, str]:
    """Returns bilingual weather description and icon metadata for given WMO code."""
    return WMO_CODE_METADATA.get(
        code,
        {"en": "Variable conditions", "bn": "পরিবর্তনশীল আবহাওয়া", "icon": "cloud", "color": "text-slate-400"}
    )


# =============================================================================
# 3. PYDANTIC SCHEMAS FOR FORECAST & METRICS
# =============================================================================
class WeatherUnits(BaseModel):
    temperature: str = "°C"
    precipitation: str = "mm"
    wind_speed: str = "km/h"
    relative_humidity: str = "%"
    time: str = "iso8601"


class DailyForecastItem(BaseModel):
    date: str  # YYYY-MM-DD
    day_name_bn: str  # শনি, রবি, সোম, etc.
    day_name_en: str
    temp_min: float
    temp_max: float
    precipitation_sum_mm: float
    precipitation_probability_max: int
    relative_humidity_mean: int
    wind_speed_max_kmh: float
    weather_code: int
    condition_bn: str
    condition_en: str
    icon: str
    color: str


class CurrentWeatherSummary(BaseModel):
    as_of: str  # ISO timestamp
    temp_current: Optional[float] = None
    temp_min: float
    temp_max: float
    precipitation_mm: float
    precipitation_prob: int
    humidity: int
    wind_kmh: float
    condition_bn: str
    condition_en: str
    weather_code: int
    icon: str
    is_rainy: bool = False
    is_high_temp: bool = False
    is_cold_wave: bool = False
    is_windy: bool = False


class FarmLocationMetadata(BaseModel):
    farm_id: int
    farm_name: str
    division: str
    district: str
    upazila: str
    village: Optional[str] = None
    latitude: float
    longitude: float
    is_custom_coordinate: bool
    location_label_bn: str
    location_label_en: str


class FarmWeatherForecastResponse(BaseModel):
    status: str  # "ok" | "cached" | "unavailable"
    provider: str = "Open-Meteo API (CC BY 4.0)"
    provider_url: str = "https://open-meteo.com"
    official_bmd_reference: str = "https://bmd.gov.bd/web/"
    official_bamis_reference: str = "https://www.bamis.gov.bd/en/"
    timezone: str = "Asia/Dhaka"
    location: FarmLocationMetadata
    units: WeatherUnits = Field(default_factory=WeatherUnits)
    generated_at: str
    is_cached: bool = False
    cache_expires_at: Optional[str] = None
    current: CurrentWeatherSummary
    forecast: List[DailyForecastItem]
    message_bn: Optional[str] = None
    message_en: Optional[str] = None


# =============================================================================
# 4. WEATHER-AWARE CALENDAR ADVISORIES SCHEMAS
# =============================================================================
class CalendarWeatherAdvisory(BaseModel):
    advisory_id: str
    farm_id: int
    task_id: int
    task_title: str
    task_category: str
    task_due_date: str
    weather_variable: str  # "precipitation" | "wind" | "temperature_high" | "temperature_low" | "fog"
    forecast_value: str  # e.g., "২৫ মিমি বৃষ্টি" | "৩৮°C তাপমাত্রা"
    severity: str  # "info" | "warning" | "urgent"
    title_bn: str
    reason_bn: str
    action_suggestion_bn: str
    title_en: str
    reason_en: str
    action_suggestion_en: str
    can_reschedule: bool = True
    suggested_reschedule_days: List[int] = Field(default_factory=lambda: [1, 2, 3])
    source: str = "AgriSphere Agrometeorological Advisory Rule Engine"
    scientific_basis: str
    uncertainty_disclosure_bn: str = "এটি একটি পরিসংখ্যানগত আবহাওয়া পূর্বাভাস নির্ভর পরামর্শ; মাঠের বাস্তব পরিস্থিতি পর্যবেক্ষণ করে চূড়ান্ত সিদ্ধান্ত নিন।"
    created_at: str


class FarmCalendarAdvisoriesResponse(BaseModel):
    farm_id: int
    farm_name: str
    total_advisories: int
    advisories: List[CalendarWeatherAdvisory]
    disclaimer_bn: str = "সতর্কতা: এই পরামর্শসমূহ স্থানীয় আবহাওয়া পূর্বাভাসের সাথে সমন্বয়কৃত কৃষি সহায়তা মাত্র। এটি কোনো সরকারি দুর্যোগ সতর্কতা নয়। জাতীয় দূর্যোগে বাংলাদেশ আবহাওয়া অধিদপ্তর (BMD) ও বামিস (BAMIS) এর বিজ্ঞপ্তি অনুসরণ করুন।"
    official_warning_links: Dict[str, str] = {
        "BMD": "https://bmd.gov.bd/web/",
        "BAMIS": "https://www.bamis.gov.bd/en/",
        "FFWC_Flood": "http://ffwc.gov.bd/"
    }


class WeatherProviderStatusResponse(BaseModel):
    provider_name: str = "Open-Meteo"
    license: str = "Non-commercial free tier / CC BY 4.0"
    is_operational: bool
    last_ping_status: str
    response_time_ms: Optional[float] = None
    cache_entries: int
    official_references: Dict[str, str]
    terms_disclosure: str


class FarmLocationUpdateRequest(BaseModel):
    latitude: float = Field(..., ge=20.0, le=27.0, description="Latitude inside Bangladesh boundary (20.5 - 26.7 N)")
    longitude: float = Field(..., ge=88.0, le=93.0, description="Longitude inside Bangladesh boundary (88.0 - 92.7 E)")


# =============================================================================
# 5. SMART IN-APP REMINDER SCHEMAS
# =============================================================================
class ReminderItem(BaseModel):
    id: int
    user_id: int
    farm_id: Optional[int] = None
    farm_name: Optional[str] = None
    task_id: Optional[int] = None
    task_title: Optional[str] = None
    reminder_type: str  # "due_today" | "upcoming_task" | "overdue_task" | "weather_advisory" | "schedule_milestone"
    title_bn: str
    message_bn: str
    title_en: Optional[str] = None
    message_en: Optional[str] = None
    severity: str  # "info" | "warning" | "urgent"
    action_type: Optional[str] = None  # "reschedule" | "view_task" | "view_weather" | "open_model"
    action_payload: Optional[Dict[str, Any]] = None
    is_read: bool = False
    is_dismissed: bool = False
    created_at: str


class ReminderCounts(BaseModel):
    total_active: int
    unread_count: int
    due_today_count: int
    overdue_count: int
    weather_advisory_count: int


class ReminderListResponse(BaseModel):
    reminders: List[ReminderItem]
    counts: ReminderCounts

