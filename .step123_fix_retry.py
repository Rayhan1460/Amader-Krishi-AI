import ast
import re
import subprocess
import sys
from pathlib import Path

router_path = Path("app/services/unified_intent_router.py")
quality_path = Path("app/services/bangla_answer_quality.py")

original_router = router_path.read_text(encoding="utf-8-sig")
original_quality = quality_path.read_text(encoding="utf-8-sig")

router = original_router
quality = original_quality


def replace_once(source, old, new, name):
    if source.count(old) != 1:
        raise RuntimeError("MARKER_NOT_FOUND_OR_DUPLICATE: " + name)
    return source.replace(old, new, 1)


# STEP 123: Fish and duck negation protection
if "STEP_123_NEGATION_GUARD" not in router:
    guard = '''
    # STEP_123_NEGATION_GUARD
    import re as _step123_re

    _step123_death_matches = _step123_re.finditer(
        r"মারা(?:\\s+যাচ্ছে)?|মরছে|মরেছে|"
        r"mara jacche|more jacche|\\bdying\\b|\\bdead\\b",
        q,
    )

    _step123_real_death = any(
        not _step123_re.match(
            r"\\s*(?:না|নয়|নাই)(?=\\W|$)",
            q[match.end():],
        )
        for match in _step123_death_matches
    )

    _step123_healthy_duck = bool(
        _step123_re.search(
            r"(?:অসুস্থ|রোগী)\\s*(?:না|নয়|নাই)(?=\\W|$)"
            r"|\\bnot\\s+(?:sick|ill)\\b",
            q,
        )
    )

'''
    router = replace_once(
        router,
        "    # Weather and rainfall",
        guard + "    # Weather and rainfall",
        "NEGATION_INSERT",
    )

    router = replace_once(
        router,
        '    if fish and has(\n        "মারা",',
        '    if fish and _step123_real_death and has(\n        "মারা",',
        "FISH_EMERGENCY",
    )

    router = replace_once(
        router,
        '    if has("হাঁস", "duck") and has(',
        '    if not _step123_healthy_duck and has("হাঁস", "duck") and has(',
        "DUCK_HEALTH",
    )


# STEP 123: Topic-switch priority
if "STEP_123_TOPIC_SWITCH_FIX" not in quality:
    switch = '''
    # STEP_123_TOPIC_SWITCH_FIX
    import os as _step123_os

    if _step123_os.getenv(
        "AGRISPHERE_UNIFIED_ROUTING_ENABLED", "0"
    ) == "1":
        for _switch in ("এখন", "এবার"):
            if _switch in q:
                _fragment = q.rsplit(_switch, 1)[-1].strip()

                from app.services.unified_intent_router import (
                    route_unified_answer as _route_switched_topic
                )

                _candidate = _route_switched_topic([_fragment])

                if (
                    _candidate is not None
                    and _candidate[1] == "unified_market_price"
                ):
                    return _candidate

                break

'''
    marker = '''    if (
        ("আজ" in q or "বর্তমান" in q or "এখন" in q)
        and ("দাম" in q or "দর" in q)
    ):'''

    quality = replace_once(
        quality,
        marker,
        switch + marker,
        "TOPIC_SWITCH",
    )


# Validate before writing
ast.parse(router)
ast.parse(quality)

router_backup = router_path.with_name(
    router_path.name + ".step123_safe_backup"
)
quality_backup = quality_path.with_name(
    quality_path.name + ".step123_safe_backup"
)

if not router_backup.exists():
    router_backup.write_text(original_router, encoding="utf-8")

if not quality_backup.exists():
    quality_backup.write_text(original_quality, encoding="utf-8")

try:
    router_path.write_text(router, encoding="utf-8")
    quality_path.write_text(quality, encoding="utf-8")

    print("STEP_123_PATCH_APPLIED", flush=True)

    result = subprocess.run([
        sys.executable,
        "-m",
        "pytest",
        "-q",
        "tests/test_step123_routing_safety.py",
    ])

    if result.returncode != 0:
        raise RuntimeError("ROUTING_SAFETY_TEST_FAILED")

    print("STEP_123_ROUTING_SAFETY_VERIFIED_OK")

except Exception:
    router_path.write_text(original_router, encoding="utf-8")
    quality_path.write_text(original_quality, encoding="utf-8")
    print("STEP_123_SOURCE_FILES_RESTORED")
    raise