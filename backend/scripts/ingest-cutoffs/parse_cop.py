"""
Parse the official UGC "Minimum Z scores ... in respect of each district" (COP) PDF into JSON.

Layout facts (verified by inspection of the 2024/25 and 2025/26 PDFs):
  * Each page is a grid. Column headers are vertical text (two lines per column: course name,
    then "(University ...)"). Rows are districts, cells are a 4-decimal Z-score or "NQC".
  * Markers in the footer: "*" = selection 100% on an all-island merit basis,
    "#" = course with subject-oriented practical/aptitude test.
  * "NQC" = No Qualified Candidates (see footer text of the PDF; NOT "no cutoff exists").

The parser is strict: every district row must provide exactly one value per column on the
page, otherwise it aborts. Nothing is guessed.

Usage: python parse_cop.py <pdf> <data_year e.g. 2025/26> <out.json> <source_url>
"""
import json
import re
import sys
from collections import defaultdict

import pdfplumber

VALUE_RE = re.compile(r"^-?\d{1,2}\.\d{4}$")


def read_columns(page):
    rot = [c for c in page.chars if abs(c["matrix"][0]) < 0.1]
    lines = defaultdict(list)
    for c in rot:
        lines[round(c["x0"])].append(c)
    items = []
    for x in sorted(lines):
        cs = lines[x]
        text = "".join(c["text"] for c in sorted(cs, key=lambda c: -c["top"]))
        text = re.sub(r"\s+", " ", text).strip()
        xc = sum((c["x0"] + c["x1"]) / 2 for c in cs) / len(cs)
        items.append((xc, text))
    # Group consecutive header lines (gap <= 12pt) into one column. The LAST line is the
    # university; earlier lines are the (possibly wrapped) course name.
    groups = []
    for it in items:
        if groups and it[0] - groups[-1][-1][0] <= 12:
            groups[-1].append(it)
        else:
            groups.append([it])
    cols = []
    for g in groups:
        texts = [t for _, t in g]
        start = None
        for i in range(len(texts) - 1, 0, -1):
            joined = " ".join(texts[i:])
            if texts[i].startswith("(") and joined.endswith(")") and re.search(r"Univ|Campus|Institute", joined):
                start = i
                break
        if start is None:
            raise SystemExit(f"Cannot pair header lines on page {page.page_number}: {texts!r}")
        cols.append({
            "x": sum(x for x, _ in g) / len(g),
            "course": " ".join(texts[:start]),
            "university": " ".join(texts[start:]).strip("() "),
        })
    return cols


def read_rows(page, first_col_x, min_top):
    words = page.extract_words(use_text_flow=False, keep_blank_chars=False, extra_attrs=["upright"])
    words = [w for w in words if w["upright"] and w["top"] > min_top]
    rows_list = []
    for w in sorted(words, key=lambda w: w["top"]):
        if rows_list and abs(w["top"] - rows_list[-1][0]) <= 3:
            rows_list[-1][1].append(w)
        else:
            rows_list.append([w["top"], [w]])
    out = []
    for _, group in rows_list:
        ws = sorted(group, key=lambda w: w["x0"])
        label_words = [w for w in ws if w["x1"] < first_col_x - 8 and re.match(r"^[A-Z][A-Z\s]*$", w["text"])]
        vals = [w for w in ws if VALUE_RE.match(w["text"]) or w["text"] == "NQC"]
        if label_words and vals:
            out.append((" ".join(w["text"] for w in label_words), vals))
    return out


def main(pdf_path, data_year, out_path, source_url):
    pdf = pdfplumber.open(pdf_path)
    columns, districts, cells = [], [], {}
    footer = None
    for page in pdf.pages:
        cols = read_columns(page)
        if not cols:
            continue
        hb = max(c["bottom"] for c in page.chars if abs(c["matrix"][0]) < 0.1)
        rows = read_rows(page, min(c["x"] for c in cols) - 10, hb)
        if not rows:
            raise SystemExit(f"Page {page.page_number}: columns found but no data rows")
        base = len(columns)
        page_labels = [label for label, _ in rows]
        if len(set(page_labels)) != len(page_labels):
            raise SystemExit(f"Page {page.page_number}: duplicate district rows {page_labels}")
        if districts and page_labels != districts:
            raise SystemExit(f"Page {page.page_number}: district rows differ from page 1: {page_labels}")
        for idx, c in enumerate(cols):
            flags = []
            name = c["course"]
            columns.append({
                "key": f"p{page.page_number}c{idx}",
                "page": page.page_number,
                "rawCourse": name,
                "university": c["university"],
            })
        for label, vals in rows:
            if len(vals) != len(cols):
                raise SystemExit(f"Page {page.page_number} row {label}: {len(vals)} values vs {len(cols)} columns")
            if label not in districts:
                districts.append(label)
            for c, w in zip(cols, sorted(vals, key=lambda w: w["x0"])):
                # alignment check: value must sit under its own column
                wc = (w["x0"] + w["x1"]) / 2
                if abs(wc - c["x"]) > 20:
                    raise SystemExit(f"Misaligned cell page {page.page_number} {label} {c['course']}: {wc} vs {c['x']}")
                key = f"p{page.page_number}c{cols.index(c)}"
                cells.setdefault(key, {})[label] = "NQC" if w["text"] == "NQC" else float(w["text"])
        text = page.extract_text() or ""
        m = re.search(r"NQC - No Qualified Candidates.*?(?=UNIVERSITY GRANTS COMMISSION|$)", text, re.S)
        if m:
            footer = re.sub(r"\s+", " ", m.group(0)).strip()
    # marker flags from the raw course labels
    for c in columns:
        raw = c["rawCourse"]
        c["allIslandMerit"] = "*" in raw
        c["aptitudeTest"] = "#" in raw
        c["course"] = re.sub(r"\s*[*#]+\s*", " ", raw).strip()
    result = {
        "dataYear": data_year,
        "source": {
            "title": "UGC Minimum Z scores for selection to various Courses of Study in respect of each district",
            "url": source_url,
        },
        "nqcDefinition": footer,
        "districts": districts,
        "columns": columns,
        "cells": cells,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print("columns", len(columns), "districts", len(districts), "cells", sum(len(v) for v in cells.values()))


if __name__ == "__main__":
    main(*sys.argv[1:5])

