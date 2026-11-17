# Smart in-app reminders and notification synchronization service (Phase F4C)
# Generates and persists actionable reminders for tasks due today, upcoming deadlines,
# overdue activities, and weather planning advisories anchored to Asia/Dhaka time.

from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..db import ReminderNotification, CalendarTask, FarmProfile
from ..models.calendar import get_current_dhaka_date, DHAKA_TZ
from ..models.weather import ReminderItem, ReminderCounts, ReminderListResponse
from .weather import (
    resolve_farm_coordinates,
    fetch_open_meteo_forecast,
    normalize_open_meteo_response,
    generate_weather_advisories_for_tasks,
)


async def sync_user_reminders(db: Session, user_id: int) -> int:
    """
    Synchronizes reminders for the current user based on actual database tasks and live weather.
    - Prevents duplicates (deduplicates by user_id + task_id + reminder_type).
    - Auto-dismisses reminders for completed/cancelled tasks.
    Returns: count of newly created reminders.
    """
    today_date = datetime.now(DHAKA_TZ).date()
    today_str = today_date.isoformat()
    upcoming_limit = (today_date + timedelta(days=2)).isoformat()
    new_count = 0

    # 1. Fetch user's tasks and active farms
    tasks = db.query(CalendarTask).filter(CalendarTask.user_id == user_id).all()
    farms = db.query(FarmProfile).filter(FarmProfile.user_id == user_id, FarmProfile.is_active == True).all()
    farm_map = {f.id: f for f in farms}

    # 2. Existing active reminders for quick deduplication lookup: (task_id, reminder_type) -> ReminderNotification
    existing_active = db.query(ReminderNotification).filter(
        ReminderNotification.user_id == user_id,
        ReminderNotification.is_dismissed == False,
    ).all()
    active_keys = {(r.task_id, r.reminder_type): r for r in existing_active}

    # 3. Clean up reminders for tasks that are now completed or cancelled
    for task in tasks:
        if task.status in ["completed", "cancelled"]:
            for r_type in ["due_today", "overdue_task", "upcoming_task", "weather_advisory"]:
                if (task.id, r_type) in active_keys:
                    rem = active_keys[(task.id, r_type)]
                    rem.is_dismissed = True
                    rem.dismissed_at = datetime.now(DHAKA_TZ)

    # 4. Process task deadlines
    for task in tasks:
        if task.status in ["completed", "cancelled"]:
            continue

        farm = farm_map.get(task.farm_id)
        farm_name = farm.name if farm else "খামার"

        # Check: DUE TODAY
        if task.due_date == today_str:
            if (task.id, "due_today") not in active_keys:
                rem = ReminderNotification(
                    user_id=user_id,
                    farm_id=task.farm_id,
                    task_id=task.id,
                    reminder_type="due_today",
                    title_bn=f"আজকের কাজ: {task.title}",
                    message_bn=f"‘{farm_name}’ খামারে আজকের মধ্যে কাজটি সম্পন্ন করার কথা রয়েছে।",
                    title_en=f"Due Today: {task.title}",
                    message_en=f"Task is scheduled for today at farm '{farm_name}'.",
                    severity="warning" if task.priority in ["high", "urgent"] else "info",
                    action_type="view_task",
                    action_payload={"task_id": task.id, "farm_id": task.farm_id},
                )
                db.add(rem)
                new_count += 1

        # Check: OVERDUE TASK
        elif task.due_date < today_str:
            if (task.id, "overdue_task") not in active_keys:
                rem = ReminderNotification(
                    user_id=user_id,
                    farm_id=task.farm_id,
                    task_id=task.id,
                    reminder_type="overdue_task",
                    title_bn=f"বকেয়া কাজ: {task.title}",
                    message_bn=f"নির্ধারিত তারিখ ({task.due_date}) অতিক্রম করেছে। দ্রুত সম্পন্ন বা পুনর্নির্ধারণ করুন।",
                    title_en=f"Overdue Task: {task.title}",
                    message_en=f"Deadline ({task.due_date}) passed. Please complete or reschedule.",
                    severity="urgent",
                    action_type="reschedule",
                    action_payload={"task_id": task.id, "farm_id": task.farm_id},
                )
                db.add(rem)
                new_count += 1

        # Check: UPCOMING (within next 2 days)
        elif today_str < task.due_date <= upcoming_limit:
            if (task.id, "upcoming_task") not in active_keys:
                rem = ReminderNotification(
                    user_id=user_id,
                    farm_id=task.farm_id,
                    task_id=task.id,
                    reminder_type="upcoming_task",
                    title_bn=f"আসন্ন কাজ: {task.title}",
                    message_bn=f"আগামী {task.due_date} তারিখে ‘{farm_name}’ খামারে কাজটি করতে হবে।",
                    title_en=f"Upcoming Task: {task.title}",
                    message_en=f"Scheduled for {task.due_date} at farm '{farm_name}'.",
                    severity="info",
                    action_type="view_task",
                    action_payload={"task_id": task.id, "farm_id": task.farm_id},
                )
                db.add(rem)
                new_count += 1

    # 5. Process Weather Advisories for active farms
    for farm in farms:
        farm_tasks = [t for t in tasks if t.farm_id == farm.id and t.status == "pending"]
        if not farm_tasks:
            continue

        lat, lon, _, _, _ = resolve_farm_coordinates(farm)
        raw_forecast, is_cached, _ = await fetch_open_meteo_forecast(lat, lon)
        forecast_resp = normalize_open_meteo_response(raw_forecast, farm, is_cached=is_cached)

        if forecast_resp.status in ["ok", "cached"] and forecast_resp.forecast:
            advisories = generate_weather_advisories_for_tasks(farm, farm_tasks, forecast_resp.forecast)
            for adv in advisories:
                key = (adv.task_id, "weather_advisory")
                if key not in active_keys:
                    rem = ReminderNotification(
                        user_id=user_id,
                        farm_id=farm.id,
                        task_id=adv.task_id,
                        reminder_type="weather_advisory",
                        title_bn=f"আবহাওয়া সতর্কতা: {adv.title_bn}",
                        message_bn=f"[{adv.task_title}] {adv.reason_bn} পরামর্শ: {adv.action_suggestion_bn}",
                        title_en=f"Weather Alert: {adv.title_en}",
                        message_en=f"[{adv.task_title}] {adv.reason_en}",
                        severity=adv.severity,
                        action_type="reschedule",
                        action_payload={
                            "task_id": adv.task_id,
                            "farm_id": farm.id,
                            "suggested_days": adv.suggested_reschedule_days,
                            "forecast_value": adv.forecast_value,
                        },
                    )
                    db.add(rem)
                    new_count += 1

    db.commit()
    return new_count


def get_user_reminders_list(db: Session, user_id: int, farm_id: Optional[int] = None) -> ReminderListResponse:
    """Retrieves all active reminders with summary counts for the authenticated user."""
    query = db.query(ReminderNotification).filter(
        ReminderNotification.user_id == user_id,
        ReminderNotification.is_dismissed == False,
    )
    if farm_id is not None:
        query = query.filter(ReminderNotification.farm_id == farm_id)

    # Order: unread first, then by urgency severity, then newest
    reminders = query.order_by(
        ReminderNotification.is_read.asc(),
        desc(ReminderNotification.created_at)
    ).all()

    items: List[ReminderItem] = []
    unread = 0
    due_today = 0
    overdue = 0
    weather_adv = 0

    for r in reminders:
        if not r.is_read:
            unread += 1
        if r.reminder_type == "due_today":
            due_today += 1
        elif r.reminder_type == "overdue_task":
            overdue += 1
        elif r.reminder_type == "weather_advisory":
            weather_adv += 1

        items.append(
            ReminderItem(
                id=r.id,
                user_id=r.user_id,
                farm_id=r.farm_id,
                farm_name=r.farm.name if r.farm else None,
                task_id=r.task_id,
                task_title=r.task.title if r.task else None,
                reminder_type=r.reminder_type,
                title_bn=r.title_bn,
                message_bn=r.message_bn,
                title_en=r.title_en,
                message_en=r.message_en,
                severity=r.severity or "info",
                action_type=r.action_type,
                action_payload=r.action_payload,
                is_read=r.is_read,
                is_dismissed=r.is_dismissed,
                created_at=r.created_at.isoformat() if r.created_at else datetime.now(DHAKA_TZ).isoformat(),
            )
        )

    counts = ReminderCounts(
        total_active=len(items),
        unread_count=unread,
        due_today_count=due_today,
        overdue_count=overdue,
        weather_advisory_count=weather_adv,
    )

    return ReminderListResponse(reminders=items, counts=counts)
