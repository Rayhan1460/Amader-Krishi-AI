import re


def select_fish_feeding_reply(messages):
    users = [
        str(m.get("content") or "")
        for m in messages
        if m.get("role") == "user"
    ]
    if not users:
        return None

    raw = users[-1].lower()
    q = "".join(raw.split())
    roman = set(re.findall(r"[a-z]+", raw))

    fish = "মাছ" in q or bool(
        roman & {"mas", "maser", "mach", "macher", "fish"}
    )
    food = any(x in q for x in (
        "খাবার", "খাওয়", "খাওয়", "খাদ্য", "ফিড"
    )) or bool(roman & {"khabar", "khawar", "feed", "feeding"})
    timing = any(x in q for x in (
        "কখন", "কতবার", "কয়বার", "সময়", "সময়"
    )) or bool(roman & {"kokhon", "kobe", "kotobar", "koybar", "when"})

    if not (fish and food and timing):
        return None

    previous = [
        "".join(x.split())
        for x in users[-4:-1]
    ]
    recent_risk = any("হাঁসফাঁস" in x for x in previous)

    if recent_risk:
        reply = (
            "### মাছের খাবার দেওয়ার সময়\n\n"
            "আগের কথোপকথনে মাছের হাঁসফাঁস করার বিষয়টি উল্লেখ করেছেন। "
            "যদি এখনো মাছ হাঁসফাঁস করে, আপাতত খাবার দেবেন না। "
            "আগে পানিতে অক্সিজেনের ব্যবস্থা করুন, সম্ভব হলে DO পরীক্ষা করুন "
            "এবং স্থানীয় মৎস্য কর্মকর্তার সহায়তা নিন।\n\n"
            "মাছ স্বাভাবিক হলে প্রজাতি ও বয়স অনুযায়ী সাধারণত "
            "সকালে সূর্য ওঠার পর এবং বিকেলে খাবার দেওয়া যায়। "
            "মাছ এখনো হাঁসফাঁস করছে কি?"
        )
    else:
        reply = (
            "### মাছের খাবার দেওয়ার সময়\n\n"
            "সাধারণভাবে সকালে সূর্য ওঠার পর এবং বিকেলে "
            "মাছকে খাবার দেওয়া যায়। তবে মাছের প্রজাতি, বয়স, "
            "পানির তাপমাত্রা ও খাওয়ার আচরণ অনুযায়ী সময় এবং "
            "পরিমাণ পরিবর্তন করতে হয়। অতিরিক্ত খাবার দেবেন না।\n\n"
            "মাছ পানির ওপরে উঠে হাঁসফাঁস করলে খাবার বন্ধ রেখে "
            "পানির অক্সিজেন পরীক্ষা করুন। "
            "আপনার পুকুরে কোন প্রজাতির মাছ আছে?"
        )

    return reply, "fish_feeding_time"
