#!/usr/bin/env python3
"""
Extract a UGC Student Handbook PDF into a staging JSON file for admin review.

Usage:
  python scripts/ingest-handbook/extract.py --file handbook.pdf --year 2025_26 --language en
  python scripts/ingest-handbook/extract.py --url <pdf_url> --year 2025_26 --language en

Output: data/handbooks/staging/{year}_{lang}.json (staging only — never
written directly to live tables; an admin reviews and approves each row via
`pnpm handbook:stage` + the admin review API before anything becomes public).

This orchestrates two independent, section-specific parsers rather than one
generic regex over the whole PDF (see section2_parser.py and
section9_parser.py for why: the two sections have unrelated layouts, and
Section 9's table text is character-mirrored in the source PDF):

  - Section 2 (course/programme catalog + per-course entry detail): streams,
    courses, universities, degree names, duration, subject prerequisites,
    special admission rules, Uni-Code, source page.
  - Section 9 (previous-year district-wise cutoff marks): district-wise
    Z-score cutoffs per course/university, preserving NQC markers, tagged
    with the *previous* academic year (Section 9 explicitly covers the year
    before the handbook's own edition year) and source page.

Prints (and writes into the JSON) a validation summary: academic year,
courses found, universities found, Uni-Codes found, districts found, cutoff
rows, and warnings. Review the summary and the JSON diff before staging.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.request import urlretrieve

try:
    import pdfplumber
except ImportError:
    print("Install dependencies: pip install -r scripts/ingest-handbook/requirements.txt")
    sys.exit(1)

from section2_parser import find_section2_bounds, parse_section2
from section9_parser import find_section9_bounds, parse_section9

ROOT = Path(__file__).resolve().parents[2]
STAGING_DIR = ROOT / "data" / "handbooks" / "staging"

HANDBOOK_YEAR_RE = re.compile(r"ACADEMIC YEAR\s+(\d{4}/\d{4})", re.I)


def academic_year_label(year_arg: str) -> str:
    parts = year_arg.replace("-", "_").split("_")
    if len(parts) == 2:
        return f"{parts[0]}/{parts[1]}"
    return year_arg.replace("_", "/")


def detect_handbook_academic_year(pdf) -> str | None:
    for page in pdf.pages[:60]:
        text = page.extract_text() or ""
        match = HANDBOOK_YEAR_RE.search(text)
        if match:
            start, end = match.group(1).split("/")
            return f"{start}/{end[-2:]}"
    return None


def build_pages_text(pdf, start: int, end: int) -> list[tuple[int, str]]:
    return [(p, pdf.pages[p - 1].extract_text() or "") for p in range(start, end + 1)]


def build_canonical_course_index(course_titles: list[str]) -> dict[frozenset, str]:
    """
    Maps a normalized word-set of each Section 2 course/degree title to its
    canonical (correctly-ordered) spelling, used to fix Section 9 course
    labels whose line-wrapping left their words in the wrong order (see
    reconcile_course_label). Word-set matching is order-independent by
    construction, so it corrects wrapped word order without guessing at
    what the correct order should be — it only ever substitutes in text
    that Section 2 itself already extracted for that exact set of words.
    """
    index: dict[frozenset, str] = {}
    for title in course_titles:
        words = frozenset(w.upper() for w in re.findall(r"[A-Za-z]+", title))
        if words and words not in index:
            index[words] = title
    return index


def reconcile_course_label(label: str, canonical_index: dict[frozenset, str]) -> tuple[str, str]:
    """
    Returns (possibly-corrected label, verification status). Only ever
    substitutes a Section 2-derived canonical spelling when its word set
    exactly matches the Section 9 label's word set — never a fuzzy/partial
    match, so this can't silently rewrite a label into a different course.
    """
    words = frozenset(w.upper() for w in re.findall(r"[A-Za-z]+", label))
    canonical = canonical_index.get(words)
    if canonical:
        return canonical, "verified"
    return label, "needs_review"


def build_canonical_pair_index(pairs: list[tuple[str, str]]) -> dict[frozenset, tuple[str, str]]:
    """
    Maps the combined word-set of (university, course) to that canonical
    pair, from Section 2. Used to fix the transposed layout's column
    headers, whose (university, course) text can't be reliably split or
    reordered by any positional heuristic (verified against english_2022/23
    — course-qualifier parentheses like "(BIO.SC)" interleave with the
    university's own parens, defeating simple paren-position sorting).
    Matching the *combined* bag of words instead sidesteps needing to know
    the correct split point or word order at all.
    """
    index: dict[frozenset, tuple[str, str]] = {}
    for university, course in pairs:
        words = frozenset(w.upper() for w in re.findall(r"[A-Za-z]+", f"{university} {course}"))
        if words and words not in index:
            index[words] = (university, course)
    return index


def reconcile_transposed_pair(
    university: str, course: str, canonical_pair_index: dict[frozenset, tuple[str, str]]
) -> tuple[str, str, str]:
    """
    Returns (university, course, verification_status) — the canonical pair
    when the combined word-set matches exactly one Section 2 entry, else the
    original (garbled) text with status "needs_review". Never guesses a
    partial or fuzzy match.
    """
    words = frozenset(w.upper() for w in re.findall(r"[A-Za-z]+", f"{university} {course}"))
    canonical = canonical_pair_index.get(words)
    if canonical:
        return canonical[0], canonical[1], "verified"
    return university, course, "needs_review"


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract a UGC handbook PDF to a staging JSON file")
    parser.add_argument("--url", help="PDF download URL")
    parser.add_argument("--file", help="Local PDF path")
    parser.add_argument("--year", required=True, help="Academic year slug e.g. 2025_26 (the handbook's own edition year)")
    parser.add_argument("--language", required=True, choices=["en", "si", "ta"], help="Language of the source PDF")
    parser.add_argument("--source-url", default=None)
    args = parser.parse_args()

    STAGING_DIR.mkdir(parents=True, exist_ok=True)

    if args.file:
        pdf_path = Path(args.file)
    elif args.url:
        pdf_path = STAGING_DIR / f"_download_{args.year}_{args.language}.pdf"
        print(f"Downloading {args.url} ...")
        urlretrieve(args.url, pdf_path)
    else:
        parser.error("Provide --url or --file")

    fallback_academic_year = academic_year_label(args.year)
    warnings: list[str] = []

    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        detected_year = detect_handbook_academic_year(pdf)
        academic_year = detected_year or fallback_academic_year
        if detected_year and detected_year != fallback_academic_year:
            warnings.append(
                f"Handbook text says academic year {detected_year}, but --year arg implies "
                f"{fallback_academic_year}. Using the detected value {detected_year}."
            )
        elif not detected_year:
            warnings.append(f"Could not detect academic year from handbook text; using --year arg: {fallback_academic_year}.")

        all_pages_text = build_pages_text(pdf, 1, total_pages)

        # --- Section 2: course/programme catalog ---------------------------
        section2_bounds = find_section2_bounds(all_pages_text)
        programme_rows: list[dict] = []
        section2_summary = {"coursesFound": 0, "universitiesFound": 0, "uniCodesFound": 0, "needsReview": 0}
        section2_course_titles: list[str] = []
        section2_pairs: list[tuple[str, str]] = []
        if not section2_bounds:
            warnings.append("Could not locate SECTION 2 in this PDF — no course/programme data extracted.")
        else:
            s2_start, s2_end = section2_bounds
            section2 = parse_section2(pdf, s2_start, s2_end)
            warnings.extend(section2.warnings)
            for row in section2.rows:
                section2_course_titles.append(row.course_title)
                if row.degree_name:
                    section2_course_titles.append(row.degree_name)
                section2_pairs.append((row.university, row.course_title))
                programme_rows.append(
                    {
                        "academicYear": academic_year,
                        "cutoffYear": None,
                        "university": row.university,
                        "degreeName": row.degree_name or row.course_title,
                        "faculty": None,
                        "stream": row.stream,
                        "district": None,
                        "minimumZScore": None,
                        "zscoreMarker": None,
                        "durationYears": row.duration_years,
                        "degreeType": None,
                        "description": None,
                        "subjectsRaw": row.subjects_raw,
                        "rulesRaw": row.rules_raw or None,
                        "sourcePage": row.source_page,
                        "uniCode": row.uni_code,
                        "sourceSection": "2",
                        "verificationStatus": "needs_review" if row.needs_review else "extracted",
                    }
                )
            section2_summary["coursesFound"] = len(set(r.course_title.lower() for r in section2.rows))
            section2_summary["universitiesFound"] = len(set(r.university.lower() for r in section2.rows))
            section2_summary["uniCodesFound"] = len(set(r.uni_code for r in section2.rows if r.uni_code))
            section2_summary["needsReview"] = sum(1 for r in section2.rows if r.needs_review)

        # --- Section 9: previous-year district cutoff marks ----------------
        canonical_course_index = build_canonical_course_index(section2_course_titles)
        canonical_pair_index = build_canonical_pair_index(section2_pairs)
        section9_bounds = find_section9_bounds(all_pages_text)
        section9_summary = {
            "districtsFound": [], "cutoffRowsFound": 0, "universitiesFound": 0,
            "coursesFound": 0, "needsReview": 0, "orientationsSeen": [],
        }
        previous_academic_year = None
        if not section9_bounds:
            warnings.append("Could not locate SECTION 9 in this PDF — no cutoff data extracted.")
        else:
            s9_start, s9_end = section9_bounds
            section9 = parse_section9(pdf, s9_start, s9_end)
            warnings.extend(section9.warnings)
            previous_academic_year = section9.previous_academic_year
            needs_review_count = 0
            for row in section9.rows:
                if row.from_transposed:
                    # Column-header text can't be reliably split/ordered
                    # positionally (see build_canonical_pair_index) — match
                    # the whole garbled label against Section 2's known
                    # (university, course) pairs by word-set instead.
                    university, label, verification_status = reconcile_transposed_pair(
                        row.university, row.course_label, canonical_pair_index
                    )
                else:
                    university = row.university
                    label, label_status = reconcile_course_label(row.course_label, canonical_course_index)
                    verification_status = "needs_review" if (row.label_needs_review or label_status == "needs_review") else "extracted"
                if verification_status == "needs_review":
                    needs_review_count += 1
                programme_rows.append(
                    {
                        "academicYear": section9.previous_academic_year or academic_year,
                        "cutoffYear": section9.previous_academic_year or academic_year,
                        "university": university,
                        "degreeName": label,
                        "faculty": None,
                        "stream": None,
                        "district": row.district,
                        "minimumZScore": row.minimum_zscore,
                        "zscoreMarker": row.zscore_marker,
                        "durationYears": None,
                        "degreeType": None,
                        "description": None,
                        "subjectsRaw": None,
                        "rulesRaw": None,
                        "sourcePage": row.source_page,
                        "uniCode": None,
                        "sourceSection": "9",
                        "verificationStatus": verification_status,
                    }
                )
            section9_summary["districtsFound"] = section9.districts_found
            section9_summary["cutoffRowsFound"] = len(section9.rows)
            section9_summary["universitiesFound"] = len(set(r.university.lower() for r in section9.rows))
            section9_summary["coursesFound"] = len(set(r.course_label.lower() for r in section9.rows))
            section9_summary["needsReview"] = needs_review_count
            section9_summary["orientationsSeen"] = sorted(section9.orientations_seen)

    validation_summary = {
        "academicYear": academic_year,
        "previousYearForCutoffs": previous_academic_year,
        "totalPages": total_pages,
        "section2": section2_summary,
        "section9": section9_summary,
        "warnings": warnings,
    }

    output = {
        "academicYear": academic_year,
        "language": args.language,
        "sourceFileName": pdf_path.name,
        "sourceUrl": args.source_url or args.url,
        "totalPages": total_pages,
        "programmes": programme_rows,
        "validationSummary": validation_summary,
    }

    out_path = STAGING_DIR / f"{args.year.replace('-', '_')}_{args.language}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Wrote {len(programme_rows)} rows to {out_path}")
    print("\n=== Validation summary ===")
    print(json.dumps(validation_summary, indent=2, ensure_ascii=False))
    print(
        "\nThis is staging data, not live. Review it, then run:",
        f"pnpm handbook:stage --year {args.year} --lang {args.language}",
    )


if __name__ == "__main__":
    main()
