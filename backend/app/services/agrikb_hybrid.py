"""AgriSphere hybrid knowledge retrieval — evaluation stage."""

from __future__ import annotations

import re
import sqlite3
import sys

from functools import lru_cache
from math import sqrt

import numpy as np

from . import agrikb_engine as kb


ALIASES = {
    "dhan": "ধান",
    "dhaner": "ধান",
    "rice": "ধান",
    "paddy": "ধান",
    "pata": "পাতা",
    "patar": "পাতা",
    "patay": "পাতা",
    "holud": "হলুদ",
    "holod": "হলুদ",
    "yellow": "হলুদ",
    "mach": "মাছ",
    "maach": "মাছ",
    "fish": "মাছ",
    "pukur": "পুকুর",
    "pond": "পুকুর",
    "mati": "মাটি",
    "matir": "মাটি",
    "soil": "মাটি",
    "sar": "সার",
    "fertilizer": "সার",
    "duck": "হাঁস",
    "hash": "হাঁস",
    "ধানের": "ধান",
    "পাতায়": "পাতা",
    "পাতার": "পাতা",
    "পাতাগুলো": "পাতা",
    "হলুদাভ": "হলুদ",
    "মাটির": "মাটি",
}

STOPWORDS = {
    "amar", "ami", "amr", "amader",
    "farm", "farmer", "farming",
    "e", "er", "ki", "kivabe", "korbo",
    "keno", "hoy", "hoye", "jacche",
    "the", "a", "an", "i", "my",
    "is", "are", "how", "do", "can",
    "what", "why", "to", "of", "for",
    "with", "in", "on", "get", "started",
    "improve", "important",
    "আমার", "আমি", "আমাদের", "খামারে",
    "কী", "কি", "কেন", "কিভাবে",
    "কীভাবে", "হয়", "হচ্ছে",
    "করব", "করতে", "দিয়ে",
    "এবং", "একটি", "জন্য",
    "কত", "থেকে", "যাচ্ছে",
    "ব্যাপারে", "গুরুত্বপূর্ণ",
}

TOKEN_RE = re.compile(
    r"[A-Za-z0-9\u0980-\u09FF]+"
)


def tokens(text):
    return [
        ALIASES.get(word, word)
        for word in TOKEN_RE.findall(
            str(text).casefold()
        )
        if word not in STOPWORDS
    ]


def expand_query(text):
    words = tokens(text)

    if not words:
        return text

    return " ".join(words)


@lru_cache(maxsize=1)
def encoder():
    return kb.get_encoder()


@lru_cache(maxsize=2)
def load_index(modified_ns, file_size):
    with sqlite3.connect(
        str(kb.DB_PATH)
    ) as connection:
        rows = connection.execute(
            """
            SELECT
                qa_id,
                intent_id,
                question,
                answer,
                language,
                category,
                verification_status,
                answer_type,
                metadata_json,
                embedding
            FROM qa
            """
        ).fetchall()

    valid_rows = []
    vectors = []
    term_sets = []

    dimension = None

    for row in rows:
        vector = np.frombuffer(
            row[9],
            dtype=np.float32,
        )

        if vector.size == 0:
            continue

        if dimension is None:
            dimension = vector.size

        if vector.size != dimension:
            continue

        valid_rows.append(row)
        vectors.append(vector)

        term_sets.append(
            set(tokens(row[2]))
        )

    if not vectors:
        raise RuntimeError(
            "KNOWLEDGE_INDEX_IS_EMPTY"
        )

    matrix = np.ascontiguousarray(
        np.vstack(vectors),
        dtype=np.float32,
    )

    return valid_rows, matrix, term_sets


def hybrid_search(question, limit=5):
    if not kb.DB_PATH.is_file():
        raise RuntimeError(
            "IMPORT_DATASET_FIRST"
        )

    stat = kb.DB_PATH.stat()

    rows, matrix, term_sets = load_index(
        stat.st_mtime_ns,
        stat.st_size,
    )

    expanded = expand_query(question)

    queries = [question]

    if expanded.casefold() != question.casefold():
        queries.append(expanded)

    vectors = encoder().encode(
        ["query: " + q for q in queries],
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )

    vectors = np.asarray(
        vectors,
        dtype=np.float32,
    )

    dense_scores = np.max(
        matrix @ vectors.T,
        axis=1,
    )

    query_terms = set(tokens(question))

    lexical_scores = np.zeros(
        len(rows),
        dtype=np.float32,
    )

    if query_terms:
        for i, candidate_terms in enumerate(
            term_sets
        ):
            common = len(
                query_terms & candidate_terms
            )

            if common:
                lexical_scores[i] = (
                    common
                    / sqrt(
                        len(query_terms)
                        * max(len(candidate_terms), 1)
                    )
                )

    # Experimental ranking weights.
    # These are NOT calibrated confidence values.
    final_scores = (
        0.65 * dense_scores
        + 0.35 * lexical_scores
    )

    ranked = np.argsort(
        final_scores
    )[::-1]

    results = []
    seen_intents = set()

    for index in ranked:
        row = rows[int(index)]

        intent = row[1] or row[0]

        if intent in seen_intents:
            continue

        seen_intents.add(intent)

        verification = row[6]
        answer_type = row[7]

        results.append({
            "qa_id": row[0],
            "intent_id": intent,
            "question": row[2],
            "language": row[4],
            "category": row[5],
            "verification": verification,
            "answer_type": answer_type,
            "dense_score": round(
                float(dense_scores[index]), 4
            ),
            "lexical_score": round(
                float(lexical_scores[index]), 4
            ),
            "ranking_score": round(
                float(final_scores[index]), 4
            ),
            "review_required": (
                verification !=
                "VERIFIED_GENERAL_GUIDANCE"
            ),
            "live_data_required": (
                answer_type ==
                "LIVE_DATA_REQUIRED"
            ),
        })

        if len(results) >= limit:
            break

    return results


def main():
    questions = [
        (
            "BANGLA_RICE_LEAF",
            "আমার ধানের পাতায় হলুদ দাগ হচ্ছে কেন?",
        ),
        (
            "BANGLISH_RICE_LEAF",
            "Amar dhan er pata holud hoye jacche ki korbo?",
        ),
        (
            "ENGLISH_SOIL",
            "How do I improve soil fertility?",
        ),
        (
            "BANGLA_MARKET",
            "আজ আলুর দাম প্রতি কেজি কত?",
        ),
    ]

    if len(sys.argv) > 1:
        questions = [
            ("CUSTOM", " ".join(sys.argv[1:]))
        ]

    print("STEP_127_HYBRID_AUDIT_START")

    for label, question in questions:
        print()
        print("CASE:", label)
        print("USER_QUESTION:", question)

        results = hybrid_search(
            question,
            limit=3,
        )

        for rank, result in enumerate(
            results, start=1
        ):
            print(
                f"RANK_{rank}:",
                result["qa_id"],
                "|",
                result["category"],
            )

            print(
                "MATCHED_QUESTION:",
                result["question"],
            )

            print(
                "SCORES:",
                "dense=",
                result["dense_score"],
                "lexical=",
                result["lexical_score"],
                "ranking=",
                result["ranking_score"],
            )

            print(
                "VERIFICATION:",
                result["verification"],
            )

            print(
                "LIVE_DATA_REQUIRED:",
                result["live_data_required"],
            )

    print()
    print("STEP_127_HYBRID_AUDIT_COMPLETE")


if __name__ == "__main__":
    main()