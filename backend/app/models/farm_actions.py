# Pydantic models for Phase F6C-1: Contextual Farm Action Center Backend Foundation
# Strictly read-only, deterministic, provenance-aware action contracts.
# Zero synthetic risk scores, zero automated diagnoses, zero chemical/pesticide dosage instructions.

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class FarmActionItem(BaseModel):
    action_id: str = Field(..., description="Stable deterministic action identifier")
    rule_id: str = Field(..., description="Rule code e.g. overdue_task, upcoming_task, missing_soil_test, farmer_reported_issue, weather_advisory")
    farm_id: int
    crop_id: Optional[int] = None
    related_record_id: Optional[int] = None
    title_bn: str
    title_en: str
    explanation_bn: str
    explanation_en: str
    priority: str = Field(..., description="Review priority: 'high', 'medium', or 'low'")
    source_module: str = Field(..., description="Module identifier e.g. 'calendar', 'soil_health', 'crop_monitoring', 'weather'")
    source_date: Optional[str] = None
    data_freshness: str = Field(..., description="'current', 'dated', 'unavailable', or 'missing'")
    destination_tab: str = Field(..., description="Existing workspace tab: 'calendar', 'soil_health', 'crop_monitoring', 'harvest', 'farm_twin'")


class FarmActionsResponse(BaseModel):
    farm_id: int
    farm_name: str
    actions: List[FarmActionItem] = []
    total_actions: int = 0
    priority_counts: Dict[str, int] = Field(default_factory=lambda: {"high": 0, "medium": 0, "low": 0})
    records_reviewed_count: int = 0
    data_availability: Dict[str, str] = Field(default_factory=dict)
    generated_at: str

