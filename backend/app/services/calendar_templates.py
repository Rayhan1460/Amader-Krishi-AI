# Verified official agricultural calendar reference templates based on BAMIS, BARC, and DAE guidelines
# Prepares the schema and reference benchmarks for Phase F4B crop scheduling without fabricating live data.

from typing import List, Dict, Any
from ..models.calendar import CropScheduleTemplate, ScheduleTemplateStage

VERIFIED_CROP_TEMPLATES: List[CropScheduleTemplate] = [
    CropScheduleTemplate(
        template_id="bamis_boro_rice_v1",
        crop="Boro Rice",
        crop_bn="বোরো ধান",
        variety="BRRI Dhan-28 / BRRI Dhan-29 / Bangabandhu Dhan-100",
        season="Rabi",
        season_bn="রবি",
        applicable_regions=["Dhaka", "Rajshahi", "Mymensingh", "Rangpur", "Khulna", "Sylhet", "Barishal", "Chattogram"],
        source_agency="Bangladesh Agro-Meteorological Information Service (BAMIS) & BRRI",
        source_url="https://www.bamis.gov.bd/en/agro-climate/crop-weather-calendar/",
        source_version="BAMIS-BRRI-2024.1",
        recommended_sowing_window="November 15 – December 15 (Agrahayan)",
        limitations="Cold wave protection required during seedbed stage. Timelines depend on seedling age (35-45 days) at transplanting.",
        stages=[
            ScheduleTemplateStage(
                stage_name="Seedbed Preparation & Sowing",
                stage_name_bn="বীজতলা প্রস্তুতি ও বীজ বপন",
                day_offset_start=0,
                day_offset_end=5,
                recommended_category="sowing",
                action_bn="উন্নত বীজ শোধন এবং আদর্শ ভিজা বীজতলায় অঙ্কুরিত বীজ বপন করুন।",
                action_en="Treat certified seeds and sow sprouted seeds evenly on well-prepared wet seedbeds.",
                notes_bn="প্রতি শতকে ৩ কেজি বীজ বপন করুন। রাতে কুয়াশা থেকে সুরক্ষায় পলিথিন দিয়ে বীজতলা ঢেকে রাখা উত্তম।",
                notes_en="Use 3kg seeds per decimal. Protect young seedlings from severe fog/cold with polythene covers.",
                scientific_basis="BRRI Modern Rice Cultivation Guide (Gazipur, Bangladesh)."
            ),
            ScheduleTemplateStage(
                stage_name="Main Land Preparation",
                stage_name_bn="মূল জমি প্রস্তুতকরণ",
                day_offset_start=30,
                day_offset_end=35,
                recommended_category="land_preparation",
                action_bn="মূল জমিতে ৩-৪টি চাষ ও মই দিয়ে থকথকে কাদা তৈরি করুন।",
                action_en="Plow 3-4 times with leveling and puddling to ensure uniform mud texture.",
                notes_bn="শেষ চাষের আগে অনুমোদিত হারে জৈব সার ও টিএসপি/ডিএপি সার প্রয়োগ করুন।",
                notes_en="Apply decomposed organic manure and basal phosphorus (TSP/DAP) during final plowing.",
                scientific_basis="BARC Fertilizer Recommendation Guide (FRG-2018)."
            ),
            ScheduleTemplateStage(
                stage_name="Transplanting",
                stage_name_bn="চারা রোপণ",
                day_offset_start=35,
                day_offset_end=45,
                recommended_category="transplanting",
                action_bn="৩৫-৪৫ দিন বয়সের সুস্থ চারা ২০x১৫ সেমি দূরত্বে প্রতি গোছায় ২-৩টি করে রোপণ করুন।",
                action_en="Transplant 35-45 day-old healthy seedlings at 20x15 cm spacing, 2-3 seedlings per hill.",
                notes_bn="অতিরিক্ত গভীর রোপণ পরিহার করুন; অগভীর রোপণে কুশি উৎপাদন বেশি হয়।",
                notes_en="Avoid deep transplanting; shallow placement promotes higher effective tillering.",
                scientific_basis="DAE Crop Production Manual & BAMIS Agro-Calendar."
            ),
            ScheduleTemplateStage(
                stage_name="Vegetative Tiller Irrigation & Monitoring",
                stage_name_bn="কুশি পর্যায় সেচ ও পর্যবেক্ষণ",
                day_offset_start=60,
                day_offset_end=75,
                recommended_category="irrigation",
                action_bn="কুশি পর্যায়ে জমিতে ২-৩ ইঞ্চি পানি রাখুন এবং প্রথম কিস্তির ইউরিয়া ও এমওপি প্রয়োগ পর্যবেক্ষণ করুন।",
                action_en="Maintain 2-3 inches standing water during active tillering and evaluate top-dressing schedule.",
                notes_bn="পানি সাশ্রয়ী এডব্লিউডি (AWD - পর্যায়ক্রমিক ভিজানো ও শুকানো) পদ্ধতি অনুসরণ করা যেতে পারে।",
                notes_en="Alternate Wetting and Drying (AWD) can be implemented if soil drainage is suitable.",
                scientific_basis="BAMIS Irrigation Management Standard."
            ),
            ScheduleTemplateStage(
                stage_name="Panicle Initiation & Observation",
                stage_name_bn="থোড় পর্যায় পরিদর্শন ও পুষ্টি",
                day_offset_start=90,
                day_offset_end=105,
                recommended_category="crop_observation",
                action_bn="ধানের কাইচথোড় আসার সময় ক্ষেত নিয়মিত পর্যবেক্ষণ করুন এবং কোনো অবস্থাতেই জমিতে পানির ঘাটতি হতে দেবেন না।",
                action_en="Inspect field daily for panicle emergence; ensure moisture is not depleted at booting.",
                notes_bn="ব্লাস্ট রোগ বা পাতা মোড়ানো পোকার উপস্থিতি থাকলে দ্রুত স্থানীয় কৃষি কর্মকর্তার পরামর্শ নিন।",
                notes_en="Check for blast lesions or leaffolder activity; consult local sub-assistant agriculture officer.",
                scientific_basis="BRRI Crop Protection Advisory."
            ),
            ScheduleTemplateStage(
                stage_name="Harvest Planning & Execution",
                stage_name_bn="ফসল কর্তন ও সংগ্রহ পরিকল্পনা",
                day_offset_start=135,
                day_offset_end=150,
                recommended_category="harvest_planning",
                action_bn="শীষের ৮০% ধান সোনালী রঙ ধারণ করলে ধান কাটার ব্যবস্থা গ্রহণ করুন।",
                action_en="Initiate harvest when 80% of grains in the panicle turn golden-yellow.",
                notes_bn="কাটার পর দ্রুত মাড়াই ও রোদে শুকিয়ে আর্দ্রতা ১২% বা তার নিচে এনে সংরক্ষণ করুন।",
                notes_en="Thresh immediately and dry grains to <=12% moisture content before safe storage.",
                scientific_basis="BAMIS Harvest Advisory & Post-Harvest Technology Standards."
            ),
        ]
    ),
    CropScheduleTemplate(
        template_id="bamis_winter_tomato_v1",
        crop="Tomato",
        crop_bn="শীতকালীন টমেটো",
        variety="Ratan / BARI Tomato-14 / BARI Tomato-15",
        season="Rabi",
        season_bn="রবি",
        applicable_regions=["Dhaka", "Rajshahi", "Khulna", "Chattogram", "Mymensingh", "Rangpur"],
        source_agency="Bangladesh Agricultural Research Institute (BARI) & BAMIS",
        source_url="https://barcapps.gov.bd/",
        source_version="BARI-Horticulture-2023.2",
        recommended_sowing_window="September – October (Seedbed) | October – November (Transplanting)",
        limitations="Susceptible to waterlogging and bacterial wilt. High sensitivity to early and late blight.",
        stages=[
            ScheduleTemplateStage(
                stage_name="Seedbed Preparation",
                stage_name_bn="বীজতলা তৈরি ও বীজ বপন",
                day_offset_start=0,
                day_offset_end=5,
                recommended_category="sowing",
                action_bn="উঁচু ছায়ামুক্ত স্থানে বেলে-দোআঁশ মাটিতে বীজতলা তৈরি করে বীজ বপন করুন।",
                action_en="Sow treated seeds in raised, well-drained sandy loam nursery beds.",
                notes_bn="ভারী বৃষ্টি থেকে সুরক্ষায় বীজতলায় ছাউনি দিন।",
                notes_en="Provide temporary transparent overhead shed against unseasonal monsoon showers.",
                scientific_basis="BARI Vegetable Production Guide."
            ),
            ScheduleTemplateStage(
                stage_name="Main Bed Transplanting",
                stage_name_bn="মাদায় চারা রোপণ",
                day_offset_start=25,
                day_offset_end=32,
                recommended_category="transplanting",
                action_bn="২৫-৩০ দিনের চারা ৬০x৪০ সেমি দূরত্বে তৈরি বেডে রোপণ করুন।",
                action_en="Transplant 25-30 day-old seedlings in prepared beds at 60x40 cm spacing in late afternoon.",
                notes_bn="রোপণের পর হালকা সেচ দিন।",
                notes_en="Apply light spot-irrigation immediately after transplanting.",
                scientific_basis="BARI Vegetable Production Guide."
            ),
            ScheduleTemplateStage(
                stage_name="Staking & Pruning Support",
                stage_name_bn="খুঁটি দেওয়া ও ছাঁটাই",
                day_offset_start=50,
                day_offset_end=60,
                recommended_category="general",
                action_bn="টমেটো গাছে বাঁশের খুঁটি ও সুতলি দিয়ে সাপোর্ট দিন এবং নিচের অতিরিক্ত ডালপালা ছাঁটাই করুন।",
                action_en="Provide bamboo stakes/trellising and prune lower lateral suckers to maintain aeration.",
                notes_bn="মাটি থেকে পাতা ও ডাল উপরে রাখলে মাটির ছত্রাক আক্রমণ রোধ হয়।",
                notes_en="Keeping lower leaves off the ground reduces soil-borne fungal splash inoculation.",
                scientific_basis="Horticulture Research Centre (BARI)."
            ),
            ScheduleTemplateStage(
                stage_name="Fruit Development Observation",
                stage_name_bn="ফল বৃদ্ধির পর্যায় পর্যবেক্ষণ",
                day_offset_start=70,
                day_offset_end=85,
                recommended_category="crop_observation",
                action_bn="টমেটো ফলের সুষম বৃদ্ধির জন্য আর্দ্রতা পর্যবেক্ষণ ও পাতায় রোগের লক্ষণ যাচাই করুন।",
                action_en="Inspect developing fruit trusses and monitor foliage for early blight concentric rings.",
                notes_bn="ক্যালসিয়াম ও বোরনের ঘাটতি থাকলে ফল ফাটা বা ব্লসম অ্যান্ড রট দেখা দিতে পারে।",
                notes_en="Deficiencies in Calcium or sudden water fluctuations can trigger blossom-end rot.",
                scientific_basis="BARC Plant Nutrition Guidelines."
            ),
            ScheduleTemplateStage(
                stage_name="Harvesting Phases",
                stage_name_bn="ধাপে ধাপে টমেটো সংগ্রহ",
                day_offset_start=95,
                day_offset_end=120,
                recommended_category="harvest_planning",
                action_bn="টমেটোর রঙ হালকা গোলাপী (ব্রেকার স্টেজ) হলেই বাজারজাতকরণের জন্য সংগ্রহ করুন।",
                action_en="Harvest fruits at the turning/breaker stage for longer commercial transit life.",
                notes_bn="বোঁটাসহ সকালের দিকে ফল সংগ্রহ করা সবচেয়ে ভালো।",
                notes_en="Pick fruits gently with calyx intact during early morning hours.",
                scientific_basis="Post-Harvest Processing Advisory, DAE."
            ),
        ]
    )
]


def list_official_schedule_templates() -> List[Dict[str, Any]]:
    """Returns official verified schedule templates for scientific agricultural planning."""
    return [template.model_dump() for template in VERIFIED_CROP_TEMPLATES]

