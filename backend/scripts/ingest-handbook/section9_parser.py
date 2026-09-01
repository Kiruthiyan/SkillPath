"""
Parser for SECTION 9 of the UGC Student Handbook: previous-year district-wise
'Cut-off' Z-score marks.

This section is NOT extractable with a generic table regex — verified
against two structurally different real layouts:

  MODERN layout (english_2024.pdf, english_2025.pdf): one row per
  (university, course), one column per district. Every cell (labels *and*
  Z-score values) is character-mirrored per physical line in the PDF's
  content stream, e.g. "3676.1" is really "1.6763" and "CQN" is really
  "NQC" (see `unmirror_line`).

  OLD/TRANSPOSED layout (english_2022.pdf / english_2023.pdf, which cover
  academic year 2022/23): one row per DISTRICT, one column per
  (university, course) — the transpose of the modern layout. Here only the
  column-header row's (university, course) labels are mirrored; the
  district-name row labels and the Z-score data cells are plain, readable
  text.

Orientation is auto-detected per table from a concrete, verifiable signal
(does any row's first cell literally equal a known Sri Lankan district
name, unmirrored?) — never assumed from the handbook year, since a mistaken
assumption there would silently mis-map every score in that layout.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# Z-scores are 4-decimal-place in the handbooks seen so far (e.g. "1.6763"),
# not the 3-decimal precision used elsewhere in this codebase's existing
# (hand-authored) seed data — matched permissively (3 or 4 digits).
ZSCORE_TOKEN_RE = re.compile(r"^-?\d\.\d{3,4}$")
NQC_LABEL = "NQC"

# Verified column order for the modern layout in english_2025.pdf and
# english_2024.pdf; used as a fallback only when the district-order header
# can't be located in the running text, and cross-checked against it
# whenever it can (see parse_section9's header_tokens_seen check) — never
# silently trusted without that cross-check.
DEFAULT_DISTRICT_ORDER = [
    "Colombo", "Gampaha", "Kalutara", "Matale", "Kandy", "Nuwara Eliya",
    "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar",
    "Mullaitivu", "Vavuniya", "Trincomalee", "Batticaloa", "Ampara",
    "Puttalam", "Kurunegala", "Anuradhapura", "Polonnaruwa", "Badulla",
    "Monaragala", "Kegalle", "Ratnapura",
]
KNOWN_DISTRICTS_UPPER = {d.upper() for d in DEFAULT_DISTRICT_ORDER}

MIN_NON_EMPTY_CELLS_FOR_DATA_ROW = 20

# Front-matter (title page, table of contents) ends and SECTION 1's real
# content begins by page 14-15 across the handbooks seen so far;
# section-boundary searches skip pages at or before this to avoid matching
# table-of-contents mentions of "SECTION 9" / "SECTION 10".
MIN_BODY_PAGE = 15


def unmirror_line(text: str | None) -> str | None:
    """Reverse each physical line of `text` independently (see module docstring)."""
    if text is None:
        return None
    return "\n".join(line[::-1] for line in text.split("\n"))


@dataclass
class Section9Row:
    university: str
    course_label: str
    district: str
    minimum_zscore: float | None
    zscore_marker: str | None
    source_page: int
    label_needs_review: bool = False
    # True for rows from a transposed-layout table, whose column-header
    # (university, course) label text is reliably readable only as an
    # unordered bag of words (see split_university_and_course) — signals
    # to the caller that these need canonical word-set reconciliation
    # against Section 2 rather than being trusted as correctly split/ordered.
    from_transposed: bool = False


@dataclass
class Section9Result:
    rows: list[Section9Row] = field(default_factory=list)
    previous_academic_year: str | None = None
    districts_found: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    orientations_seen: set[str] = field(default_factory=set)


def find_section9_bounds(pages_text: list[tuple[int, str]]) -> tuple[int, int] | None:
    """
    Return (start_page, end_page) 1-based, inclusive, or None if not found.

    "SECTION 9" and "SECTION 10" also appear as one-line entries in the
    handbook's own table of contents, so the first match isn't reliable. A
    naive "largest gap between any start and any later end" heuristic is
    *also* wrong: it's biased toward the earliest possible start (a TOC
    page), since that maximizes the gap to the real end page. Front-matter
    pages are excluded outright via MIN_BODY_PAGE first, then the
    largest-gap heuristic is applied to what remains.
    """
    starts = [page_no for page_no, text in pages_text if page_no > MIN_BODY_PAGE and re.search(r"SECTION\s+9\b", text)]
    ends = [page_no for page_no, text in pages_text if page_no > MIN_BODY_PAGE and re.search(r"SECTION\s+10\b", text)]
    if not starts:
        return None

    best: tuple[int, int] | None = None
    for start in starts:
        candidates = [e for e in ends if e > start]
        end = min(candidates) - 1 if candidates else pages_text[-1][0]
        if best is None or (end - start) > (best[1] - best[0]):
            best = (start, end)
    return best


def detect_previous_academic_year(section9_intro_text: str) -> str | None:
    """
    Section 9's cutoffs are explicitly the *previous* academic year's, stated
    in its introductory paragraph, e.g. "...previous academic year (i.e.
    academic year 2024/2025)" while the handbook itself is header/footer-
    stamped "ACADEMIC YEAR 2025/2026" throughout. Matching must be
    case-SENSITIVE on lowercase "academic year" — a case-insensitive match
    here previously matched the handbook's own all-caps
    "ACADEMIC YEAR 2022/2023" footer instead of the real (lowercase)
    previous-year mention, silently reporting the wrong year (verified
    against english_2022.pdf, where the two differ: footer says 2022/2023,
    the real previous-year text says 2021/2022).
    """
    match = re.search(r"academic year\s+(\d{4}/\d{4})", section9_intro_text)
    if not match:
        return None
    start, end = match.group(1).split("/")
    return f"{start}/{end[-2:]}"


def parse_district_header(text: str) -> list[str] | None:
    """
    Locate the district-order header line within already-unmirrored text,
    e.g. "DISTRICT ... COURSE OF STUDY DISTRICT COLOMBO GAMPAHA KALUTARA ...".
    Returns the parsed district name list, or None if not found.
    """
    match = re.search(
        r"COURSE OF STUDY DISTRICT\s+((?:[A-Z][A-Z ]*[A-Z]\s*){10,30})", text
    )
    if not match:
        return None
    tokens = match.group(1).split()
    return tokens


def _extract_university_and_course(label_text: str) -> tuple[str | None, str | None]:
    """Strict, single-match extraction for the modern layout's cleanly
    single-line-bounded "(University) COURSE" cells — see its call site
    for why this is preferred there over the more permissive
    split_university_and_course used for the transposed layout."""
    match = re.search(r"\(([^)]+)\)", label_text)
    if not match:
        return None, None
    university = match.group(1).strip()
    course = (label_text[: match.start()] + label_text[match.end():]).strip()
    course = re.sub(r"\s+", " ", course).strip()
    return university or None, course or None


def _is_all_caps_word(fragment: str) -> bool:
    letters = [c for c in fragment if c.isalpha()]
    return bool(letters) and all(c.isupper() for c in letters)


def split_university_and_course(label_lines: list[str]) -> tuple[str | None, str | None, bool]:
    """
    Split a multi-line "(University Name) COURSE LABEL" cell — already
    unmirrored per-line — into (university, course, needs_review).

    Case is used as the discriminator (course labels are ALL CAPS,
    university names are Title Case) rather than assuming a fixed line
    order, because the two verified layouts wrap this cell differently:
    the modern layout keeps university-then-course line order; the
    transposed layout's column headers interleave them across more lines
    in an order that doesn't reduce to a simple "first N lines" rule.
    University-fragment order is reconstructed from paren position (the
    fragment containing "(" goes first, the one containing ")" goes last),
    which is layout-agnostic. needs_review is True whenever the split is
    ambiguous (e.g. no clear paren pair) rather than silently guessing.
    """
    uni_fragments: list[tuple[int, str]] = []
    course_fragments: list[str] = []

    for idx, raw in enumerate(label_lines):
        fragment = raw.strip()
        if not fragment:
            continue
        if _is_all_caps_word(fragment):
            course_fragments.append(fragment)
        else:
            uni_fragments.append((idx, fragment))

    if not uni_fragments or not course_fragments:
        return None, None, True

    def sort_key(item: tuple[int, str]) -> tuple[int, int]:
        _, text = item
        if "(" in text:
            return (0, item[0])
        if ")" in text:
            return (2, item[0])
        return (1, item[0])

    ordered_uni = [text for _, text in sorted(uni_fragments, key=sort_key)]
    university = re.sub(r"\s+", " ", " ".join(ordered_uni)).strip()
    course = re.sub(r"\s+", " ", " ".join(course_fragments)).strip()

    needs_review = not (university.startswith("(") and university.endswith(")"))
    university = university.strip("()")
    return university or None, course or None, needs_review


def _detect_orientation(table: list[list[str | None]]) -> str | None:
    """
    Returns "modern", "transposed", or None if the table's orientation
    can't be confidently determined (in which case it's skipped entirely
    rather than guessed — see module docstring).
    """
    for row in table:
        first = (row[0] or "").strip().upper()
        if first in KNOWN_DISTRICTS_UPPER:
            return "transposed"

    for row in table:
        for cell in (row[:3] if len(row) >= 3 else row):
            if cell and ("(" in cell or ")" in cell):
                return "modern"

    return None


def _parse_modern_table(
    table: list[list[str | None]],
    page_no: int,
    order: list[str],
    result: Section9Result,
) -> None:
    for row in table:
        non_empty = [c for c in row if c not in (None, "")]
        if len(non_empty) < MIN_NON_EMPTY_CELLS_FOR_DATA_ROW:
            continue

        unmirrored = [unmirror_line(c) if c not in (None, "") else None for c in row]

        label_parts: list[str] = []
        score_tokens: list[str] = []
        for cell in unmirrored:
            if cell is None:
                continue
            stripped = cell.strip()
            if not stripped:
                continue
            if ZSCORE_TOKEN_RE.match(stripped) or stripped == NQC_LABEL:
                score_tokens.append(stripped)
            else:
                label_parts.append(stripped)

        if len(label_parts) > 2:
            continue

        # The first row of each page's table sometimes has a long
        # instructional text block glued into the same cell as (or an
        # extra cell before) the real label, an artifact of the page
        # layout overlapping the table's top edge.
        if len(label_parts) == 2 and len(label_parts[0]) > 80:
            label_parts = label_parts[1:]

        # A single-line "(University) COURSE" pair, cleanly bounded by the
        # first matching parens — unlike the transposed layout's column
        # headers, this format doesn't need the more permissive multi-line
        # case-based split, which (tried here first) proved too eager to
        # absorb stray footnote text that sometimes lands in the same cell.
        university, course = _extract_university_and_course(" ".join(label_parts))
        needs_review = False
        if not university or not course:
            result.warnings.append(
                f"page {page_no}: could not parse university/course from row label {label_parts!r}"
            )
            continue

        if len(score_tokens) != len(order):
            result.warnings.append(
                f"page {page_no}: expected {len(order)} district scores for "
                f"'{course}' ({university}), found {len(score_tokens)} — row skipped."
            )
            continue

        for district, token in zip(order, score_tokens):
            if token == NQC_LABEL:
                result.rows.append(Section9Row(university, course, district, None, NQC_LABEL, page_no, needs_review))
            else:
                result.rows.append(Section9Row(university, course, district, float(token), None, page_no, needs_review))


def _parse_transposed_table(
    table: list[list[str | None]],
    page_no: int,
    result: Section9Result,
) -> None:
    # The header row is the one whose non-first cells predominantly contain
    # raw "(" or ")" characters (mirrored university/course labels) — a
    # concrete signal, not a fixed row-index assumption.
    header_row = None
    for row in table:
        cells = row[1:] if len(row) > 1 else []
        non_empty = [c for c in cells if c]
        if not non_empty:
            continue
        paren_count = sum(1 for c in non_empty if "(" in c or ")" in c)
        if paren_count >= max(1, len(non_empty) // 2):
            header_row = row
            break

    if header_row is None:
        result.warnings.append(f"page {page_no}: transposed table has no identifiable column-header row — skipped.")
        return

    column_labels: dict[int, tuple[str, str, bool]] = {}
    for col_idx, cell in enumerate(header_row):
        if col_idx == 0 or not cell:
            continue
        unmirrored = unmirror_line(cell)
        lines = unmirrored.split("\n") if unmirrored else []
        university, course, needs_review = split_university_and_course(lines)
        if university and course:
            column_labels[col_idx] = (university, course, needs_review)
        else:
            result.warnings.append(f"page {page_no}: could not parse column header at index {col_idx}: {cell!r}")

    if not column_labels:
        result.warnings.append(f"page {page_no}: transposed table header row yielded no usable columns — skipped.")
        return

    for row in table:
        if row is header_row:
            continue
        district_raw = (row[0] or "").strip()
        if district_raw.upper() not in KNOWN_DISTRICTS_UPPER:
            continue  # not a data row (junk / instructional row)

        district = next(d for d in DEFAULT_DISTRICT_ORDER if d.upper() == district_raw.upper())

        for col_idx, (university, course, needs_review) in column_labels.items():
            if col_idx >= len(row):
                continue
            token = (row[col_idx] or "").strip()
            if not token:
                continue
            if token == NQC_LABEL:
                result.rows.append(
                    Section9Row(university, course, district, None, NQC_LABEL, page_no, needs_review, from_transposed=True)
                )
            elif ZSCORE_TOKEN_RE.match(token):
                result.rows.append(
                    Section9Row(university, course, district, float(token), None, page_no, needs_review, from_transposed=True)
                )
            else:
                result.warnings.append(
                    f"page {page_no}: unrecognized value {token!r} for '{course}' ({university}), {district} — skipped."
                )


def parse_section9(
    pdf, start_page: int, end_page: int, district_order: list[str] | None = None
) -> Section9Result:
    result = Section9Result()
    order = district_order or DEFAULT_DISTRICT_ORDER

    # The "previous academic year" sentence isn't always on Section 9's
    # first page — in english_2022.pdf it's on the second — so scan a
    # small window rather than assuming a fixed page.
    intro_text = "\n".join(
        pdf.pages[p - 1].extract_text() or "" for p in range(start_page, min(start_page + 3, end_page + 1))
    )
    result.previous_academic_year = detect_previous_academic_year(intro_text)
    if not result.previous_academic_year:
        result.warnings.append(
            f"Could not detect previous-year academic year from Section 9 intro (page {start_page})."
        )

    header_tokens_seen: list[str] | None = None
    for page_no in range(start_page, end_page + 1):
        page = pdf.pages[page_no - 1]
        page_text = page.extract_text() or ""
        tokens = parse_district_header(page_text)
        if tokens and header_tokens_seen is None:
            header_tokens_seen = tokens

        tables = page.extract_tables() or []
        for table in tables:
            orientation = _detect_orientation(table)
            if orientation is None:
                continue
            result.orientations_seen.add(orientation)
            if orientation == "modern":
                _parse_modern_table(table, page_no, order, result)
            else:
                _parse_transposed_table(table, page_no, result)

    if header_tokens_seen:
        joined_default = "".join(order).upper().replace(" ", "")
        joined_seen = "".join(header_tokens_seen).upper()
        if joined_default not in joined_seen and joined_seen not in joined_default:
            result.warnings.append(
                "District header order in the PDF text does not clearly match the "
                "expected default order — verify DEFAULT_DISTRICT_ORDER against this handbook."
            )

    result.districts_found = sorted(set(r.district for r in result.rows))
    return result
