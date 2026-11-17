# Domain models, Pydantic schemas, and scientific calculation services
# for Verified Smart Crop Scheduling & Agricultural Planning (Phase F4B)

import hashlib
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

from .calendar import get_current_dhaka_date, DHAKA_TZ


# =============================================================================
# 1. TEMPLATE STAGE & DEFINITION SCHEMAS (SOURCE-BACKED PROVENANCE)
# =============================================================================
class ScheduleTemplateStage(BaseModel):
    stage_id: str
    stage_name: str
    stage_name_bn: str
    day_offset_start: int
    day_offset_end: int
    recommended_category: str
    action_bn: str
    action_en: str
    notes_bn: str
    notes_en: str
    scientific_basis: str
    source_reference: str
    is_optional: bool = False
    priority: str = "medium"  # low, medium, high, urgent


class CropScheduleTemplate(BaseModel):
    template_id: str
    crop: str
    crop_bn: str
    variety: Optional[str] = None
    season: str
    season_bn: str
    applicable_regions: List[str]
    source_agency: str
    source_url: str
    source_version: str
    recommended_sowing_window: str
    stages: List[ScheduleTemplateStage]
    limitations: str
    is_verified: bool = True


# =============================================================================
# 2. OFFICIAL VERIFIED CROP SCHEDULE TEMPLATES
# =============================================================================
# Strictly verified against authentic agricultural publications:
# 1. BRRI (Bangladesh Rice Research Institute): "আধুনিক ধানের চাষ" (Modern Rice Cultivation, 23rd Ed.)
# 2. BAMIS (Bangladesh Agro-Meteorological Information Service): Crop Weather Calendar
# 3. BARI (Bangladesh Agricultural Research Institute): Horticulture Research Manual
# 4. BARC (Bangladesh Agricultural Research Council): Fertilizer Recommendation Guide (FRG-2018)
# 5. DAE (Department of Agricultural Extension): Krishi Diary 2024
# =============================================================================

VERIFIED_SCHEDULE_TEMPLATES: List[CropScheduleTemplate] = [
    # -------------------------------------------------------------------------
    # 1. BORO RICE (বোরো ধান) - RABI SEASON
    # -------------------------------------------------------------------------
    CropScheduleTemplate(
        template_id="bamis_brri_boro_rice_v1",
        crop="Boro Rice",
        crop_bn="বোরো ধান",
        variety="BRRI Dhan-28 / BRRI Dhan-29 / Bangabandhu Dhan-100 / BRRI Dhan-89 / BRRI Dhan-92",
        season="Rabi",
        season_bn="রবি",
        applicable_regions=["Dhaka", "Rajshahi", "Mymensingh", "Rangpur", "Khulna", "Sylhet", "Barishal", "Chattogram"],
        source_agency="Bangladesh Rice Research Institute (BRRI) & BAMIS",
        source_url="https://brri.portal.gov.bd/ & https://www.bamis.gov.bd/",
        source_version="BRRI-Adhunik-Dhan-2024 / BAMIS-2024.1",
        recommended_sowing_window="November 15 – December 15 (Seedbed) | December 20 – January 31 (Transplanting)",
        limitations="Cold wave protection required during seedbed stage. Timelines depend on seedling age (35-45 days) at transplanting.",
        stages=[
            ScheduleTemplateStage(
                stage_id="boro_s01_seedbed",
                stage_name="Seedbed Preparation & Sowing",
                stage_name_bn="বীজতলা প্রস্তুতি ও অঙ্কুরিত বীজ বপন",
                day_offset_start=0,
                day_offset_end=5,
                recommended_category="sowing",
                action_bn="উন্নত বীজ শোধন এবং আদর্শ ভিজা বীজতলায় অঙ্কুরিত বীজ সুষমভাবে বপন করুন।",
                action_en="Treat certified seeds and sow sprouted seeds evenly on well-prepared wet seedbeds.",
                notes_bn="প্রতি শতকে ৩ কেজি বীজ বপন করুন। রাতে কুয়াশা ও তীব্র শৈত্যপ্রবাহ থেকে সুরক্ষায় স্বচ্ছ পলিথিন দিয়ে বীজতলা ঢেকে রাখুন।",
                notes_en="Use 3kg certified seeds per decimal. Protect young seedlings from severe fog/cold wave with polythene covers.",
                scientific_basis="BRRI Modern Rice Cultivation Guide (Gazipur, Bangladesh) - Ch. 3: Seedling Management.",
                source_reference="BRRI Adhunik Dhaner Chash (23rd Ed.), pp. 14-18.",
                is_optional=False,
                priority="urgent",
            ),
            ScheduleTemplateStage(
                stage_id="boro_s02_land_prep",
                stage_name="Main Land Preparation & Basal Fertilizer",
                stage_name_bn="মূল জমি চাষ ও সুষম তলসার প্রয়োগ",
                day_offset_start=30,
                day_offset_end=35,
                recommended_category="land_preparation",
                action_bn="মূল জমিতে ৩-৪টি গভীর চাষ ও মই দিয়ে থকথকে কাদা তৈরি করুন এবং শেষ চাষের আগে তলসার দিন।",
                action_en="Plow 3-4 times with leveling and puddling; apply basal fertilizers before final leveling.",
                notes_bn="অনুমোদিত হারে পচা গোবর/কম্পোস্ট, সম্পূর্ণ টিএসপি/ডিএপি, জিপসাম ও জিংক সালফেট শেষ চাষে ছিটিয়ে মাটির সাথে মিশিয়ে দিন।",
                notes_en="Incorporate full doses of TSP/DAP, Gypsum, and Zinc Sulphate into the puddled soil during final land preparation.",
                scientific_basis="BARC Fertilizer Recommendation Guide (FRG-2018) - Wetland Rice Soils.",
                source_reference="BARC FRG-2018, Section 4.1: Boro Rice Nutrient Rates.",
                is_optional=False,
                priority="high",
            ),
            ScheduleTemplateStage(
                stage_id="boro_s03_transplant",
                stage_name="Seedling Transplanting",
                stage_name_bn="চারা রোপণ (৩৫-৪৫ দিন বয়সের চারা)",
                day_offset_start=35,
                day_offset_end=45,
                recommended_category="transplanting",
                action_bn="৩৫-৪৫ দিন বয়সের সতেজ চারা ২০x১৫ সেমি দূরত্বে প্রতি গোছায় ২-৩টি করে রোপণ করুন।",
                action_en="Transplant 35-45 day-old healthy seedlings at 20x15 cm spacing, 2-3 seedlings per hill.",
                notes_bn="অতিরিক্ত গভীর রোপণ পরিহার করুন (২-৩ সেমি গভীরতা আদর্শ); অগভীর রোপণে দ্রুত শিকড় ছড়ায় ও কার্যকর কুশি বেশি হয়।",
                notes_en="Avoid deep transplanting (2-3 cm is optimal); shallow transplanting encourages early root anchorage and tillering.",
                scientific_basis="DAE Crop Production Manual & BAMIS Agro-Climate Advisory.",
                source_reference="DAE Krishi Diary 2024, Boro Guidelines, p. 52.",
                is_optional=False,
                priority="urgent",
            ),
            ScheduleTemplateStage(
                stage_id="boro_s04_weeding_topdress1",
                stage_name="Early Tillering, Weeding & 1st Urea Top-dressing",
                stage_name_bn="কুশি পর্যায়, আগাছা দমন ও ১ম কিস্তি ইউরিয়া প্রয়োগ",
                day_offset_start=55,
                day_offset_end=65,
                recommended_category="nutrient_management",
                action_bn="রোপণের ১৫-২০ দিন পর জমি নিড়ানি দিয়ে প্রথম কিস্তির ইউরিয়া উপরিপ্রয়োগ করুন।",
                action_en="Perform first weeding 15-20 days post-transplanting and broadcast first split of Urea.",
                notes_bn="সার ছিটানোর সময় জমিতে ছিপছিপে পানি রাখুন। এলসিসি (Leaf Color Chart) ব্যবহার করে ইউরিয়া নিয়ন্ত্রণ করা উত্তম।",
                notes_en="Broadcast Urea on thin sheet of standing water. Utilizing LCC avoids excessive vegetative growth.",
                scientific_basis="BRRI Nutrient Management Protocol with LCC verification.",
                source_reference="BRRI Adhunik Dhaner Chash, p. 29.",
                is_optional=False,
                priority="high",
            ),
            ScheduleTemplateStage(
                stage_id="boro_s05_awd_irrigation",
                stage_name="Active Tillering & AWD Water Management",
                stage_name_bn="কুশি বৃদ্ধি ও পর্যায়ক্রমিক ভিজানো-শুকানো সেচ (AWD)",
                day_offset_start=70,
                day_offset_end=80,
                recommended_category="irrigation",
                action_bn="কুশি বৃদ্ধিকালে এডব্লিউডি পাইপ পর্যবেক্ষণ করে পর্যায়ক্রমে সেচ দিন ও পানি সাশ্রয় করুন।",
                action_en="Maintain Alternate Wetting and Drying (AWD) irrigation regime during active tillering.",
                notes_bn="মাটির নিচে ৫ সেমি পর্যন্ত পানি শুকিয়ে গেলে পুনরায় ২-৩ ইঞ্চি সেচ দিন। এতে সেচের পানির সাশ্রয় হয় ও কুশি শক্ত হয়।",
                notes_en="Re-irrigate when water table drops 5 cm below surface. Reduces groundwater extraction by 25-30%.",
                scientific_basis="BAMIS Irrigation Management Standard & BRRI AWD Technology.",
                source_reference="BAMIS Agro-Meteorology Water Handbook 2024.",
                is_optional=True,
                priority="medium",
            ),
            ScheduleTemplateStage(
                stage_id="boro_s06_booting_observation",
                stage_name="Panicle Initiation & 2nd Top-dressing",
                stage_name_bn="কাইচথোড় পর্যায়, ২য় কিস্তি ইউরিয়া ও রোগ পরিদর্শন",
                day_offset_start=90,
                day_offset_end=105,
                recommended_category="crop_observation",
                action_bn="কাইচথোড় আসার সময় শেষ কিস্তির ইউরিয়া ও এমপি সার প্রয়োগ করুন এবং ক্ষেতে পর্যাপ্ত পানি রাখুন।",
                action_en="Apply final split of Urea + MOP at panicle initiation stage and maintain 3-5 cm water layer.",
                notes_bn="এ সময়ে জমিতে পানির টান পড়তে দেবেন না। ব্লাস্ট ও পাতা পোড়া রোগের লক্ষণ দেখা দিলে নিকটস্থ কৃষি কর্মকর্তার পরামর্শ নিন।",
                notes_en="Do not allow soil drying at panicle emergence. Monitor for blast lesions or bacterial blight symptoms.",
                scientific_basis="BRRI Crop Protection Advisory.",
                source_reference="BRRI Adhunik Dhaner Chash, pp. 44-48.",
                is_optional=False,
                priority="high",
            ),
            ScheduleTemplateStage(
                stage_id="boro_s07_grain_filling",
                stage_name="Flowering & Grain Filling Stage",
                stage_name_bn="ফুল ফোটা ও দুধ-দানা গঠন পর্যায়",
                day_offset_start=110,
                day_offset_end=125,
                recommended_category="irrigation",
                action_bn="ফুল ফোটার সময়ে হালকা পানি ধরে রাখুন এবং গান্ধী পোকা বা বাদামি গাছফড়িং (বিপিএইচ) পর্যবেক্ষণ করুন।",
                action_en="Assure standing moisture during flowering; scout for brown planthopper (BPH) or stinkbug infestations.",
                notes_bn="ধান গাছে দুধ সৃষ্টির সময় পানির ঘাটতি হলে চিটা হওয়ার ঝুঁকি থাকে। শিষ শক্ত হওয়া শুরু করলে সেচ বন্ধের প্রস্তুতি নিন।",
                notes_en="Moisture stress during milky stage causes sterility. Prepare to cease irrigation 10-12 days before harvest.",
                scientific_basis="BRRI Plant Physiology Guidelines.",
                source_reference="BRRI Adhunik Dhaner Chash, p. 53.",
                is_optional=False,
                priority="medium",
            ),
            ScheduleTemplateStage(
                stage_id="boro_s08_harvest",
                stage_name="Maturity & Harvest Planning",
                stage_name_bn="ফসল পরিপক্বতা ও ধান কর্তন পরিকল্পনা",
                day_offset_start=135,
                day_offset_end=155,
                recommended_category="harvest_planning",
                action_bn="শীষের ৮০% ধান সোনালী রঙ ধারণ করলে ধান কেটে দ্রুত মাড়াই ও রোদে শুকানোর ব্যবস্থা করুন।",
                action_en="Harvest when 80% of panicle grains turn golden; thresh promptly and dry to 12% moisture.",
                notes_bn="কাটার পর জমিতে ধান ফেলে রাখবেন না। রোদে ২-৩ দিন শুকিয়ে আর্দ্রতা ১২% বা তার নিচে এনে বায়ুরোধী পাত্রে সংরক্ষণ করুন।",
                notes_en="Do not keep harvested stacks wet in the field. Sun-dry grains thoroughly to prevent mycotoxins and grain discoloration.",
                scientific_basis="BAMIS Harvest Advisory & Post-Harvest Technology Standards.",
                source_reference="BAMIS Agro-Climate Manual 2024 / DAE Post-Harvest Handbook.",
                is_optional=False,
                priority="urgent",
            ),
        ],
    ),

    # -------------------------------------------------------------------------
    # 2. AMAN RICE (রোপা আমন ধান) - KHARIF-2 SEASON
    # -------------------------------------------------------------------------
    CropScheduleTemplate(
        template_id="bamis_brri_aman_rice_v1",
        crop="Aman Rice",
        crop_bn="আমন ধান",
        variety="BRRI Dhan-49 / BRRI Dhan-71 / BRRI Dhan-75 / BRRI Dhan-87 / BR-11 (Mukta)",
        season="Kharif-2",
        season_bn="খরিপ-২",
        applicable_regions=["Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh"],
        source_agency="Bangladesh Rice Research Institute (BRRI) & DAE",
        source_url="https://brri.portal.gov.bd/ & https://dae.portal.gov.bd/",
        source_version="BRRI-Aman-2024 / DAE-Diary-2024",
        recommended_sowing_window="June 15 – July 15 (Asharh) | July 15 – August 15 (Transplanting)",
        limitations="Flood vulnerability in lowlands during August-September. Supplementary irrigation required if dry spell occurs in Kartik.",
        stages=[
            ScheduleTemplateStage(
                stage_id="aman_s01_seedbed",
                stage_name="Seedbed Preparation & Sowing",
                stage_name_bn="বীজতলা প্রস্তুতি ও বীজ বপন",
                day_offset_start=0,
                day_offset_end=5,
                recommended_category="sowing",
                action_bn="উঁচু জলাবদ্ধতামুক্ত জমিতে বীজতলা তৈরি করে শোধিত বীজ বপন করুন।",
                action_en="Prepare raised, well-drained nursery beds and sow treated certified seeds.",
                notes_bn="আষাঢ় মাসে বীজ বপন সম্পন্ন করুন। হঠাৎ ভারী বৃষ্টিতে বীজতলা ডুবে গেলে দ্রুত পানি নিষ্কাশনের ব্যবস্থা রাখুন।",
                notes_en="Complete nursery sowing in Asharh. Maintain clear perimeter ditches for drainage during heavy rains.",
                scientific_basis="BRRI T. Aman Nursery Management Manual.",
                source_reference="BRRI Adhunik Dhaner Chash (23rd Ed.), pp. 20-23.",
                is_optional=False,
                priority="urgent",
            ),
            ScheduleTemplateStage(
                stage_id="aman_s02_land_prep",
                stage_name="Main Land Puddling & Basal Fertilizer",
                stage_name_bn="মূল জমি চাষ, থকথকে কাদা তৈরি ও শেষ চাষে সার প্রয়োগ",
                day_offset_start=20,
                day_offset_end=25,
                recommended_category="land_preparation",
                action_bn="বৃষ্টির পানি ধরে রেখে জমিতে ৩-৪টি চাষ ও মই দিয়ে শেষ চাষের আগে অনুমোদিত সার প্রয়োগ করুন।",
                action_en="Trap monsoon rainwater, puddle field with 3-4 plowings, and incorporate basal fertilizers.",
                notes_bn="শেষ চাষে শতক প্রতি নির্ধারিত হারে টিএসপি/ডিএপি ও জিপসাম প্রয়োগ করুন। জৈব সার কাদার সাথে ভালোভাবে মেশান।",
                notes_en="Incorporate recommended TSP/DAP and Gypsum per decimal during final leveling before transplanting.",
                scientific_basis="BARC Fertilizer Recommendation Guide (FRG-2018) - T. Aman.",
                source_reference="BARC FRG-2018, Section 4.2: T. Aman Fertilization.",
                is_optional=False,
                priority="high",
            ),
            ScheduleTemplateStage(
                stage_id="aman_s03_transplant",
                stage_name="Seedling Transplanting",
                stage_name_bn="২৫-৩০ দিনের সুস্থ চারা রোপণ",
                day_offset_start=25,
                day_offset_end=30,
                recommended_category="transplanting",
                action_bn="২৫-৩০ দিন বয়সের চারা ২০x১৫ সেমি দূরত্বে প্রতি গুচ্ছায় ২-৩টি করে অগভীরভাবে রোপণ করুন।",
                action_en="Transplant 25-30 day-old seedlings at 20x15 cm row spacing, 2-3 seedlings per hill.",
                notes_bn="শ্রাবণ মাসের মধ্যে রোপণ শেষ করা সর্বোত্তম। দেরিতে রোপণ করলে ফলন হ্রাস পায়।",
                notes_en="Complete transplanting within Shraban. Delayed transplanting reduces tillering and grain yield.",
                scientific_basis="BRRI Agronomy Division Field Standard.",
                source_reference="BRRI Adhunik Dhaner Chash, pp. 24-26.",
                is_optional=False,
                priority="urgent",
            ),
            ScheduleTemplateStage(
                stage_id="aman_s04_weeding_topdress",
                stage_name="Early Vegetative Growth & 1st Urea Top-dressing",
                stage_name_bn="প্রাথমিক কুশি বৃদ্ধি ও ১ম কিস্তি ইউরিয়া প্রয়োগ",
                day_offset_start=40,
                day_offset_end=50,
                recommended_category="nutrient_management",
                action_bn="রোপণের ১৫-২০ দিন পর নিড়ানি দিয়ে আগাছা দমন করুন এবং ১ম কিস্তির ইউরিয়া উপরিপ্রয়োগ করুন।",
                action_en="Perform manual weeding 15-20 days after transplanting and apply 1st split of Urea.",
                notes_bn="জমিতে আগাছা থাকলে সারের কার্যকারিতা কমে যায়। মাজরা পোকার ডিমের পুটলি দেখলে হাত দিয়ে তুলে নষ্ট করুন।",
                notes_en="Destroy stem borer egg masses manually. Ensure soil has damp moisture when broadcasting urea.",
                scientific_basis="BRRI Integrated Pest & Nutrient Management.",
                source_reference="DAE Krishi Diary 2024, Aman Section.",
                is_optional=False,
                priority="high",
            ),
            ScheduleTemplateStage(
                stage_id="aman_s05_booting_water",
                stage_name="Panicle Initiation & Moisture Assurance",
                stage_name_bn="কাইচথোড় পর্যায় ও জমিতে পর্যাপ্ত আর্দ্রতা নিশ্চিতকরণ",
                day_offset_start=65,
                day_offset_end=75,
                recommended_category="irrigation",
                action_bn="কাইচথোড় আসার সময় শেষ কিস্তির সার দিন এবং বৃষ্টি না হলে সম্পূরক সেচ নিশ্চিত করুন।",
                action_en="Broadcast final top-dressing at panicle initiation; provide supplementary irrigation if rains pause.",
                notes_bn="আশ্বিন-কার্তিক মাসে খরা দেখা দিলে কাইচথোড় শুকিয়ে ফলন বিপর্যয় ঘটতে পারে। সেচ নালা সচল রাখুন।",
                notes_en="Late season dry spell in Ashwin/Kartik causes high sterility. Timely supplementary irrigation is critical.",
                scientific_basis="BRRI Water Management in T. Aman.",
                source_reference="BRRI Adhunik Dhaner Chash, p. 32.",
                is_optional=False,
                priority="high",
            ),
            ScheduleTemplateStage(
                stage_id="aman_s06_grain_milking",
                stage_name="Flowering & Milk Stage Observation",
                stage_name_bn="ফুল ফোটা ও শিষ পরিদর্শন (ব্লাস্ট ও পোকা নিরীক্ষণ)",
                day_offset_start=85,
                day_offset_end=95,
                recommended_category="crop_observation",
                action_bn="ফুল ফোটা ও দানা পুষ্ট হওয়ার সময় শিষের অবস্থা এবং নেক ব্লাস্ট বা গান্ধি পোকা পর্যবেক্ষণ করুন।",
                action_en="Inspect panicles during flowering and milky stages for neck blast symptoms or bug damage.",
                notes_bn="আংশিক মেঘলা ও স্যাঁতসেঁতে আবহাওয়ায় নেক ব্লাস্টের বিস্তার দ্রুত হতে পারে। নিয়মিত নজর রাখুন।",
                notes_en="Overcast and humid conditions accelerate blast spread. Consult DAE extention agents if spots appear.",
                scientific_basis="BRRI Plant Pathology Advisory.",
                source_reference="BRRI Adhunik Dhaner Chash, pp. 45-47.",
                is_optional=False,
                priority="medium",
            ),
            ScheduleTemplateStage(
                stage_id="aman_s07_harvest",
                stage_name="Harvest Planning & Post-Harvest Care",
                stage_name_bn="ধান কর্তন, মাড়াই ও শুকানো পরিকল্পনা",
                day_offset_start=115,
                day_offset_end=135,
                recommended_category="harvest_planning",
                action_bn="শীষের ৮০% ধান পেকে সোনালী হলে ধান কেটে দ্রুত মাড়াই ও শুকিয়ে সংরক্ষণ করুন।",
                action_en="Harvest when 80% grains ripen to golden; thresh immediately and dry thoroughly.",
                notes_bn="কার্তিক-অগ্রহায়ণে ধান পাকার পর বেশিদিন জমিতে রাখলে শীষ ঝরে পড়ার সম্ভাবনা থাকে। ১২% আর্দ্রতায় গুদামজাত করুন।",
                notes_en="Delaying harvest increases shatter loss. Store dried paddy in moisture-proof containers.",
                scientific_basis="DAE & BAMIS Post-Harvest Standard.",
                source_reference="DAE Krishi Diary 2024, Aman Post-Harvest, p. 58.",
                is_optional=False,
                priority="urgent",
            ),
        ],
    ),

    # -------------------------------------------------------------------------
    # 3. AUS RICE (আউশ ধান - রোপা/বোনা আউশ) - KHARIF-1 SEASON
    # -------------------------------------------------------------------------
    CropScheduleTemplate(
        template_id="bamis_brri_aus_rice_v1",
        crop="Aus Rice",
        crop_bn="আউশ ধান",
        variety="BRRI Dhan-48 / BRRI Dhan-82 / BRRI Dhan-85 / BRRI Dhan-98",
        season="Kharif-1",
        season_bn="খরিপ-১",
        applicable_regions=["Dhaka", "Rajshahi", "Khulna", "Chattogram", "Mymensingh", "Rangpur", "Barishal", "Sylhet"],
        source_agency="Bangladesh Rice Research Institute (BRRI) & BAMIS",
        source_url="https://brri.portal.gov.bd/ & https://www.bamis.gov.bd/",
        source_version="BRRI-Aus-2024.1",
        recommended_sowing_window="March 15 – April 15 (Chaitra – Baishakh)",
        limitations="Early season moisture stress or heat waves; late season flash floods or Kalbaishakhi storms during harvesting.",
        stages=[
            ScheduleTemplateStage(
                stage_id="aus_s01_sowing",
                stage_name="Sowing / Direct Seedbed Preparation",
                stage_name_bn="বীজ বপন / সরাসরি বীজ বোনা",
                day_offset_start=0,
                day_offset_end=5,
                recommended_category="sowing",
                action_bn="চৈত্র-বৈশাখ মাসে জমিতে জো এলে বা বীজতলায় শোধিত অঙ্কুরিত বীজ বপন করুন।",
                action_en="Sow treated sprouted seeds in nursery bed or directly in field when optimal soil moisture is attained.",
                notes_bn="আউশের উচ্চফলনশীল জাত (ব্রি ধান৪৮/৮২) নির্বাচন করুন। বীজ শোধন করলে বাকানি রোগমুক্ত থাকে।",
                notes_en="Select verified HYV seeds (BRRI Dhan-48/82). Seed treatment prevents bakanae infection.",
                scientific_basis="BRRI Aus Cultivation Technology Guidelines.",
                source_reference="BRRI Adhunik Dhaner Chash (23rd Ed.), pp. 26-28.",
                is_optional=False,
                priority="urgent",
            ),
            ScheduleTemplateStage(
                stage_id="aus_s02_transplant_or_thinning",
                stage_name="Transplanting / Seedling Thinning",
                stage_name_bn="২০-২৫ দিনের চারা রোপণ বা চারা পাতলাকরণ",
                day_offset_start=20,
                day_offset_end=25,
                recommended_category="transplanting",
                action_bn="রোপা আউশের ক্ষেত্রে ২০-২৫ দিনের চারা রোপণ করুন; বোনা আউশের ক্ষেত্রে অতিরিক্ত চারা তুলে পাতলা করুন।",
                action_en="Transplant 20-25 day seedlings for transplanted Aus; thin out crowded shoots for broadcast Aus.",
                notes_bn="রোপণে ২০x১৫ সেমি দূরত্ব বজায় রাখুন। জমিতে হালকা কাদা থাকলে চারা দ্রুত শিকড় বিস্তার করে।",
                notes_en="Maintain 20x15 cm spacing. Proper spacing facilitates aeration and uniform tiller growth.",
                scientific_basis="BRRI Aus Agronomy Field Standards.",
                source_reference="BRRI Adhunik Dhaner Chash, p. 27.",
                is_optional=False,
                priority="high",
            ),
            ScheduleTemplateStage(
                stage_id="aus_s03_weeding_tillering",
                stage_name="Early Tillering, Weeding & 1st Top-dressing",
                stage_name_bn="কুশি বৃদ্ধি, নিড়ানি ও প্রথম কিস্তি সার প্রয়োগ",
                day_offset_start=35,
                day_offset_end=45,
                recommended_category="nutrient_management",
                action_bn="প্রথম নিড়ানি দিয়ে জমি আগাছামুক্ত করুন এবং প্রথম কিস্তির ইউরিয়া উপরিপ্রয়োগ করুন।",
                action_en="Weed the plot thoroughly and broadcast the first split of Urea at active tillering.",
                notes_bn="আউশ মৌসুমে প্রাক-বর্ষার কারণে দ্রুত আগাছা বাড়ে। আগাছা পরিষ্কার না করলে সারের অপচয় ঘটে।",
                notes_en="Pre-monsoon rains stimulate aggressive weed growth. Early weeding is crucial for nutrient uptake.",
                scientific_basis="BRRI Weed Management in Pre-Monsoon Aus.",
                source_reference="DAE Krishi Diary 2024, Aus Section.",
                is_optional=False,
                priority="high",
            ),
            ScheduleTemplateStage(
                stage_id="aus_s04_booting_inspection",
                stage_name="Panicle Initiation & Pest Monitoring",
                stage_name_bn="থোড় পর্যায় ও রোগবালাই নিরীক্ষণ",
                day_offset_start=60,
                day_offset_end=70,
                recommended_category="crop_observation",
                action_bn="কাইচথোড় আসার সময় শেষ কিস্তির সার প্রয়োগ করুন এবং মাজরা পোকা বা ব্লাস্ট রোগ পর্যবেক্ষণ করুন।",
                action_en="Broadcast final fertilizer split at booting; observe for stem borers or foliar fungal symptoms.",
                notes_bn="এ সময়ে বৃষ্টি কম হলে জমিতে পরিমিত রস ধরে রাখতে হবে। থোড় অবস্থায় রসের ঘাটতি ক্ষতিকর।",
                notes_en="Maintain adequate root-zone moisture if rainfall is delayed during panicle initiation.",
                scientific_basis="BAMIS Weather-Crop Correlation Model.",
                source_reference="BAMIS Agro-Climate Manual 2024.",
                is_optional=False,
                priority="medium",
            ),
            ScheduleTemplateStage(
                stage_id="aus_s05_grain_filling",
                stage_name="Grain Filling & Maturation",
                stage_name_bn="দানা পুষ্ট হওয়া পর্যায় ও পর্যবেক্ষণ",
                day_offset_start=80,
                day_offset_end=90,
                recommended_category="crop_observation",
                action_bn="দানা পুষ্ট হওয়ার পর্যায় নিয়মিত পর্যবেক্ষণ করুন এবং জমির নিকাশ নালা সচল রাখুন।",
                action_en="Monitor grain ripening progression and maintain drainage channels to prevent waterlogging.",
                notes_bn="কালবৈশাখী বা আগাম বর্ষার ভারী বৃষ্টিতে যেন পানি জমে না থাকে সেদিকে খেয়াল রাখুন।",
                notes_en="Ensure unimpeded drainage to prevent lodging or grain germination from monsoon storms.",
                scientific_basis="BRRI Aus Water & Drainage Guidelines.",
                source_reference="BRRI Adhunik Dhaner Chash, p. 28.",
                is_optional=True,
                priority="medium",
            ),
            ScheduleTemplateStage(
                stage_id="aus_s06_harvest",
                stage_name="Harvest Planning Before Heavy Monsoon",
                stage_name_bn="ভারী বর্ষার আগেই ফসল কর্তন ও সংগ্রহ",
                day_offset_start=100,
                day_offset_end=115,
                recommended_category="harvest_planning",
                action_bn="শীষের ৮০% সোনালী বর্ণ ধারণ করলে বৃষ্টিপাতের পূর্বাভাস দেখে দ্রুত ধান কর্তন ও মাড়াই করুন।",
                action_en="Harvest when 80% grains are golden; check rainfall forecast and thresh without field delay.",
                notes_bn="আউশ ধান কাটার মৌসুমে প্রায়ই বৃষ্টি থাকে। কাটার পর দ্রুত মাড়াই করে ড্রায়ার বা রোদ পেলে ভালোভাবে শুকিয়ে নিন।",
                notes_en="Monsoon rains during harvest require fast threshing and artificial or prompt sun drying to 12%.",
                scientific_basis="BRRI Post-Harvest Advisory.",
                source_reference="BRRI Adhunik Dhaner Chash, p. 55.",
                is_optional=False,
                priority="urgent",
            ),
        ],
    ),

    # -------------------------------------------------------------------------
    # 4. WINTER TOMATO (শীতকালীন টমেটো) - RABI SEASON
    # -------------------------------------------------------------------------
    CropScheduleTemplate(
        template_id="bamis_bari_winter_tomato_v1",
        crop="Tomato",
        crop_bn="শীতকালীন টমেটো",
        variety="Ratan / BARI Tomato-14 / BARI Tomato-15 / BARI Tomato-18",
        season="Rabi",
        season_bn="রবি",
        applicable_regions=["Dhaka", "Rajshahi", "Khulna", "Chattogram", "Mymensingh", "Rangpur", "Sylhet", "Barishal"],
        source_agency="Bangladesh Agricultural Research Institute (BARI) & BAMIS",
        source_url="https://www.bari.gov.bd/ & https://barcapps.gov.bd/",
        source_version="BARI-Horticulture-2023.2",
        recommended_sowing_window="September 15 – October 15 (Seedbed) | October 15 – November 15 (Transplanting)",
        limitations="Highly susceptible to waterlogging, late blight in cold-foggy weather, and bacterial wilt in poorly drained soils.",
        stages=[
            ScheduleTemplateStage(
                stage_id="tomato_s01_nursery",
                stage_name="Nursery Seedbed Sowing",
                stage_name_bn="উঁচু বীজতলায় বীজ বপন ও ছাউনি স্থাপন",
                day_offset_start=0,
                day_offset_end=5,
                recommended_category="sowing",
                action_bn="উঁচু ছায়ামুক্ত স্থানে বেলে-দোআঁশ মাটিতে বীজতলা তৈরি করে শোধিত বীজ বপন করুন।",
                action_en="Sow treated seeds in raised, well-drained sandy loam nursery beds with clear polythene shelter.",
                notes_bn="আশ্বিন মাসের ভারী বৃষ্টি বা রোদের হাত থেকে চারার সুরক্ষায় স্বচ্ছ পলিথিন বা চালি ব্যবহার করুন।",
                notes_en="Use transparent polythene rain shelters over beds to protect tender emerging sprouts.",
                scientific_basis="BARI Vegetable Production Guide - Ch. 4: Solanaceous Crops.",
                source_reference="BARI Krishi Projukti Hatboi (8th Ed.), pp. 112-115.",
                is_optional=False,
                priority="urgent",
            ),
            ScheduleTemplateStage(
                stage_id="tomato_s02_bed_prep",
                stage_name="Main Bed Preparation & Organic Manure",
                stage_name_bn="মূল জমি তৈরি, মাদা প্রস্তুত ও গোবর/সার প্রয়োগ",
                day_offset_start=20,
                day_offset_end=25,
                recommended_category="land_preparation",
                action_bn="মূল জমিতে ৪-৫টি চাষ ও মই দিয়ে জমি ঝুরঝুরে করুন এবং ৬০ সেমি চওড়া বেড ও নিকাশ নালা তৈরি করুন।",
                action_en="Prepare fine tilth with 4-5 plowings; build 60 cm raised beds separated by 30 cm drainage trenches.",
                notes_bn="প্রতি মাদায় পচা গোবর, টিএসপি, জিপসাম ও বোরাক্স শেষ চাষের সময় মাটির সাথে ভালোভাবে মিশিয়ে দিন।",
                notes_en="Mix decomposed cowdung, TSP, Gypsum and Borax into planting pits before bed forming.",
                scientific_basis="BARC Fertilizer Recommendation Guide (FRG-2018) - Vegetables.",
                source_reference="BARC FRG-2018, Section 5.3: Tomato Nutrient Guidelines.",
                is_optional=False,
                priority="high",
            ),
            ScheduleTemplateStage(
                stage_id="tomato_s03_transplant",
                stage_name="Transplanting to Main Field",
                stage_name_bn="২৫-৩০ দিনের বলিষ্ঠ চারা বিকেলে রোপণ",
                day_offset_start=25,
                day_offset_end=30,
                recommended_category="transplanting",
                action_bn="২৫-৩০ দিন বয়সের চারা ৬০x৪০ সেমি দূরত্বে তৈরি বেডে শেষ বিকেলে রোপণ করুন।",
                action_en="Transplant 25-30 day sturdy seedlings at 60x40 cm spacing during late afternoon.",
                notes_bn="রোপণের পরপরই গাছের গোড়ায় হালকা সেচ দিন। পরের ২-৩ দিন রোদের তীব্রতায় চারা যাতে শুকিয়ে না যায় নজর রাখুন।",
                notes_en="Provide light spot irrigation immediately around the root plug. Shield from scorching midday sun.",
                scientific_basis="BARI Horticulture Research Centre Advisory.",
                source_reference="BARI Vegetable Production Guide, p. 116.",
                is_optional=False,
                priority="urgent",
            ),
            ScheduleTemplateStage(
                stage_id="tomato_s04_staking_pruning",
                stage_name="Staking, Pruning & Drainage Management",
                stage_name_bn="বাঁশের খুঁটি দেওয়া, ডালপালা ছাঁটাই ও সেচ নালা সচল রাখা",
                day_offset_start=45,
                day_offset_end=55,
                recommended_category="general",
                action_bn="গাছে বাঁশের খুঁটি ও সুতলি দিয়ে সাপোর্ট দিন এবং মাটির কাছের নিচের অতিরিক্ত পাতা ও ডালপালা ছাঁটাই করুন।",
                action_en="Erect bamboo stakes with string trellis; prune bottom lateral suckers for aeration and hygiene.",
                notes_bn="মাটি থেকে পাতা ও ডাল উপরে রাখলে মাটির আর্দ্রতা থেকে ছত্রাক আক্রমণ (আর্লি ব্লাইট) ব্যাপকভাবে কমে যায়।",
                notes_en="Elevating lower canopy reduces soil-splash fungal inoculation and improves sun exposure.",
                scientific_basis="BARI Integrated Crop Management for Solanaceous Vegetables.",
                source_reference="BARI Krishi Projukti Hatboi, p. 118.",
                is_optional=False,
                priority="high",
            ),
            ScheduleTemplateStage(
                stage_id="tomato_s05_flowering_fruitset",
                stage_name="Flowering & Fruit Setting Care",
                stage_name_bn="ফুল ও ফল ধরার পর্যায় - আর্দ্রতা ও পুষ্টি পর্যবেক্ষণ",
                day_offset_start=65,
                day_offset_end=75,
                recommended_category="nutrient_management",
                action_bn="গাছে ফুল ও ফল আসার সময় ২য় কিস্তির ইউরিয়া ও এমপি সার উপরিপ্রয়োগ করুন এবং হালকা সেচ দিন।",
                action_en="Apply 2nd top-dressing of Urea and MOP at flowering/early fruit set; supply uniform light irrigation.",
                notes_bn="মাটিতে রসের আকস্মিক ওঠানামা হলে ব্লসম অ্যান্ড রট (ফল পচা) বা ফল ফাটা রোগ হতে পারে।",
                notes_en="Moisture fluctuations trigger blossom-end rot. Maintain consistent root-zone moisture without pooling.",
                scientific_basis="BARC Plant Nutrition Guidelines & BARI Agronomy.",
                source_reference="BARC FRG-2018, Section 5.3.",
                is_optional=False,
                priority="high",
            ),
            ScheduleTemplateStage(
                stage_id="tomato_s06_blight_scouting",
                stage_name="Fruit Development & Foliage Blight Scouting",
                stage_name_bn="ফল বৃদ্ধির পর্যায় ও নাবি ধসা রোগ পর্যবেক্ষণ",
                day_offset_start=80,
                day_offset_end=95,
                recommended_category="crop_observation",
                action_bn="টমেটো ফলের সুষম বৃদ্ধির সময়ে কুয়াশাচ্ছন্ন আবহাওয়ায় নাবি ধসা (Late Blight) রোগের লক্ষণ পর্যবেক্ষণ করুন।",
                action_en="Inspect foliage and green fruit trusses closely for Late Blight lesions during cold foggy intervals.",
                notes_bn="পাতায় জলছাপ দাগ বা বাদামি দাগ দেখা দিলে অনুমোদিত ছত্রাকনাশক স্প্রে বিষয়ে উপসহকারী কৃষি কর্মকর্তার পরামর্শ নিন।",
                notes_en="Look for water-soaked leaf margins and white downy underside fuzz; seek DAE extension guidance promptly.",
                scientific_basis="BARI Plant Pathology Division Standard.",
                source_reference="BARI Krishi Projukti Hatboi, Plant Protection Sec.",
                is_optional=False,
                priority="urgent",
            ),
            ScheduleTemplateStage(
                stage_id="tomato_s07_harvest",
                stage_name="Harvest Planning at Breaker Stage",
                stage_name_bn="গোলাপী ব্রেকার পর্যায়ে সাবধানে টমেটো সংগ্রহ",
                day_offset_start=100,
                day_offset_end=125,
                recommended_category="harvest_planning",
                action_bn="টমেটোর রঙ হালকা গোলাপী (ব্রেকার স্টেজ) হলেই বাজারজাতকরণের জন্য বোঁটাসহ সকালের দিকে সংগ্রহ করুন।",
                action_en="Harvest fruits at turning/breaker stage with calyx attached during cool morning hours for maximum market shelf-life.",
                notes_bn="গাছে অতিরিক্ত পাকালে পরিবহনকালে নষ্ট হওয়ার ঝুঁকি বাড়ে। সংগ্রহ শেষে শীতল ছায়াযুক্ত স্থানে গ্রেডিং করুন।",
                notes_en="Harvesting at breaker phase prevents transit bruising and softens gradually during marketing.",
                scientific_basis="DAE Post-Harvest Horticulture Advisory & BARI Standards.",
                source_reference="DAE Vegetable Post-Harvest Management Manual 2024.",
                is_optional=False,
                priority="high",
            ),
        ],
    ),
]


# =============================================================================
# 3. REQUEST & RESPONSE SCHEMAS FOR CALENDAR SCHEDULING
# =============================================================================
class GeneratedTaskItem(BaseModel):
    temp_id: str
    stage_id: str
    stage_name: str
    stage_name_bn: str
    title: str
    category: str
    due_date: str  # YYYY-MM-DD
    due_time: Optional[str] = "08:00"
    priority: str = "medium"
    notes: str
    scientific_basis: str
    source_agency: str
    source_reference: str
    is_optional: bool = False
    included: bool = True


class ScheduleGenerateRequest(BaseModel):
    farm_id: int = Field(..., description="Target farm ID owned by current user")
    crop_id: int = Field(..., description="Target farm crop ID owned by current user")
    planting_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="Planting / sowing date (YYYY-MM-DD)")
    target_variety: Optional[str] = Field(None, max_length=150, description="Optional specific variety")
    season: Optional[str] = Field(None, max_length=50, description="Optional override season")


class ScheduleGenerateResponse(BaseModel):
    status: str = Field("success", description="Status: 'success' | 'unsupported'")
    template_id: Optional[str] = None
    crop_id: Optional[int] = None
    crop_name: str
    crop_name_bn: str
    variety: Optional[str] = None
    season: str
    season_bn: str
    farm_id: int
    farm_name: str
    district: str
    division: str
    planting_date: str
    estimated_harvest_date: str
    source_agency: str
    source_reference: str
    source_url: str
    source_version: str
    warnings: List[str] = []
    limitations: str
    schedule_hash: str
    already_generated: bool = False
    existing_instance_id: Optional[int] = None
    tasks: List[GeneratedTaskItem] = []
    total_tasks: int = 0
    support_message_bn: Optional[str] = None
    support_message_en: Optional[str] = None


class ScheduleConfirmRequest(BaseModel):
    farm_id: int
    crop_id: int
    template_id: str
    planting_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    schedule_hash: str
    tasks: List[GeneratedTaskItem]


class ScheduleConfirmResponse(BaseModel):
    success: bool
    schedule_instance_id: int
    farm_id: int
    crop_id: int
    tasks_created_count: int
    schedule_hash: str
    message: str
    message_bn: str


class CropScheduleInstanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    farm_id: int
    crop_id: int
    farm_name: Optional[str] = None
    crop_name: Optional[str] = None
    template_id: str
    schedule_hash: str
    planting_date: str
    estimated_harvest_date: Optional[str] = None
    status: str
    source_agency: str
    source_version: str
    tasks_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# =============================================================================
# 4. DETERMINISTIC ALGORITHMS & HELPERS
# =============================================================================
def compute_schedule_hash(user_id: int, farm_id: int, crop_id: int, template_id: str, planting_date: str) -> str:
    """Computes a deterministic hash for idempotency and duplicate prevention."""
    raw = f"uid:{user_id}_fid:{farm_id}_cid:{crop_id}_tid:{template_id}_pdate:{planting_date}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def find_matching_template(crop_name: str, season: Optional[str] = None, region: Optional[str] = None, variety: Optional[str] = None) -> Optional[CropScheduleTemplate]:
    """
    Finds verified template matching the crop, season, and region.
    Never hallucinates templates for unsupported crops.
    """
    c_norm = crop_name.strip().lower()
    s_norm = (season or "").strip().lower()
    r_norm = (region or "").strip().lower()

    # Exact or keyword mapping
    target_crop = None
    if any(k in c_norm for k in ["boro", "বোরো"]):
        target_crop = "Boro Rice"
    elif any(k in c_norm for k in ["aman", "আমন"]):
        target_crop = "Aman Rice"
    elif any(k in c_norm for k in ["aus", "আউশ"]):
        target_crop = "Aus Rice"
    elif any(k in c_norm for k in ["tomato", "টমেটো"]):
        target_crop = "Tomato"
    elif "rice" in c_norm or "ধান" in c_norm:
        # Match by season if just "Rice" or "ধান"
        if "rabi" in s_norm or "রবি" in s_norm:
            target_crop = "Boro Rice"
        elif "kharif-2" in s_norm or "খরিপ-২" in s_norm or "আমন" in s_norm:
            target_crop = "Aman Rice"
        elif "kharif-1" in s_norm or "খরিপ-১" in s_norm or "আউশ" in s_norm:
            target_crop = "Aus Rice"
        else:
            # Default to Boro Rice as predominant rice in Bangladesh
            target_crop = "Boro Rice"

    if not target_crop:
        return None

    # Retrieve candidate template
    for tmpl in VERIFIED_SCHEDULE_TEMPLATES:
        if tmpl.crop.lower() == target_crop.lower():
            # Check regional applicability if provided
            if r_norm:
                region_match = any(r_norm in reg.lower() for reg in tmpl.applicable_regions)
                if not region_match:
                    continue
            return tmpl

    return None


def calculate_offset_date(base_date_str: str, day_offset: int) -> str:
    """Calculates date string (YYYY-MM-DD) by safely adding day offset."""
    dt = datetime.strptime(base_date_str, "%Y-%m-%d").date()
    target_dt = dt + timedelta(days=day_offset)
    return target_dt.strftime("%Y-%m-%d")
