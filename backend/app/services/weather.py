# Weather service, Open-Meteo adapter, caching layer, and advisory rule engine (Phase F4C)
# Strictly adheres to Open-Meteo CC BY 4.0 terms, Asia/Dhaka timezone,
# and transparent deterministic agricultural advisory rules.

import httpx
import logging
import asyncio
import time
from datetime import datetime, date, timedelta, timezone
from email.utils import parsedate_to_datetime
from unicodedata import category, normalize
from weakref import WeakValueDictionary
from typing import Optional, List, Dict, Any, Tuple
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session

from ..models.weather import (
    BANGLADESH_DISTRICT_COORDINATES,
    get_weather_condition,
    FarmLocationMetadata,
    WeatherUnits,
    DailyForecastItem,
    CurrentWeatherSummary,
    FarmWeatherForecastResponse,
    CalendarWeatherAdvisory,
    FarmCalendarAdvisoriesResponse,
    WeatherProviderStatusResponse,
)
from ..models.calendar import get_current_dhaka_date, DHAKA_TZ
from ..db import FarmProfile, CalendarTask

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 1800  # 30 minutes in-memory cache
OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast"
HTTP_TIMEOUT_SECONDS = 8.0
OPEN_METEO_DEFAULT_COOLDOWN_SECONDS = 300
VISUAL_CROSSING_URL = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline"
VISUAL_CROSSING_NAME = "Visual Crossing Weather"
VISUAL_CROSSING_SOURCE = "https://www.visualcrossing.com/"
VISUAL_CROSSING_TIMEOUT_SECONDS = 4.0
_VISUAL_CROSSING_METRICS = {
    "temperature_2m_max": "tempmax",
    "temperature_2m_min": "tempmin",
    "precipitation_sum": "precip",
    "precipitation_probability_max": "precipprob",
    "relative_humidity_2m_mean": "humidity",
    "wind_speed_10m_max": "windspeed",
}
_VISUAL_CROSSING_ICON_CODES = {
    "clear-day": 0, "clear-night": 0, "partly-cloudy-day": 2, "partly-cloudy-night": 2,
    "cloudy": 3, "fog": 45, "rain": 61, "showers-day": 80, "showers-night": 80,
    "snow": 71, "snow-showers-day": 85, "snow-showers-night": 85,
    "thunder-rain": 95, "thunder-showers-day": 95, "thunder-showers-night": 95,
}

# In-memory thread-safe forecast cache: {(lat_4dec, lon_4dec): (cached_time_epoch_float, forecast_response_dict)}
_FORECAST_CACHE: Dict[Tuple[float, float], Tuple[float, Dict[str, Any]]] = {}
_FORECAST_LOCKS: WeakValueDictionary[Tuple[float, float], asyncio.Lock] = WeakValueDictionary()
_open_meteo_retry_at = 0.0
_visual_crossing_retry_at = 0.0
_RATE_LIMIT_MESSAGE = "আবহাওয়া সেবায় অনুরোধের সীমা পৌঁছেছে। কিছুক্ষণ পর আবার চেষ্টা করুন।"

# Bengali day name mappings
BENGALI_DAY_NAMES = {
    0: "সোম",
    1: "মঙ্গল",
    2: "বুধ",
    3: "বৃহঃ",
    4: "শুক্র",
    5: "শনি",
    6: "রবি",
}

ENGLISH_DAY_NAMES = {
    0: "Mon",
    1: "Tue",
    2: "Wed",
    3: "Thu",
    4: "Fri",
    5: "Sat",
    6: "Sun",
}


# =============================================================================
# 1. DISTRICT COORDINATE RESOLUTION SERVICE
# =============================================================================
def _district_lookup_key(name: str) -> str:
    # Preserve Bengali combining marks while ignoring spaces, apostrophes, and hyphens.
    normalized = normalize("NFC", name.casefold())
    compact = "".join(char for char in normalized if category(char)[0] in "LMN")
    return compact.removesuffix("district").removesuffix("জেলা")


_DISTRICTS_BY_NAME = {
    _district_lookup_key(name): data
    for district, data in BANGLADESH_DISTRICT_COORDINATES.items()
    for name in (district, data["bn"])
}
_DISTRICT_ALIASES = {
    "jhalakathi": "Jhalokati",
    "jhalokathi": "Jhalokati",
    "khagrachari": "Khagrachhari",
    "laxmipur": "Lakshmipur",
    "netrakona": "Netrokona",
    "মুন্সিগঞ্জ": "Munshiganj",
    "রাঙামাটি": "Rangamati",
}
_DISTRICTS_BY_NAME.update(
    {_district_lookup_key(alias): BANGLADESH_DISTRICT_COORDINATES[district]
     for alias, district in _DISTRICT_ALIASES.items()}
)


def resolve_farm_coordinates(farm: FarmProfile) -> Tuple[float, float, bool, str, str]:
    """
    Resolves the latitude and longitude for a given farm.
    If the farm has custom coordinates, uses them.
    Otherwise, resolves from verified district centroid coordinates.
    Returns: (lat, lon, is_custom, label_bn, label_en)
    """
    if farm.latitude is not None and farm.longitude is not None:
        label_bn = f"{farm.name} — নিজস্ব নির্ধারিত স্থানাঙ্ক ({farm.latitude:.4f}° N, {farm.longitude:.4f}° E)"
        label_en = f"{farm.name} — Custom coordinates ({farm.latitude:.4f}° N, {farm.longitude:.4f}° E)"
        return farm.latitude, farm.longitude, True, label_bn, label_en

    # Lookup district centroid
    dist_clean = (farm.district or "").strip()
    match = _DISTRICTS_BY_NAME.get(_district_lookup_key(dist_clean))
    if not match and dist_clean:
        # Keep the existing partial English lookup for legacy farm profiles.
        district = dist_clean.casefold()
        match = next(
            (data for key, data in BANGLADESH_DISTRICT_COORDINATES.items() if district in key.casefold()),
            None,
        )

    if match:
        lat = match["lat"]
        lon = match["lon"]
        dist_bn = match["bn"]
        label_bn = f"{dist_bn} জেলা সদর (আনুমানিক কেন্দ্র: {lat:.4f}° N, {lon:.4f}° E)"
        label_en = f"{dist_clean} District Centroid (Approx: {lat:.4f}° N, {lon:.4f}° E)"
        return lat, lon, False, label_bn, label_en

    # Fallback to Dhaka central centroid if completely unknown, clearly disclosed
    default_lat, default_lon = 23.8103, 90.4125
    label_bn = f"ঢাকা কেন্দ্র (সাধারণ রেফারেন্স পয়েন্ট: {default_lat:.4f}° N, {default_lon:.4f}° E)"
    label_en = f"Dhaka Central (Default reference: {default_lat:.4f}° N, {default_lon:.4f}° E)"
    return default_lat, default_lon, False, label_bn, label_en


# =============================================================================
# 2. OPEN-METEO WEATHER PROVIDER WITH CACHING & ERROR HANDLING
# =============================================================================
async def fetch_open_meteo_forecast(
    latitude: float,
    longitude: float,
    bypass_cache: bool = False
) -> Tuple[Optional[Dict[str, Any]], bool, Optional[str]]:
    """
    Fetches raw forecast data from Open-Meteo API with in-memory caching.
    Returns: (raw_data_dict_or_None, is_from_cache, error_message_or_None)
    """
    cache_key = (round(latitude, 4), round(longitude, 4))
    requested_at = time.time()
    lock = _FORECAST_LOCKS.get(cache_key)
    if lock is None:
        lock = asyncio.Lock()
        _FORECAST_LOCKS[cache_key] = lock

    async with lock:
        cached = _FORECAST_CACHE.get(cache_key)
        if cached:
            cached_at, payload = cached
            fresh = (
                time.time() - cached_at < CACHE_TTL_SECONDS
                and payload["daily"]["time"][0] == get_current_dhaka_date()
            )
            if fresh and (not bypass_cache or cached_at >= requested_at):
                return payload, True, None

        if time.monotonic() < _open_meteo_retry_at:
            result = _cached_forecast_or_error(cache_key, _RATE_LIMIT_MESSAGE)
        else:
            result = await _request_open_meteo_forecast(latitude, longitude, cache_key)
        if result[0] is not None or time.monotonic() >= _open_meteo_retry_at:
            return result
        return await _request_visual_crossing_forecast(cache_key)


def _cached_forecast_or_error(cache_key, message):
    cached = _FORECAST_CACHE.get(cache_key)
    if cached and cached[1]["daily"]["time"][-1] >= get_current_dhaka_date():
        return cached[1], True, message
    return None, False, message


def _rate_limit_delay(retry_after: str | None) -> float:
    if retry_after:
        try:
            return max(1, int(retry_after))
        except ValueError:
            try:
                retry_date = parsedate_to_datetime(retry_after)
                if retry_date.tzinfo is None:
                    retry_date = retry_date.replace(tzinfo=timezone.utc)
                return max(1, (retry_date - datetime.now(timezone.utc)).total_seconds())
            except (ValueError, TypeError, OverflowError):
                pass
    return OPEN_METEO_DEFAULT_COOLDOWN_SECONDS


async def _request_open_meteo_forecast(latitude: float, longitude: float, cache_key):
    global _open_meteo_retry_at
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": [
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "precipitation_probability_max",
            "relative_humidity_2m_mean",
            "wind_speed_10m_max",
            "weather_code",
        ],
        "current": ["temperature_2m", "weather_code"],
        "forecast_days": 7,
        "timezone": "Asia/Dhaka",
    }

    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
            resp = await client.get(OPEN_METEO_BASE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
            if not isinstance(data, dict) or not data.get("daily", {}).get("time"):
                raise ValueError("Open-Meteo returned no daily forecast")

            # Save in cache
            data["_agrisphere_fetched_at"] = datetime.now(DHAKA_TZ).isoformat()
            _FORECAST_CACHE[cache_key] = (time.time(), data)
            return data, False, None

    except httpx.HTTPStatusError as error:
        status_code = error.response.status_code
        if status_code == 429:
            delay = _rate_limit_delay(error.response.headers.get("Retry-After"))
            _open_meteo_retry_at = max(_open_meteo_retry_at, time.monotonic() + delay)
            logger.warning("Open-Meteo returned HTTP 429; pausing requests for %.0f seconds", delay)
            return _cached_forecast_or_error(cache_key, _RATE_LIMIT_MESSAGE)
        logger.warning("Open-Meteo forecast request failed with HTTP %s", status_code)
        return _cached_forecast_or_error(cache_key, "আবহাওয়া সার্ভার থেকে তথ্য পাওয়া যায়নি।")
    except httpx.TimeoutException:
        logger.warning("Open-Meteo request timed out for coordinates (%s, %s)", latitude, longitude)
        return _cached_forecast_or_error(cache_key, "আবহাওয়া সেবা অনুরোধের সময়সীমা অতিক্রম করেছে।")
    except (httpx.RequestError, ValueError) as error:
        logger.warning("Open-Meteo forecast request did not return forecast data: %s", type(error).__name__)
        return _cached_forecast_or_error(cache_key, "আবহাওয়া সার্ভার থেকে তথ্য পাওয়া যায়নি।")


async def _request_visual_crossing_forecast(cache_key):
    global _visual_crossing_retry_at
    if time.monotonic() < _visual_crossing_retry_at:
        return _cached_forecast_or_error(cache_key, _RATE_LIMIT_MESSAGE)

    latitude, longitude = cache_key
    start = date.fromisoformat(get_current_dhaka_date())
    end = start + timedelta(days=6)
    params = {
        "unitGroup": "metric",
        "include": "days,current",
        "elements": "datetime,datetimeEpoch,temp,tempmax,tempmin,precip,precipprob,humidity,windspeed,icon",
        "contentType": "json",
    }
    try:
        async with httpx.AsyncClient(timeout=VISUAL_CROSSING_TIMEOUT_SECONDS) as client:
            response = await client.get(
                f"{VISUAL_CROSSING_URL}/{latitude:.4f},{longitude:.4f}/{start}/{end}",
                params=params,
                headers={"Accept-Encoding": "gzip"},
            )
            response.raise_for_status()
            data = _adapt_visual_crossing_forecast(response.json(), start, end)
            _FORECAST_CACHE[cache_key] = (time.time(), data)
            return data, False, None
    except httpx.HTTPStatusError as error:
        status = error.response.status_code
        if status == 429:
            delay = _rate_limit_delay(error.response.headers.get("Retry-After"))
            _visual_crossing_retry_at = max(_visual_crossing_retry_at, time.monotonic() + delay)
        logger.warning("Visual Crossing forecast request failed with HTTP %s", status)
    except (httpx.RequestError, ValueError, OverflowError) as error:
        logger.warning("Visual Crossing forecast unavailable: %s", type(error).__name__)
    return _cached_forecast_or_error(cache_key, _RATE_LIMIT_MESSAGE)


def _adapt_visual_crossing_forecast(payload, start: date, end: date):
    if not isinstance(payload, dict) or payload.get("timezone") != "Asia/Dhaka":
        raise ValueError("Expected a forecast in Asia/Dhaka")
    rows = {
        row["datetime"]: row
        for row in (payload.get("days") or [])
        if isinstance(row, dict) and isinstance(row.get("datetime"), str)
    }
    days = [(start + timedelta(days=index)).isoformat() for index in range((end - start).days + 1)]
    if any(
        day not in rows or any(
            not isinstance(rows[day].get(field), (float, int))
            for field in _VISUAL_CROSSING_METRICS.values()
        )
        for day in days
    ):
        raise ValueError("Incomplete Visual Crossing daily forecast")
    daily = {"time": days}
    for key, field in _VISUAL_CROSSING_METRICS.items():
        daily[key] = [rows[day][field] for day in days]
    daily["weather_code"] = [_VISUAL_CROSSING_ICON_CODES.get(rows[day].get("icon"), -1) for day in days]

    current = {}
    conditions = payload.get("currentConditions")
    if isinstance(conditions, dict) and isinstance(conditions.get("datetimeEpoch"), (float, int)):
        current = {
            "time": datetime.fromtimestamp(conditions["datetimeEpoch"], DHAKA_TZ).isoformat(),
            "temperature_2m": conditions.get("temp"),
            "weather_code": _VISUAL_CROSSING_ICON_CODES.get(conditions.get("icon"), -1),
        }
    return {
        "daily": daily,
        "current": current,
        "_agrisphere_fetched_at": datetime.now(DHAKA_TZ).isoformat(),
        "_agrisphere_provider": VISUAL_CROSSING_NAME,
        "_agrisphere_provider_url": VISUAL_CROSSING_SOURCE,
    }


# =============================================================================
# 3. FORECAST NORMALIZATION SERVICE
# =============================================================================
def normalize_open_meteo_response(
    raw_data: Optional[Dict[str, Any]],
    farm: FarmProfile,
    is_cached: bool = False,
    error_msg: Optional[str] = None
) -> FarmWeatherForecastResponse:
    """
    Normalizes Open-Meteo raw daily forecast JSON into our strict Pydantic model.
    If raw_data is None, returns clean 'unavailable' state without inventing fake values.
    """
    lat, lon, is_custom, label_bn, label_en = resolve_farm_coordinates(farm)
    now_iso = datetime.now(DHAKA_TZ).isoformat()

    location_meta = FarmLocationMetadata(
        farm_id=farm.id,
        farm_name=farm.name,
        division=farm.division,
        district=farm.district,
        upazila=farm.upazila,
        village=farm.village,
        latitude=lat,
        longitude=lon,
        is_custom_coordinate=is_custom,
        location_label_bn=label_bn,
        location_label_en=label_en,
    )

    if not raw_data or "daily" not in raw_data:
        # Transparent Unavailable State — Never invent fake weather data
        return FarmWeatherForecastResponse(
            status="unavailable",
            generated_at=now_iso,
            location=location_meta,
            current=CurrentWeatherSummary(
                as_of=now_iso,
                temp_min=0.0,
                temp_max=0.0,
                precipitation_mm=0.0,
                precipitation_prob=0,
                humidity=0,
                wind_kmh=0.0,
                condition_bn="আবহাওয়ার তথ্য এখন পাওয়া যাচ্ছে না",
                condition_en="Weather data currently unavailable",
                weather_code=-1,
                icon="cloud-off",
            ),
            forecast=[],
            message_bn=error_msg or "আবহাওয়ার তথ্য এখন পাওয়া যাচ্ছে না। আপনার সংরক্ষিত ক্যালেন্ডার ও কাজগুলো স্বাভাবিকভাবে ব্যবহার করা যাবে।",
            message_en="Weather data is temporarily unavailable. Your saved calendar and farming tasks remain fully functional.",
        )

    daily = raw_data["daily"]
    dates = daily.get("time", [])
    max_temps = daily.get("temperature_2m_max", [])
    min_temps = daily.get("temperature_2m_min", [])
    precip_sums = daily.get("precipitation_sum", [])
    precip_probs = daily.get("precipitation_probability_max", [])
    humidities = daily.get("relative_humidity_2m_mean", [])
    winds = daily.get("wind_speed_10m_max", [])
    codes = daily.get("weather_code", [])

    daily_items: List[DailyForecastItem] = []
    n = min(len(dates), len(max_temps), len(min_temps), len(precip_sums))

    for i in range(n):
        dt_str = dates[i]
        try:
            d_obj = datetime.strptime(dt_str, "%Y-%m-%d").date()
            weekday = d_obj.weekday()
            day_bn = BENGALI_DAY_NAMES.get(weekday, "")
            day_en = ENGLISH_DAY_NAMES.get(weekday, "")
        except Exception:
            day_bn = ""
            day_en = ""

        w_code = int(codes[i]) if i < len(codes) and codes[i] is not None else 0
        cond_meta = get_weather_condition(w_code)

        daily_items.append(
            DailyForecastItem(
                date=dt_str,
                day_name_bn=day_bn,
                day_name_en=day_en,
                temp_min=round(float(min_temps[i]), 1) if min_temps[i] is not None else 0.0,
                temp_max=round(float(max_temps[i]), 1) if max_temps[i] is not None else 0.0,
                precipitation_sum_mm=round(float(precip_sums[i]), 1) if precip_sums[i] is not None else 0.0,
                precipitation_probability_max=int(precip_probs[i]) if i < len(precip_probs) and precip_probs[i] is not None else 0,
                relative_humidity_mean=int(humidities[i]) if i < len(humidities) and humidities[i] is not None else 0,
                wind_speed_max_kmh=round(float(winds[i]), 1) if i < len(winds) and winds[i] is not None else 0.0,
                weather_code=w_code,
                condition_bn=cond_meta["bn"],
                condition_en=cond_meta["en"],
                icon=cond_meta["icon"],
                color=cond_meta["color"],
            )
        )

    # Prefer today's row. Keep the first-row fallback for existing forecast consumers.
    today_key = now_iso[:10]
    today_item = next((item for item in daily_items if item.date == today_key), daily_items[0] if daily_items else None)
    if today_item:
        current = raw_data.get("current") or {}
        current_time = current.get("time")
        is_current_today = isinstance(current_time, str) and current_time[:10] == today_key
        current_temp = current.get("temperature_2m") if is_current_today else None
        current_code = current.get("weather_code") if is_current_today else None
        current_condition = get_weather_condition(current_code) if isinstance(current_code, int) else None
        current_summary = CurrentWeatherSummary(
            as_of=datetime.fromisoformat(current_time).replace(tzinfo=DHAKA_TZ).isoformat() if is_current_today else now_iso,
            temp_current=current_temp,
            temp_min=today_item.temp_min,
            temp_max=today_item.temp_max,
            precipitation_mm=today_item.precipitation_sum_mm,
            precipitation_prob=today_item.precipitation_probability_max,
            humidity=today_item.relative_humidity_mean,
            wind_kmh=today_item.wind_speed_max_kmh,
            condition_bn=current_condition["bn"] if current_condition else today_item.condition_bn,
            condition_en=current_condition["en"] if current_condition else today_item.condition_en,
            weather_code=current_code if current_condition else today_item.weather_code,
            icon=current_condition["icon"] if current_condition else today_item.icon,
            is_rainy=today_item.precipitation_sum_mm >= 5.0 or today_item.precipitation_probability_max >= 60,
            is_high_temp=today_item.temp_max >= 35.0,
            is_cold_wave=today_item.temp_min <= 11.0,
            is_windy=today_item.wind_speed_max_kmh >= 28.0,
        )
    else:
        current_summary = CurrentWeatherSummary(
            as_of=now_iso,
            temp_min=0.0,
            temp_max=0.0,
            precipitation_mm=0.0,
            precipitation_prob=0,
            humidity=0,
            wind_kmh=0.0,
            condition_bn="তথ্য পাওয়া যায়নি",
            condition_en="No data",
            weather_code=0,
            icon="cloud",
        )

    fetched_at = raw_data.get("_agrisphere_fetched_at")
    cache_expires = (
        (datetime.fromisoformat(fetched_at) + timedelta(seconds=CACHE_TTL_SECONDS)).isoformat()
        if is_cached and fetched_at else None
    )

    return FarmWeatherForecastResponse(
        status="cached" if is_cached else "ok",
        provider=raw_data.get("_agrisphere_provider", "Open-Meteo API (CC BY 4.0)"),
        provider_url=raw_data.get("_agrisphere_provider_url", "https://open-meteo.com"),
        generated_at=fetched_at or now_iso,
        is_cached=is_cached,
        cache_expires_at=cache_expires,
        location=location_meta,
        current=current_summary,
        forecast=daily_items,
        message_bn=error_msg,
    )


# =============================================================================
# 4. WEATHER-AWARE AGRICULTURAL CALENDAR ADVISORY RULE ENGINE
# =============================================================================
def generate_weather_advisories_for_tasks(
    farm: FarmProfile,
    tasks: List[CalendarTask],
    forecast_items: List[DailyForecastItem]
) -> List[CalendarWeatherAdvisory]:
    """
    Evaluates transparent deterministic agronomic rules matching farmer's pending tasks
    against the 7-day weather forecast.
    Strictly follows BAMIS & BRRI field guidelines.
    Never alters, cancels, or moves tasks automatically.
    """
    advisories: List[CalendarWeatherAdvisory] = []
    forecast_by_date = {item.date: item for item in forecast_items}
    now_str = datetime.now(DHAKA_TZ).strftime("%Y-%m-%d %H:%M")

    for task in tasks:
        if task.status in ["completed", "cancelled"]:
            continue

        task_date = task.due_date
        weather = forecast_by_date.get(task_date)
        if not weather:
            continue

        cat = (task.category or "general").lower()
        title = task.title

        # RULE 1: Heavy Rain on Fertilizer / Nutrient Application
        if (
            cat in ["nutrient_management", "fertilizer_nutrient"] or
            any(kw in title for kw in ["সার", "ইউরিয়া", "ডিএপি", "পটাশ", "fertilizer", "urea"])
        ) and (weather.precipitation_sum_mm >= 12.0 or weather.precipitation_probability_max >= 70):
            advisories.append(
                CalendarWeatherAdvisory(
                    advisory_id=f"adv_rain_fert_{task.id}_{task_date}",
                    farm_id=farm.id,
                    task_id=task.id,
                    task_title=task.title,
                    task_category=task.category,
                    task_due_date=task_date,
                    weather_variable="precipitation",
                    forecast_value=f"{weather.precipitation_sum_mm:.1f} মিমি বৃষ্টিপাত (সম্ভাবনা {weather.precipitation_probability_max}%)",
                    severity="warning" if weather.precipitation_sum_mm < 25.0 else "urgent",
                    title_bn="সার প্রয়োগে ভারী বৃষ্টির সতর্কতা",
                    reason_bn=f"{task_date} তারিখে {weather.precipitation_sum_mm:.1f} মিমি বৃষ্টির পূর্বাভাস রয়েছে। সার ছিটালে তা পানির সাথে ভেসে অপচয় হওয়ার উচ্চ ঝুঁকি থাকে।",
                    action_suggestion_bn="বৃষ্টি কমে গিয়ে মাটি কিছুটা শুকালে অথবা রোদোজ্জ্বল দিনে সার প্রয়োগ পুনর্নির্ধারণ করুন (+১ বা +২ দিন)।",
                    title_en="Heavy Rain Alert for Fertilizer Application",
                    reason_en=f"Forecast of {weather.precipitation_sum_mm:.1f} mm rain on {task_date}. Fertilizer will wash away, causing nutrient loss.",
                    action_suggestion_en="Consider rescheduling fertilizer application to a dry sunny day (+1 or +2 days).",
                    suggested_reschedule_days=[1, 2, 3],
                    scientific_basis="BARC FRG-2018 / BAMIS Water & Nutrient Handbook: Avoid surface broadcasting before expected rainfall > 10mm.",
                    created_at=now_str,
                )
            )

        # RULE 2: Heavy Rain or High Wind on Pest Scouting & Spraying
        elif (
            cat in ["crop_observation", "pest_disease_scouting"] or
            any(kw in title for kw in ["কীটনাশক", "স্প্রে", "বালাই", "রোগ", "পোকামাকড়", "spray", "pesticide"])
        ) and (weather.precipitation_sum_mm >= 8.0 or weather.wind_speed_max_kmh >= 25.0):
            reason_parts = []
            if weather.precipitation_sum_mm >= 8.0:
                reason_parts.append(f"বৃষ্টিপাত {weather.precipitation_sum_mm:.1f} মিমি")
            if weather.wind_speed_max_kmh >= 25.0:
                reason_parts.append(f"বাতাসের বেগ {weather.wind_speed_max_kmh:.1f} কিমি/ঘণ্টা")
            reason_txt = ", ".join(reason_parts)

            advisories.append(
                CalendarWeatherAdvisory(
                    advisory_id=f"adv_spray_{task.id}_{task_date}",
                    farm_id=farm.id,
                    task_id=task.id,
                    task_title=task.title,
                    task_category=task.category,
                    task_due_date=task_date,
                    weather_variable="precipitation" if weather.precipitation_sum_mm >= 8.0 else "wind",
                    forecast_value=reason_txt,
                    severity="warning",
                    title_bn="কীটনাশক বা বালাইনাশক স্প্রে স্থগিতের পরামর্শ",
                    reason_bn=f"{task_date} তারিখে {reason_txt} দেখা যাচ্ছে। বৃষ্টির পানিতে স্প্রে ধুয়ে যাবে এবং বাতাসের কারণে ওষুধ সঠিক গাছে পৌঁছাবে না।",
                    action_suggestion_bn="শান্ত ও শুষ্ক আবহাওয়ায় (বাতাস ২০ কিমি/ঘণ্টার কম) স্প্রে করার দিন নির্ধারণ করুন।",
                    title_en="Postpone Pesticide Spraying Advisory",
                    reason_en=f"Adverse weather on {task_date}: {reason_txt}. Rain washes off active ingredients and wind causes severe drift.",
                    action_suggestion_en="Reschedule spraying for a calm dry morning or late afternoon.",
                    suggested_reschedule_days=[1, 2, 3],
                    scientific_basis="BRRI Modern Rice Cultivation Chapter 6: Plant Protection Spray Conditions.",
                    created_at=now_str,
                )
            )

        # RULE 3: Irrigation Review when Significant Rain is Forecast
        elif (
            cat in ["irrigation"] or
            any(kw in title for kw in ["সেচ", "পানি", "irrigation", "awd", "water"])
        ) and (weather.precipitation_sum_mm >= 15.0 or weather.precipitation_probability_max >= 75):
            advisories.append(
                CalendarWeatherAdvisory(
                    advisory_id=f"adv_irrig_{task.id}_{task_date}",
                    farm_id=farm.id,
                    task_id=task.id,
                    task_title=task.title,
                    task_category=task.category,
                    task_due_date=task_date,
                    weather_variable="precipitation",
                    forecast_value=f"{weather.precipitation_sum_mm:.1f} মিমি প্রত্যাশিত বৃষ্টিপাত",
                    severity="info",
                    title_bn="প্রাকৃতিক বৃষ্টির পূর্বাভাসে সেচ পর্যালোচনা",
                    reason_bn=f"{task_date} তারিখে পর্যাপ্ত বৃষ্টির ({weather.precipitation_sum_mm:.1f} মিমি) পূর্বাভাস রয়েছে। কৃত্রিম সেচ দিলে জমিতে অতিরিক্ত পানি জমে ক্ষতি হতে পারে।",
                    action_suggestion_bn="সেচ পাম্প সাময়িক বন্ধ রেখে জ্বালানি সাশ্রয় করুন এবং জমির নিষ্কাশন নালা পরিষ্কার রাখুন।",
                    title_en="Review Irrigation due to Forecast Rainfall",
                    reason_en=f"Sufficient rainfall ({weather.precipitation_sum_mm:.1f} mm) is forecast for {task_date}. Artificial irrigation will cause waterlogging.",
                    action_suggestion_en="Hold off on artificial irrigation to save pump energy, and check field drainage.",
                    suggested_reschedule_days=[2, 3],
                    scientific_basis="BAMIS Water Resource Management: AWD Rain Integration Protocol.",
                    created_at=now_str,
                )
            )

        # RULE 4: Harvesting in Unfavorable Rain or Storm
        elif (
            cat in ["harvest_planning", "harvest"] or
            any(kw in title for kw in ["ফসল কাটা", "মাড়াই", "harvest", "cutting", "threshing"])
        ) and (weather.precipitation_sum_mm >= 10.0 or weather.wind_speed_max_kmh >= 30.0):
            advisories.append(
                CalendarWeatherAdvisory(
                    advisory_id=f"adv_harv_{task.id}_{task_date}",
                    farm_id=farm.id,
                    task_id=task.id,
                    task_title=task.title,
                    task_category=task.category,
                    task_due_date=task_date,
                    weather_variable="precipitation",
                    forecast_value=f"বৃষ্টি {weather.precipitation_sum_mm:.1f} মিমি, বাতাস {weather.wind_speed_max_kmh:.1f} কিমি/ঘণ্টা",
                    severity="urgent",
                    title_bn="ফসল কর্তন ও মাড়াইয়ে দুর্যোগ সতর্কতা",
                    reason_bn=f"{task_date} তারিখে বৃষ্টি ও দমকা বাতাসের পূর্বাভাস রয়েছে। ভেজা ফসল মাড়াই বা শুকাতে সমস্যা হতে পারে এবং দানা ঝরে যেতে পারে।",
                    action_suggestion_bn="বৃষ্টি শুরুর পূর্বেই দ্রুত পাকা ফসল কেটে নিরাপদ শুকনো স্থানে সংরক্ষণ করুন অথবা শুষ্ক দিনে মাড়াইয়ের তারিখ নির্ধারণ করুন।",
                    title_en="Harvest Advisory for Approaching Rain/Wind",
                    reason_en=f"Adverse harvest conditions forecast on {task_date}: rain and gusts will spoil cut crops and hinder drying.",
                    action_suggestion_en="Harvest ahead of rain or prepare covered threshing yards and tarpaulins.",
                    suggested_reschedule_days=[1, 2],
                    scientific_basis="DAE Post-Harvest Loss Prevention Guidelines & BAMIS Crop Weather Bulletins.",
                    created_at=now_str,
                )
            )

        # RULE 5: Severe Cold Wave / Dense Fog on Seedbed / Nursery
        elif (
            cat in ["sowing", "transplanting", "land_preparation"] or
            any(kw in title for kw in ["বীজতলা", "চারা", "seedbed", "nursery"])
        ) and (weather.temp_min <= 11.0 or weather.weather_code in [45, 48]):
            advisories.append(
                CalendarWeatherAdvisory(
                    advisory_id=f"adv_cold_{task.id}_{task_date}",
                    farm_id=farm.id,
                    task_id=task.id,
                    task_title=task.title,
                    task_category=task.category,
                    task_due_date=task_date,
                    weather_variable="temperature_low",
                    forecast_value=f"সর্বনিম্ন তাপমাত্রা {weather.temp_min:.1f}°C ও কুয়াশা",
                    severity="warning",
                    title_bn="শৈত্যপ্রবাহ ও ঘন কুয়াশায় বীজতলা সুরক্ষা পরামর্শ",
                    reason_bn=f"{task_date} তারিখে তাপমাত্রা {weather.temp_min:.1f}°C এ নেমে যাওয়ার এবং ঘন কুয়াশার পূর্বাভাস রয়েছে। ঠান্ডায় চারা হলুদ ও ব্লাস্ট রোগে আক্রান্ত হতে পারে।",
                    action_suggestion_bn="রাতে বীজতলা পলিথিন শিট দিয়ে ঢেকে দিন এবং সকালে শিশির ঝেড়ে ফেলুন।",
                    title_en="Cold Wave & Fog Advisory for Young Seedlings",
                    reason_en=f"Minimum temperature dropping to {weather.temp_min:.1f}°C with dense fog. Cold stress causes seedling stunting and blast.",
                    action_suggestion_en="Cover nursery beds with clear polythene sheets at night and shake off morning dew.",
                    suggested_reschedule_days=[1, 2, 3],
                    scientific_basis="BRRI Modern Rice Cultivation Chapter 3: Cold Wave Management in Boro Seedbeds.",
                    created_at=now_str,
                )
            )

    return advisories
