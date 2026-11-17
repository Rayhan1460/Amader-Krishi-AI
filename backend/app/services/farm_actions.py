# Service for Phase F6C-1: Contextual Farm Action Center Backend Foundation
# Strictly read-only, deterministic, rule-based review item compilation.
# Reuses existing Farm Intelligence aggregation architecture.
# Zero synthetic risk scores, zero automated diagnoses, zero chemical/pesticide dosage instructions.

import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

from sqlalchemy.orm import Session

from ..db import FarmProfile, User
from ..models.calendar import get_current_dhaka_date, get_current_dhaka_datetime, DHAKA_TZ
from ..models.farm_actions import FarmActionItem, FarmActionsResponse
from ..models.farm_twin import FarmTaskSummaryItem
from ..services.farm_intelligence import build_farm_intelligence_summary

logger = logging.getLogger(__name__)

PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


async def generate_farm_actions(
    db: Session,
    farm: FarmProfile,
    current_user: User,
    fetch_weather_fn: Optional[Any] = None,
) -> FarmActionsResponse:
    """
    Compiles deterministic, rule-based contextual review items for an authenticated farm.
    Reuses existing Farm Intelligence aggregation, ensuring zero duplicate database models
    and zero database mutations.
    """
    today_dhaka = get_current_dhaka_date()
    now_dhaka_str = get_current_dhaka_datetime().isoformat()

    # 1. Reuse existing Farm Intelligence aggregation
    intelligence = await build_farm_intelligence_summary(
        db=db,
        farm=farm,
        current_user=current_user,
        fetch_weather_fn=fetch_weather_fn,
    )

    actions: List[FarmActionItem] = []
    seen_action_ids = set()

    def add_action(item: FarmActionItem):
        if item.action_id not in seen_action_ids:
            seen_action_ids.add(item.action_id)
            actions.append(item)

    # -------------------------------------------------------------------------
    # RULE A — OVERDUE CALENDAR TASK
    # -------------------------------------------------------------------------
    overdue_tasks = intelligence.upcoming_actions.overdue_tasks or []
    for task in overdue_tasks:
        crop_prefix_bn = f"{task.crop_name}: " if task.crop_name else ""
        crop_prefix_en = f"{task.crop_name}: " if task.crop_name else ""
        add_action(
            FarmActionItem(
                action_id=f"act-overdue-task-{task.id}",
                rule_id="overdue_task",
                farm_id=farm.id,
                crop_id=task.crop_id,
                related_record_id=task.id,
                title_bn=f"বকেয়া কাজ পর্যালোচনা: {crop_prefix_bn}{task.title}",
                title_en=f"Review Overdue Task: {crop_prefix_en}{task.title}",
                explanation_bn=(
                    f"ক্যালেন্ডারে নির্ধারিত তারিখ ({task.due_date}) অতিক্রান্ত হয়েছে। "
                    "মাঠের অবস্থা যাচাই করে কাজটি সম্পন্ন হয়েছে কিনা চিহ্নিত করুন অথবা সময় পুনর্নির্ধারণ করুন।"
                ),
                explanation_en=(
                    f"Scheduled due date ({task.due_date}) has passed. "
                    "Verify field conditions to confirm completion or reschedule in the calendar."
                ),
                priority="high",
                source_module="calendar",
                source_date=task.due_date,
                data_freshness="dated",
                destination_tab="calendar",
            )
        )

    # -------------------------------------------------------------------------
    # RULE B — UPCOMING CALENDAR TASK (Due today or within 7 days)
    # -------------------------------------------------------------------------
    due_today_tasks = intelligence.upcoming_actions.due_today_tasks or []
    for task in due_today_tasks:
        crop_prefix_bn = f"{task.crop_name}: " if task.crop_name else ""
        crop_prefix_en = f"{task.crop_name}: " if task.crop_name else ""
        add_action(
            FarmActionItem(
                action_id=f"act-today-task-{task.id}",
                rule_id="upcoming_task",
                farm_id=farm.id,
                crop_id=task.crop_id,
                related_record_id=task.id,
                title_bn=f"আজকের করণীয় কাজ: {crop_prefix_bn}{task.title}",
                title_en=f"Task Due Today: {crop_prefix_en}{task.title}",
                explanation_bn=(
                    f"আজ ({task.due_date}) এই কাজটি সম্পন্ন করার নির্ধারিত দিন। "
                    "প্রয়োজনীয় কৃষি উপকরণ ও শ্রম প্রস্তুত রাখুন।"
                ),
                explanation_en=(
                    f"This task is scheduled for today ({task.due_date}). "
                    "Prepare required agricultural inputs and resources."
                ),
                priority="high",
                source_module="calendar",
                source_date=task.due_date,
                data_freshness="current",
                destination_tab="calendar",
            )
        )

    upcoming_tasks = intelligence.upcoming_actions.upcoming_tasks or []
    for task in upcoming_tasks:
        crop_prefix_bn = f"{task.crop_name}: " if task.crop_name else ""
        crop_prefix_en = f"{task.crop_name}: " if task.crop_name else ""
        add_action(
            FarmActionItem(
                action_id=f"act-upcoming-task-{task.id}",
                rule_id="upcoming_task",
                farm_id=farm.id,
                crop_id=task.crop_id,
                related_record_id=task.id,
                title_bn=f"আসন্ন কৃষি কাজ: {crop_prefix_bn}{task.title}",
                title_en=f"Upcoming Task: {crop_prefix_en}{task.title}",
                explanation_bn=(
                    f"আগামী ৭ দিনের মধ্যে ({task.due_date}) করণীয় কাজ। "
                    "মাঠের অগ্রগতি ও আবহাওয়া অনুযায়ী প্রস্তুতি গ্রহণ করুন।"
                ),
                explanation_en=(
                    f"Task due in the next 7 days ({task.due_date}). "
                    "Prepare according to field progress and local weather."
                ),
                priority="medium",
                source_module="calendar",
                source_date=task.due_date,
                data_freshness="current",
                destination_tab="calendar",
            )
        )

    # -------------------------------------------------------------------------
    # RULE C — NO SOIL TEST INFORMATION
    # -------------------------------------------------------------------------
    if not intelligence.soil_summary.has_soil_test or intelligence.soil_summary.total_tests_count == 0:
        add_action(
            FarmActionItem(
                action_id=f"act-missing-soil-test-{farm.id}",
                rule_id="missing_soil_test",
                farm_id=farm.id,
                crop_id=None,
                related_record_id=None,
                title_bn="মাটি পরীক্ষার তথ্য অনুপস্থিত",
                title_en="No Soil Test Record on File",
                explanation_bn=(
                    "এই খামারের জন্য এখনো কোনো মাটি পরীক্ষার রিপোর্ট যোগ করা হয়নি। "
                    "মাটির পুষ্টি উপাত্ত (pH, N, P, K) যুক্ত করলে সুনির্দিষ্ট সার ও ফসল সুপারিশ পাওয়া সম্ভব।"
                ),
                explanation_en=(
                    "No soil test reports are recorded for this farm parcel. "
                    "Adding laboratory or field soil data unlocks precision fertilizer and crop recommendations."
                ),
                priority="low",
                source_module="soil_health",
                source_date=None,
                data_freshness="missing",
                destination_tab="soil_health",
            )
        )

    # -------------------------------------------------------------------------
    # RULE D — FARMER-REPORTED FIELD ISSUE
    # -------------------------------------------------------------------------
    observations = intelligence.observations_summary.recent_observations or []
    for obs in observations:
        cond = (obs.farmer_reported_condition or "").lower().strip()
        if cond in ["minor_issue", "moderate_issue", "severe_issue"]:
            if cond == "severe_issue":
                prio = "high"
                label_bn = "মারাত্মক লক্ষণ"
                label_en = "severe symptoms"
            elif cond == "moderate_issue":
                prio = "medium"
                label_bn = "মাঝারি লক্ষণ"
                label_en = "moderate symptoms"
            else:
                prio = "low"
                label_bn = "সামান্য লক্ষণ"
                label_en = "minor symptoms"

            crop_name = obs.crop_name or "ফসলে"
            symptoms = obs.visible_symptoms or obs.title
            add_action(
                FarmActionItem(
                    action_id=f"act-field-issue-obs-{obs.id}",
                    rule_id="farmer_reported_issue",
                    farm_id=farm.id,
                    crop_id=obs.crop_id,
                    related_record_id=obs.id,
                    title_bn=f"মাঠ পর্যায়ের লক্ষণ পর্যালোচনা: {crop_name}",
                    title_en=f"Review Field Symptoms: {crop_name}",
                    explanation_bn=(
                        f"মাঠ পরিদর্শনে '{symptoms}' ({label_bn}) লিপিবদ্ধ রয়েছে। "
                        "লক্ষণ বিস্তার করছে কিনা পুনরায় মাঠ পর্যবেক্ষণ করুন। এটি কোনো নিশ্চিত এআই রোগ নির্ণয় নয়।"
                    ),
                    explanation_en=(
                        f"Field visual observation reported '{symptoms}' ({label_en}). "
                        "Re-scout field to verify if symptoms persist or spread. This is not an automated disease diagnosis."
                    ),
                    priority=prio,
                    source_module="crop_monitoring",
                    source_date=obs.observation_date,
                    data_freshness="current",
                    destination_tab="crop_monitoring",
                )
            )

    # -------------------------------------------------------------------------
    # RULE E — EXISTING WEATHER ADVISORY
    # -------------------------------------------------------------------------
    weather = intelligence.weather_summary
    if weather and weather.status == "ok" and weather.active_advisories:
        for idx, adv in enumerate(weather.active_advisories):
            adv_text = str(adv.get("title_bn") or adv.get("title") or adv.get("message_bn") or adv.get("text") or "")
            adv_type = str(adv.get("type", "")).lower()
            adv_prio = "high" if any(w in adv_type or w in adv_text for w in ["ঝড়", "বন্যা", "ভারী", "heavy_rain", "storm", "cyclone"]) else "medium"

            title_bn = adv.get("title_bn") or adv.get("title") or "আবহাওয়া সতর্কতা ও কৃষিপরামর্শ"
            title_en = adv.get("title_en") or "Agro-Meteorological Advisory"
            msg_bn = adv.get("message_bn") or adv.get("text") or adv_text or "স্থানীয় আবহাওয়া পূর্বাভাসের ভিত্তিতে প্রদত্ত পরামর্শ।"
            msg_en = adv.get("message_en") or adv.get("text") or "Advisory guidance based on local meteorological forecast."

            add_action(
                FarmActionItem(
                    action_id=f"act-weather-adv-{farm.id}-{idx}",
                    rule_id="weather_advisory",
                    farm_id=farm.id,
                    crop_id=None,
                    related_record_id=None,
                    title_bn=title_bn,
                    title_en=title_en,
                    explanation_bn=msg_bn,
                    explanation_en=msg_en,
                    priority=adv_prio,
                    source_module="weather",
                    source_date=today_dhaka,
                    data_freshness="current",
                    destination_tab="calendar",
                )
            )

    # -------------------------------------------------------------------------
    # SORTING & DETERMINISTIC ORDERING
    # Primary: Priority ('high' -> 'medium' -> 'low')
    # Secondary: Source date (earliest or latest, fallback to action_id)
    # -------------------------------------------------------------------------
    actions.sort(
        key=lambda a: (
            PRIORITY_ORDER.get(a.priority, 99),
            a.source_date or "9999-99-99",
            a.action_id,
        )
    )

    # Tally priorities
    priority_counts = {"high": 0, "medium": 0, "low": 0}
    for a in actions:
        if a.priority in priority_counts:
            priority_counts[a.priority] += 1

    # Reviewed records count
    all_tasks_count = intelligence.tasks_summary.get("total_tasks", 0)
    soil_count = intelligence.soil_summary.total_tests_count
    obs_count = intelligence.observations_summary.total_observations_count
    weather_count = len(weather.active_advisories) if weather and weather.status == "ok" else 0
    records_reviewed = all_tasks_count + soil_count + obs_count + weather_count

    data_availability = {
        "tasks": "available" if all_tasks_count > 0 else "empty",
        "soil": "available" if intelligence.soil_summary.has_soil_test else "missing",
        "observations": "available" if obs_count > 0 else "empty",
        "cultivation": "available" if intelligence.cultivation_summary.total_activities_count > 0 else "empty",
        "harvest": "available" if intelligence.harvest_summary.total_records_count > 0 else "empty",
        "weather": "available" if weather and weather.status == "ok" else "unavailable",
    }

    return FarmActionsResponse(
        farm_id=farm.id,
        farm_name=farm.name,
        actions=actions,
        total_actions=len(actions),
        priority_counts=priority_counts,
        records_reviewed_count=records_reviewed,
        data_availability=data_availability,
        generated_at=now_dhaka_str,
    )

