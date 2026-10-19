#!/usr/bin/env python3
"""Builds client/src/data/vocabulary-bank.json from the vocabulary spreadsheet.

Usage (from the project root):
    python3 tools/import-vocabulary.py [path/to/spreadsheet.xlsx]

Edit the spreadsheet, run this tool, commit both files. The spreadsheet is the single source of truth for
the vocabulary cards. Only the Python standard library is used. The tool stops with a clear message when
the data is inconsistent (missing fields, duplicate ids or terms, wrong level names).
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_XLSX = ROOT / "data" / "Mechatronics_Robotics_Vocabulary_Complete.xlsx"
OUTPUT = ROOT / "client" / "src" / "data" / "vocabulary-bank.json"

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
LEVELS = ["Beginner", "Intermediate", "Advanced"]
ARABIC = re.compile(r"[؀-ۿ]")
REQUIRED = ["content_id", "Term", "Arabic meaning", "Pronunciation", "Category", "Simple English definition", "Example 1", "Arabic translation 1", "Example 2", "Arabic translation 2", "Difficulty level", "Stage #"]


def fail(message):
    sys.exit(f"IMPORT ERROR: {message}")


def column_index(reference):
    number = 0
    for char in re.match(r"[A-Z]+", reference).group():
        number = number * 26 + ord(char) - 64
    return number - 1


def read_workbook(path):
    archive = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in archive.namelist():
        for item in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("m:si", NS):
            shared.append("".join(node.text or "" for node in item.iter("{%s}t" % NS["m"])))
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relations = {rel.get("Id"): rel.get("Target") for rel in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))}
    sheets = {}
    for sheet in workbook.find("m:sheets", NS):
        target = relations[sheet.get("{%s}id" % NS["r"])].lstrip("/")
        target = target if target.startswith("xl/") else "xl/" + target
        rows = []
        for row in ET.fromstring(archive.read(target)).find("m:sheetData", NS):
            cells = {}
            for cell in row:
                value = cell.find("m:v", NS)
                kind = cell.get("t")
                if kind == "s" and value is not None:
                    text = shared[int(value.text)]
                elif kind == "inlineStr":
                    text = "".join(node.text or "" for node in cell.iter("{%s}t" % NS["m"]))
                else:
                    text = value.text if value is not None else ""
                cells[column_index(cell.get("r"))] = (text or "").strip()
            if cells:
                rows.append([cells.get(i, "") for i in range(max(cells) + 1)])
        sheets[sheet.get("name")] = rows
    return sheets


def table(rows, header_first_cell):
    for index, row in enumerate(rows):
        if row and row[0] == header_first_cell:
            header = row
            return [dict(zip(header, record + [""] * (len(header) - len(record)))) for record in rows[index + 1:] if record and record[0]]
    fail(f"header row starting with {header_first_cell!r} not found")


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLSX
    if not path.exists():
        fail(f"file not found: {path}")
    sheets = read_workbook(path)
    if "All Terms" not in sheets or "Curriculum" not in sheets:
        fail("the workbook needs the sheets 'All Terms' and 'Curriculum'")

    rows = table(sheets["All Terms"], "content_id")
    ids, terms, bank = set(), set(), []
    for row in rows:
        label = row.get("content_id") or "?"
        for field in REQUIRED:
            if not row.get(field, "").strip():
                fail(f"{label}: field '{field}' is empty")
        if not re.fullmatch(r"S[1-9]-[A-Z]{4}-\d{3}", row["content_id"]):
            fail(f"{label}: content_id must look like S1-KINE-001")
        if row["content_id"] in ids:
            fail(f"duplicate content_id {label}")
        ids.add(row["content_id"])
        key = row["Term"].lower()
        if key in terms:
            fail(f"duplicate term {row['Term']!r} ({label})")
        terms.add(key)
        if row["Difficulty level"] not in LEVELS:
            fail(f"{label}: level must be one of {LEVELS}, got {row['Difficulty level']!r}")
        if not row["Stage #"].isdigit():
            fail(f"{label}: Stage # must be a number")
        for field in ["Arabic meaning", "Arabic translation 1", "Arabic translation 2"]:
            if not ARABIC.search(row[field]):
                fail(f"{label}: '{field}' must contain Arabic text")
        for field in ["Example 1", "Example 2"]:
            if ARABIC.search(row[field]):
                fail(f"{label}: '{field}' must be English")
        bank.append({
            "id": row["content_id"],
            "term": row["Term"],
            "ar": row["Arabic meaning"],
            "pron": row["Pronunciation"],
            "cat": row["Category"],
            "def": row["Simple English definition"],
            "ex": [{"en": row["Example 1"], "ar": row["Arabic translation 1"]}, {"en": row["Example 2"], "ar": row["Arabic translation 2"]}],
            "level": row["Difficulty level"],
            "stage": int(row["Stage #"]),
            "prio": row.get("Interview priority", "") == "High",
            "qa": [item.strip() for item in row.get("Linked Q&A / troubleshooting", "").split(";") if item.strip()],
            "src": row.get("Source", ""),
        })

    # Curriculum order: stage, then level (stable, so the order inside a level is the spreadsheet order).
    bank.sort(key=lambda term: (term["stage"], LEVELS.index(term["level"])))

    stages = []
    for row in table(sheets["Curriculum"], "Stage #"):
        if row["Stage #"].isdigit():
            stages.append({"n": int(row["Stage #"]), "en": row["Stage"], "ar": row["المرحلة"]})
    used = {term["stage"] for term in bank}
    missing = used - {stage["n"] for stage in stages}
    if missing:
        fail(f"stages {sorted(missing)} are used by terms but missing from the Curriculum sheet")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({"stages": stages, "terms": bank}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    counts = {stage["n"]: sum(1 for term in bank if term["stage"] == stage["n"]) for stage in stages}
    print(f"OK: {len(bank)} terms, {len(stages)} stages {counts} -> {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size // 1024} KB)")


main()
