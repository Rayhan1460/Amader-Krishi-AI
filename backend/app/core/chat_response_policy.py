"""Answer style and general-question behavior for আমাদের কৃষি AI."""

from functools import wraps
import json
import logging
import os
import re

import httpx

BRAND_BN = "আমাদের কৃষি AI"
BRAND_EN = "Amader Krishi AI"
GENERAL_MARKER = "[[GENERAL_REPLY]]"
GENERAL_FOOTER_BN = "কৃষি নিয়েও কোনো প্রশ্ন থাকলে করতে পারেন।"
GENERAL_FOOTER_EN = "You can also ask me about agriculture."
BANGLA_WORD = re.compile(r"[\u0985-\u09b9\u09e6-\u09ef]")
LATIN_LETTER = re.compile(r"[A-Za-z]")
BENGALI_GREETING = f"ওয়ালাইকুম আসসালাম! আমি **{BRAND_BN}**। কী জানতে চান?"
SALAM = re.compile(r"a+s{1,2}a?lam(?:u|o)?a+l[aeiy]{1,3}k(?:u|o)m")
QUESTION_RUN = re.compile(r"\?{3,}|\ufffd")
OLD_MENU = "I am your research-based agricultural intelligence assistant. I can assist you with:"

ANSWER_POLICY = """
ANSWERING POLICY (applies to all conversation turns):
- The product name is "আমাদের কৃষি AI" in Bangla or "Amader Krishi AI" in English. Use that name if asked who you are. Use it once or omit the name in ordinary answers. Do not introduce yourself by the underlying provider name, show internal model keys or a capability list unless relevant and specifically requested, or open unrelated answers with an agriculture pitch.
- Answer the user's actual question first and in the user's language, even outside agriculture. Treat Bangla written in Latin letters as Bangla unless the user requests another language. Examples: solve ordinary arithmetic, explain history or programming, draft text, or translate as requested. Do not refuse or redirect solely because the topic is unrelated to agriculture. Keep ordinary safety and accuracy requirements.
- If the main request is unrelated to agriculture, give the useful answer first. Then put [[GENERAL_REPLY]] alone on the last line of your output. The application will show a short localized invitation to ask about agriculture. Do not write the invitation yourself or add an agricultural analogy unless asked.
- For farming questions, farming follow-ups, and requests about this assistant, answer directly. Do not use [[GENERAL_REPLY]]. Use available crop, weather, market, and research tools only when relevant and never claim to have run a tool unless its results were returned. If an agricultural answer requires local observations or live data you lack, say what is needed.
- Write naturally. Prefer short paragraphs, and use steps or bullets when they help. Give enough detail to satisfy the question.
"""


def is_old_menu(text: str) -> bool:
    lowered = text.lower()
    return OLD_MENU.lower() in lowered or (
        "agrisphere ai assistant" in lowered
        and sum(key in lowered for key in ("tomato_disease_v3", "rice_disease", "crop_recommendation", "regional_crop_yield", "flood_susceptibility")) >= 3
    )


def is_bangla(text: str) -> bool:
    bengali = len(BANGLA_WORD.findall(text))
    return bengali > 0 and bengali >= len(LATIN_LETTER.findall(text)) / 2


def finish_answer(text: str, question: str = "") -> str:
    lines = text.strip().splitlines()
    if lines and lines[-1].strip().strip("*_` ") == GENERAL_MARKER:
        body = "\n".join(lines[:-1]).rstrip()
        if not body:
            return ""
        bangla = is_bangla(body) if LATIN_LETTER.search(body) or BANGLA_WORD.search(body) else is_bangla(question)
        footer = GENERAL_FOOTER_BN if bangla else GENERAL_FOOTER_EN
        if not body.endswith(footer):
            body = f"{body}\n\n{footer}"
        return body
    return text.strip()


def salam_reply(query: str) -> str | None:
    compact = re.sub(r"[\s!?.,।’'\-]+", "", query.casefold())
    if SALAM.fullmatch(compact) or compact in {
        "salam", "সালাম", "আসসালামুআলাইকুম", "আসসালামুআলায়কুম", "আসসালামুআলায়েকুম",
    }:
        return BENGALI_GREETING
    return None


def corrupted_text(text: str) -> bool:
    # A cluster of replacement characters across a substantial part of the
    # answer is different from ordinary punctuation or an isolated placeholder.
    damaged = sum(len(match[0]) for match in QUESTION_RUN.finditer(text))
    visible = sum(not char.isspace() for char in text)
    return damaged >= 3 and damaged * 2 >= visible


def greeting_reply(query: str) -> str | None:
    greeting = salam_reply(query)
    if greeting:
        return greeting
    short = " ".join(query.strip().casefold().rstrip("!?।.").split())
    if short in {"hello", "hi", "hey", "good morning"}:
        return f"Hello! I’m **{BRAND_EN}**. What would you like to know?"
    if short in {"হ্যালো", "হাই", "শুভ সকাল"}:
        return f"স্বাগতম! আমি **{BRAND_BN}**। কী জানতে চান?"
    return None


def local_default(query: str) -> str:
    greeting = greeting_reply(query)
    if greeting:
        return greeting
    short = " ".join(query.strip().lower().rstrip("!?।.").split())
    if short in {"who are you", "what is your name", "তুমি কে", "আপনি কে", "তোমার নাম কী", "আপনার নাম কী"}:
        if BANGLA_WORD.search(query):
            return f"আমি **{BRAND_BN}**। ফসল, মাটি, সেচ ও কৃষি নিয়ে তথ্য বুঝতে সাহায্য করি।"
        return f"I’m **{BRAND_EN}**. I can help you understand crops, soil, irrigation, and other farming topics."
    if BANGLA_WORD.search(query):
        return "এই মুহূর্তে প্রশ্নটির উত্তর তৈরি করা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।"
    return "I couldn’t generate an answer to that question right now. Please try again shortly."


def error_code(error: Exception) -> int | None:
    value = getattr(error, "code", None) or getattr(error, "status_code", None)
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def retry_without_tools(error: Exception) -> bool:
    """Retry malformed function configuration, without retrying quota or safety errors."""
    if isinstance(error, (ValueError, TypeError)) and error_code(error) is None:
        return True
    return error_code(error) == 400 and any(
        word in str(error).lower() for word in ("function", "tool", "schema")
    )


def apply_answer_policy(instructions: str) -> str:
    first, separator, rest = instructions.partition("\n")
    identity = f"You are {BRAND_BN} ({BRAND_EN}), a bilingual assistant with research-grounded agricultural expertise."
    if first.startswith("You are AgriSphere AI Assistant") and separator:
        instructions = identity + separator + rest
    else:
        instructions = f"{identity}\n\n{instructions}"
    return instructions + ANSWER_POLICY


def local_answer(analyze):
    @wraps(analyze)
    def answer(self, query, *args, **kwargs):
        text, metadata = analyze(self, query, *args, **kwargs)
        if corrupted_text(text):
            text = _unreadable_reply(query)
        elif is_old_menu(text):
            text = local_default(query)
        return text, metadata

    return answer


def direct_answers(generate):
    @wraps(generate)
    async def answer(self, messages, user_id=None, db=None):
        history = []
        for message in messages:
            role = message.get("role")
            content = message.get("content") or ""
            if role == "assistant" and (
                not history or is_old_menu(content) or corrupted_text(content)
                or (message.get("metadata") or {}).get("answer_error") == "unreadable_text"
                or content == "The reply arrived with unreadable characters. Please send your question again."
                or content == "উত্তরটি সঠিকভাবে পাওয়া যায়নি। অনুগ্রহ করে প্রশ্নটি আবার পাঠান।"
            ):
                continue
            if role in {"user", "assistant"} and content.strip():
                history.append(message)
        question = next((item["content"] for item in reversed(history) if item["role"] == "user"), "")
        is_gemini = self.provider_id == "gemini"
        greeting = greeting_reply(question)
        if greeting:
            provider_id = "local_greeting"
            return greeting, provider_id, {"provider": provider_id}
        config_rejected = False
        try:
            reply, provider_id, metadata = await generate(self, history, user_id, db)
        except (TypeError, ValueError) as exc:
            if not is_gemini or not retry_without_tools(exc):
                raise
            reply = local_default(question)
            provider_id = "rule_based_agronomic_heuristics"
            metadata = {"provider": provider_id, "provider_fallback": True, "fallback_reason": type(exc).__name__}
            config_rejected = True

        damaged = corrupted_text(reply)
        if damaged:
            logging.getLogger("agrisphere.chat_provider").warning("Discarding malformed chat response from %s", provider_id)
        if is_old_menu(reply) or damaged:
            reply = local_default(question) if not damaged else _unreadable_reply(question)
        reason = str(metadata.get("fallback_reason", ""))
        config_rejected = config_rejected or reason in {"TypeError", "ValueError", "Gemini tool configuration rejected"}
        retry_needed = (provider_id != "gemini" and config_rejected) or (
            damaged and provider_id == "gemini" and not metadata.get("tool_invocations")
        )
        if is_gemini and retry_needed and question:
            try:
                retry = await _text_only(self, history)
                if not retry or corrupted_text(retry):
                    logging.getLogger("agrisphere.chat_provider").warning(
                        "Gemini text retry was blank or contained replacement characters"
                    )
                elif not is_old_menu(retry):
                    reply = retry
                    provider_id = "gemini"
                    metadata = {
                        "provider": provider_id, "mode_label": self.mode_label, "is_external": True,
                        "model": self.model_name, "tool_invocations": [],
                    }
            except Exception as error:
                logging.getLogger("agrisphere.chat_provider").warning(
                    "Gemini text retry failed (%s, HTTP %s)", type(error).__name__, error_code(error)
                )
        if damaged and reply == _unreadable_reply(question):
            metadata = {**metadata, "answer_error": "unreadable_text"}
        return finish_answer(reply, question) or local_default(question), provider_id, metadata

    return answer


def _unreadable_reply(question: str) -> str:
    if is_bangla(question):
        return "উত্তরটি সঠিকভাবে পাওয়া যায়নি। অনুগ্রহ করে প্রশ্নটি আবার পাঠান।"
    return "The reply arrived with unreadable characters. Please send your question again."


async def _text_only(provider, messages):
    from .chat_provider import SYSTEM_INSTRUCTION

    structured = os.environ.get("AGRISPHERE_CHAT_RETRY_FORMAT", "json") != "plain"
    return await request_text(provider.api_key, provider.model_name, messages, SYSTEM_INSTRUCTION, structured=structured)


async def request_text(api_key: str, model: str, messages, system_instruction: str, *, structured: bool) -> str:
    """Use the service's UTF-8 JSON response directly for text-only requests."""
    model = model.removeprefix("models/")
    if not re.fullmatch(r"[A-Za-z0-9._-]+", model):
        raise ValueError("Invalid model identifier")
    config = {"temperature": 0.2, "maxOutputTokens": 4096}
    if structured:
        system_instruction += """
For this response return a JSON object with one field named answer. Put your
complete response including the general-reply marker when applicable in that field.
Write valid Unicode in the JSON string. If you cannot emit Bangla letters directly,
use standard JSON Unicode escapes (one backslash followed by u and four hex digits);
do not substitute question marks for letters.
"""
        config.update({
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {"answer": {"type": "STRING"}},
                "required": ["answer"],
            },
        })
    payload = {
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "contents": [
            {"role": "user" if message["role"] == "user" else "model", "parts": [{"text": message["content"]}]}
            for message in messages
        ],
        "generationConfig": config,
    }
    # ASCII JSON escapes carry Bangla intact even if an intermediate layer mishandles request encodings.
    async with httpx.AsyncClient(timeout=httpx.Timeout(25, connect=6)) as client:
        response = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json; charset=utf-8"},
            content=json.dumps(payload, ensure_ascii=True).encode("ascii"),
        )
        response.raise_for_status()
    candidates = json.loads(response.content).get("candidates") or []
    parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
    text = "".join(part.get("text") or "" for part in parts if not part.get("thought")).strip()
    if not text or not structured:
        return text
    answer = json.loads(text).get("answer")
    return answer.strip() if isinstance(answer, str) else ""
