"""AgriSphere multilingual agriculture knowledge index."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import posixpath
import re
import sqlite3
import xml.etree.ElementTree as ET

from collections import Counter
from pathlib import Path
from zipfile import ZipFile

import numpy as np


BACKEND = Path(__file__).resolve().parents[2]
PROJECT = BACKEND.parent

MODEL_DIR = (
    PROJECT
    / "model_assets"
    / "intent_classifier"
    / "AgriSphere_Trained_Intent_Model"
    / "encoder"
)

DB_PATH = (
    BACKEND
    / "knowledge_store"
    / "agrisphere_knowledge.sqlite3"
)

N = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
P = "{http://schemas.openxmlformats.org/package/2006/relationships}"


def normalize(text):
    text = str(text or "")
    text = text.replace("\ufeff", "")
    text = " ".join(text.casefold().split())
    return text.strip()


def column_number(reference):
    match = re.match(r"[A-Z]+", reference or "")

    if not match:
        return -1

    result = 0

    for letter in match.group():
        result = result * 26 + ord(letter) - 64

    return result - 1


def iter_excel_rows(filename):
    """Read XLSX without requiring openpyxl."""

    with ZipFile(filename) as archive:
        shared = []

        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(
                archive.read("xl/sharedStrings.xml")
            )

            for item in root.findall(N + "si"):
                shared.append(
                    "".join(
                        node.text or ""
                        for node in item.iter(N + "t")
                    )
                )

        workbook = ET.fromstring(
            archive.read("xl/workbook.xml")
        )

        relationships = ET.fromstring(
            archive.read("xl/_rels/workbook.xml.rels")
        )

        targets = {
            item.attrib["Id"]: item.attrib["Target"]
            for item in relationships.findall(
                P + "Relationship"
            )
        }

        sheets = workbook.findall(
            ".//" + N + "sheet"
        )

        for sheet in sheets:
            path = targets[sheet.attrib[R + "id"]]

            if path.startswith("/"):
                path = path.lstrip("/")
            else:
                path = posixpath.normpath(
                    posixpath.join("xl", path)
                )

            headers = None

            with archive.open(path) as stream:
                for _, element in ET.iterparse(
                    stream, events=("end",)
                ):
                    if element.tag != N + "row":
                        continue

                    cells = {}

                    for cell in element.findall(N + "c"):
                        index = column_number(
                            cell.attrib.get("r", "")
                        )

                        cell_type = cell.attrib.get(
                            "t", ""
                        )

                        value_node = cell.find(N + "v")

                        if cell_type == "inlineStr":
                            value = "".join(
                                item.text or ""
                                for item in cell.iter(N + "t")
                            )

                        elif value_node is None:
                            value = ""

                        elif cell_type == "s":
                            value = shared[
                                int(value_node.text)
                            ]

                        else:
                            value = (
                                value_node.text or ""
                            )

                        cells[index] = str(value).strip()

                    element.clear()

                    if not any(cells.values()):
                        continue

                    if headers is None:
                        candidate = {
                            str(value).upper(): index
                            for index, value in cells.items()
                        }

                        if (
                            "QUESTION" in candidate
                            and "ANSWER" in candidate
                        ):
                            headers = candidate

                        continue

                    row = {
                        name: cells.get(index, "")
                        for name, index in headers.items()
                    }

                    if row.get("QUESTION", "").strip():
                        yield row


def get_encoder():
    """Load the existing local multilingual encoder."""

    os.environ.setdefault("USE_TF", "0")
    os.environ.setdefault("USE_TORCH", "1")

    if not MODEL_DIR.exists():
        raise RuntimeError(
            "LOCAL_ENCODER_NOT_FOUND: "
            + str(MODEL_DIR)
        )

    try:
        from sentence_transformers import (
            SentenceTransformer,
        )

    except ImportError as exc:
        raise RuntimeError(
            "SENTENCE_TRANSFORMERS_NOT_INSTALLED"
        ) from exc

    return SentenceTransformer(
        str(MODEL_DIR),
        device="cpu",
        local_files_only=True,
        trust_remote_code=False,
    )


def connect():
    DB_PATH.parent.mkdir(
        parents=True, exist_ok=True
    )

    connection = sqlite3.connect(
        str(DB_PATH), timeout=30
    )

    connection.execute(
        "PRAGMA busy_timeout = 30000"
    )

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS qa (
            qa_id TEXT PRIMARY KEY,
            intent_id TEXT,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            language TEXT,
            category TEXT,
            verification_status TEXT,
            answer_type TEXT,
            content_hash TEXT NOT NULL,
            metadata_json TEXT NOT NULL,
            embedding BLOB NOT NULL
        )
        """
    )

    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_qa_intent
        ON qa(intent_id)
        """
    )

    connection.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_qa_category
        ON qa(category)
        """
    )

    connection.commit()

    return connection


def content_hash(row):
    payload = json.dumps(
        row,
        ensure_ascii=False,
        sort_keys=True,
    ).encode("utf-8")

    return hashlib.sha256(
        payload
    ).hexdigest()


def import_dataset(filename):
    source = Path(filename)

    if not source.is_file():
        raise FileNotFoundError(source)

    print("AGRISPHERE_BATCH_IMPORT_START")
    print("SOURCE:", source)

    rows = list(iter_excel_rows(source))

    print("SOURCE_RECORDS:", len(rows))

    seen = set()

    for row in rows:
        qa_id = str(
            row.get("QA_ID", "")
        ).strip()

        if not qa_id:
            raise ValueError(
                "EMPTY_QA_ID_DETECTED"
            )

        if qa_id in seen:
            raise ValueError(
                "DUPLICATE_QA_ID: " + qa_id
            )

        seen.add(qa_id)

        if not row.get("ANSWER", "").strip():
            raise ValueError(
                "EMPTY_ANSWER: " + qa_id
            )

    connection = connect()

    try:
        existing = {
            qa_id: sha
            for qa_id, sha in connection.execute(
                "SELECT qa_id, content_hash FROM qa"
            )
        }

        changed = []

        unchanged = 0
        inserted = 0
        updated = 0

        for row in rows:
            qa_id = row["QA_ID"]
            sha = content_hash(row)

            if existing.get(qa_id) == sha:
                unchanged += 1
                continue

            changed.append((row, sha))

            if qa_id in existing:
                updated += 1
            else:
                inserted += 1

        print("NEW_RECORDS:", inserted)
        print("UPDATED_RECORDS:", updated)
        print("UNCHANGED_RECORDS:", unchanged)

        if changed:
            encoder = get_encoder()

            for start in range(
                0, len(changed), 64
            ):
                batch = changed[
                    start:start + 64
                ]

                texts = [
                    "passage: "
                    + row["QUESTION"]
                    for row, _ in batch
                ]

                vectors = encoder.encode(
                    texts,
                    batch_size=32,
                    normalize_embeddings=True,
                    convert_to_numpy=True,
                    show_progress_bar=False,
                )

                records = []

                for (row, sha), vector in zip(
                    batch, vectors
                ):
                    vector_bytes = (
                        np.asarray(
                            vector,
                            dtype=np.float32,
                        ).tobytes()
                    )

                    records.append((
                        row["QA_ID"],
                        row.get("INTENT_ID", ""),
                        row["QUESTION"],
                        row["ANSWER"],
                        row.get("LANGUAGE", ""),
                        row.get("CATEGORY", ""),
                        row.get(
                            "VERIFICATION_STATUS", ""
                        ),
                        row.get("ANSWER_TYPE", ""),
                        sha,
                        json.dumps(
                            row, ensure_ascii=False
                        ),
                        vector_bytes,
                    ))

                connection.executemany(
                    """
                    INSERT INTO qa (
                        qa_id, intent_id,
                        question, answer,
                        language, category,
                        verification_status,
                        answer_type,
                        content_hash,
                        metadata_json,
                        embedding
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(qa_id) DO UPDATE SET
                        intent_id = excluded.intent_id,
                        question = excluded.question,
                        answer = excluded.answer,
                        language = excluded.language,
                        category = excluded.category,
                        verification_status =
                            excluded.verification_status,
                        answer_type =
                            excluded.answer_type,
                        content_hash =
                            excluded.content_hash,
                        metadata_json =
                            excluded.metadata_json,
                        embedding =
                            excluded.embedding
                    """,
                    records,
                )

                connection.commit()

                print(
                    "INDEXED:",
                    min(
                        start + len(batch),
                        len(changed),
                    ),
                    "/",
                    len(changed),
                    flush=True,
                )

        total = connection.execute(
            "SELECT COUNT(*) FROM qa"
        ).fetchone()[0]

        print("KNOWLEDGE_BASE_TOTAL:", total)
        print("DATABASE:", DB_PATH)
        print("AGRISPHERE_BATCH_IMPORT_COMPLETE")

    finally:
        connection.close()


def search(question, limit=5):
    if not normalize(question):
        return []

    if not DB_PATH.exists():
        raise RuntimeError(
            "KNOWLEDGE_DATABASE_NOT_IMPORTED"
        )

    encoder = get_encoder()

    query_vector = encoder.encode(
        ["query: " + question],
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )[0]

    query_vector = np.asarray(
        query_vector, dtype=np.float32
    )

    connection = connect()

    try:
        rows = connection.execute(
            """
            SELECT
                qa_id, question, answer,
                language, category,
                verification_status,
                answer_type,
                metadata_json,
                embedding
            FROM qa
            """
        ).fetchall()

    finally:
        connection.close()

    if not rows:
        return []

    valid = []

    for row in rows:
        vector = np.frombuffer(
            row[8], dtype=np.float32
        )

        if vector.shape == query_vector.shape:
            valid.append((row, vector))

    if not valid:
        return []

    matrix = np.vstack([
        vector for _, vector in valid
    ])

    scores = matrix @ query_vector

    # Similarity is a ranking score, not
    # a calibrated probability of correctness.
    order = np.argsort(scores)[::-1][
        :limit
    ]

    results = []

    for index in order:
        row = valid[int(index)][0]

        results.append({
            "qa_id": row[0],
            "question": row[1],
            "answer": row[2],
            "language": row[3],
            "category": row[4],
            "verification_status": row[5],
            "answer_type": row[6],
            "metadata": json.loads(row[7]),
            "similarity": round(
                float(scores[int(index)]), 4
            ),
        })

    return results


def stats():
    if not DB_PATH.exists():
        print("DATABASE_NOT_IMPORTED")
        return

    connection = connect()

    try:
        print(
            "TOTAL_RECORDS:",
            connection.execute(
                "SELECT COUNT(*) FROM qa"
            ).fetchone()[0],
        )

        for status, count in connection.execute(
            """
            SELECT verification_status, COUNT(*)
            FROM qa
            GROUP BY verification_status
            ORDER BY COUNT(*) DESC
            """
        ):
            print(
                "VERIFICATION:",
                status,
                count,
            )

    finally:
        connection.close()


def main():
    parser = argparse.ArgumentParser(
        description=(
            "AgriSphere Agriculture "
            "Knowledge Base"
        )
    )

    sub = parser.add_subparsers(
        dest="command", required=True
    )

    importer = sub.add_parser("import")
    importer.add_argument("excel")

    searcher = sub.add_parser("search")
    searcher.add_argument("question")
    searcher.add_argument(
        "--limit", type=int, default=5
    )

    sub.add_parser("stats")

    args = parser.parse_args()

    if args.command == "import":
        import_dataset(args.excel)

    elif args.command == "search":
        print("SEMANTIC_SEARCH_START")

        for result in search(
            args.question,
            limit=args.limit,
        ):
            print()
            print("QA_ID:", result["qa_id"])
            print(
                "SIMILARITY:",
                result["similarity"],
            )
            print(
                "LANGUAGE:",
                result["language"],
            )
            print(
                "CATEGORY:",
                result["category"],
            )
            print(
                "VERIFICATION:",
                result["verification_status"],
            )
            print(
                "QUESTION:",
                result["question"],
            )
            print(
                "ANSWER_PREVIEW:",
                result["answer"][:250],
            )

        print("SEMANTIC_SEARCH_COMPLETE")

    elif args.command == "stats":
        stats()


if __name__ == "__main__":
    main()