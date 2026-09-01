"""
Parser for SECTION 2 of the UGC Student Handbook: the course/programme
catalog (2.1) and detailed per-course entries (2.2.N.M).

Two passes, each targeted at its own real layout (not a shared generic
regex, per the two distinct text structures observed in english_2025.pdf):

1. The 2.1 catalog (pages ~27-37): a plain numbered list under six/seven/eight
   named stream-group headers "(N) STREAM NAME", each course a
   "N. Course Title" line followed by one-or-more indented university-name
   lines. This is the most COMPLETE source of (stream, course, university)
   triples — every course appears here, but with no duration/Z-score/
   prerequisite detail.

2. The 2.2.N.M detailed entries (pages ~38-116): one prose block per course
   offered by one specific university, in the form:
     "2.2.N.M Course of Study in <title> offered by <university>"
     "(Course Code - NNN)"
     "(Proposed Intake - NNN)"
     "Name of the degree programme is <full degree name>."
     <eligibility / subject prerequisite prose>
     <special admission rules prose, e.g. O/L credit requirements>
     "Duration of the degree programme is NN years." (or several other phrasings)
   N (1-8) maps to a stream via STREAM_GROUP_ORDER; N=8 is a cross-stream
   "eligible from multiple streams" group with no single stream, matching the
   handbook's own "(8) COURSES OF STUDY FOR WHICH STUDENTS FROM DIFFERENT
   SUBJECT STREAMS ARE ELIGIBLE" section. N=7 is "Information Communication
   Technology", a named group with no explicit "STREAM" suffix.

Entries from pass 2 enrich (merge into) matching pass-1 catalog entries by
(university, normalized course title); course titles with no pass-2 match
are still emitted, just without duration/prerequisites/uniCode — flagged in
warnings so an admin knows more detail may be available for those in the
source PDF that this parser didn't confidently link.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# Verified against english_2025.pdf's own Section 2.1 intro text, in order.
STREAM_GROUP_ORDER = {
    1: "Arts",
    2: "Commerce",
    3: "Biological Science",
    4: "Physical Science",
    5: "Engineering Technology",
    6: "Biosystems Technology",
    7: "Information Communication Technology",
    8: None,  # cross-stream eligibility group, no single stream
}

STREAM_GROUP_HEADER_RE = re.compile(r"^\((\d+)\)\s+(.+?)$", re.M)
CATALOG_COURSE_RE = re.compile(r"^(\d+)\.\s+(.+?)$", re.M)
INSTITUTION_KEYWORD_RE = re.compile(
    r"University|Campus|Institute|College|SLIATE|Academy", re.I
)

# This section uses two distinct header formats in the same PDF, verified
# against english_2025.pdf:
#   Format B (most streams, e.g. Commerce): "2.2.N.M <short title>" on one
#     line, immediately followed by "(Course Code - NNN)".
#   Format A (numbered sub-variants within a stream, seen under Arts for
#     courses with distinct entry requirements, e.g. Communication Studies,
#     Peace and Conflict Resolution): "N. Course of Study in <title> offered
#     by <university>", NOT prefixed with "2.2.N.M".
# Both are line-start-anchored (re.M) to avoid matching prose that merely
# references a section number, e.g. "...specified in Section 2.2.1.1 of this
# handbook" (mid-sentence, not at a line start).
STREAM_MARKER_RE = re.compile(r"^2\.2\.(\d+)\s+[A-Z]", re.M)
FORMAT_B_RE = re.compile(r"^2\.2\.(\d+)\.(\d+)\s+([^\n(]+)", re.M)
FORMAT_A_RE = re.compile(
    r"^(\d+)\.\s+Course of [Ss]tudy in\s+(.+?)\s+offered by\s+(?:the\s+)?(.+?)"
    r"(?=\n\(Course Code|\n\d+\.\s+Course[s]? of [Ss]tudy in|\Z)",
    re.M | re.S,
)
CODE_RE = re.compile(r"Course Codes?\s*[:\-][^)]*?(\d{3})")
INTAKE_RE = re.compile(r"Proposed Intake\s*-\s*(\d+)")
DEGREE_NAME_RE = re.compile(r"Name of the degree programme is\s+(.+?)\.\s*(?:\n|$)", re.S)

WORD_NUMS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6}
DURATION_NUM_RE = re.compile(r"[Dd]uration[^.\n]{0,60}?(\d{1,2})\s*(?:\([^)]*\))?\s*[Yy]ears?")
DURATION_WORD_RE = re.compile(
    r"[Dd]uration[^.\n]{0,60}?\b(one|two|three|four|five|six)\b\s*(?:\([^)]*\))?\s*[Yy]ears?"
)

ELIGIBILITY_START_RE = re.compile(r"In order to be eligible.*?(?=Duration|The medium of instruction|\Z)", re.S)
RULE_KEYWORDS = [
    "required to submit", "aptitude test", "practical test", "an interview",
    "medical fitness", "certified copy", "credit pass", "credit passes",
    "physically fit", "special provision",
]



@dataclass
class Section2CatalogEntry:
    stream_index: int
    stream: str | None
    course_title: str
    university: str
    source_page: int


@dataclass
class Section2DetailEntry:
    stream_index: int
    stream: str | None
    course_title: str
    university: str | None
    # True for Format A ("N. Course of Study in X offered by Y") entries,
    # which describe one specific university. False for Format B
    # ("2.2.N.M Title") entries, which describe subject requirements shared
    # by every university offering that course title per the 2.1 catalog.
    is_university_specific: bool
    degree_name: str | None
    uni_code: str | None
    duration_years: int | None
    subjects_raw: str | None
    rules_raw: list[str]
    source_page: int


@dataclass
class Section2Row:
    stream: str | None
    course_title: str
    university: str
    degree_name: str | None
    uni_code: str | None
    duration_years: int | None
    subjects_raw: str | None
    rules_raw: list[str]
    source_page: int
    has_detail: bool
    needs_review: bool = False


@dataclass
class Section2Result:
    rows: list[Section2Row] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


MIN_BODY_PAGE = 15  # see section9_parser.MIN_BODY_PAGE for why


def find_section2_bounds(pages_text: list[tuple[int, str]]) -> tuple[int, int] | None:
    """
    Return (start_page, end_page) 1-based, inclusive, or None if not found.

    Same table-of-contents caveat as Section 9's boundary finder: front-matter
    pages are excluded before applying the largest-gap heuristic, since that
    heuristic alone is biased toward the earliest (spurious, TOC) match.
    """
    starts = [page_no for page_no, text in pages_text if page_no > MIN_BODY_PAGE and re.search(r"SECTION\s+2\b", text)]
    ends = [page_no for page_no, text in pages_text if page_no > MIN_BODY_PAGE and re.search(r"SECTION\s+3\b", text)]
    if not starts:
        return None

    best: tuple[int, int] | None = None
    for start in starts:
        candidates = [e for e in ends if e > start]
        end = min(candidates) - 1 if candidates else pages_text[-1][0]
        if best is None or (end - start) > (best[1] - best[0]):
            best = (start, end)
    return best


def _normalize_title(title: str) -> str:
    return re.sub(r"\s+", " ", title).strip().lower()


def parse_catalog(pages_text: list[tuple[int, str]]) -> tuple[list[Section2CatalogEntry], list[str]]:
    entries: list[Section2CatalogEntry] = []
    warnings: list[str] = []
    current_stream_index: int | None = None
    current_stream_name: str | None = None
    current_course: str | None = None

    for page_no, text in pages_text:
        for raw_line in text.split("\n"):
            line = raw_line.strip()
            if not line or line.startswith("ACADEMIC YEAR"):
                continue

            # The 2.1 catalog ends and the detailed 2.2.N.M entries begin;
            # stop here so per-course prose isn't misread as university names.
            # Only honored once we're actually inside the catalog (i.e. past
            # at least one real "(N) STREAM NAME" header) — the same-looking
            # "2.2.1.1 Arts 31" text also appears, harmlessly listing page
            # numbers, in Section 2's own sub-table-of-contents *before* the
            # real catalog begins, and would otherwise stop parsing
            # immediately with zero rows collected.
            if current_stream_index is not None and (
                re.match(r"^2\.2\.\d+\.\d+\s", line) or line.startswith("2.2 ")
            ):
                return entries, warnings

            group_match = STREAM_GROUP_HEADER_RE.match(line)
            if group_match:
                idx = int(group_match.group(1))
                current_stream_index = idx
                current_stream_name = STREAM_GROUP_ORDER.get(idx)
                current_course = None
                continue

            course_match = CATALOG_COURSE_RE.match(line)
            if course_match and current_stream_index is not None:
                current_course = course_match.group(2).strip()
                continue

            if current_course and current_stream_index is not None:
                # An indented university-name line under the current course,
                # prefixed with a bullet glyph (U+F0A7, a Wingdings bullet
                # rendered as text) in the source PDF.
                university_name = re.sub(r"^[^A-Za-z0-9]+", "", line).strip()
                if not university_name:
                    continue

                if not INSTITUTION_KEYWORD_RE.search(university_name):
                    # Either a wrapped continuation of the previous entry's
                    # name (e.g. "Eastern University," / "Sri Lanka" split
                    # across two lines) or stray prose that leaked in (e.g.
                    # "Admission to courses of study mentioned in 1 to 10
                    # above will be made on an All Island Merit basis.",
                    # itself wrapped across two lines with neither half
                    # containing an institution keyword). Join it onto the
                    # previous entry rather than emit it as a bogus row —
                    # worst case this makes a prose line part of the
                    # previous (real) university's name, which an admin can
                    # trivially spot and fix; better than a phantom row.
                    if entries:
                        entries[-1].university = f"{entries[-1].university} {university_name}".strip()
                    continue

                entries.append(
                    Section2CatalogEntry(
                        stream_index=current_stream_index,
                        stream=current_stream_name,
                        course_title=current_course,
                        university=university_name,
                        source_page=page_no,
                    )
                )

    if not entries:
        warnings.append("Section 2.1 catalog parser found no (stream, course, university) rows.")
    return entries, warnings


def _extract_duration(block_text: str) -> int | None:
    match = DURATION_NUM_RE.search(block_text)
    if match:
        return int(match.group(1))
    match = DURATION_WORD_RE.search(block_text)
    if match:
        return WORD_NUMS.get(match.group(1).lower())
    return None


def _extract_rules(block_text: str) -> list[str]:
    sentences = re.split(r"(?<=[.])\s+", block_text)
    rules = []
    for sentence in sentences:
        lowered = sentence.lower()
        if any(kw in lowered for kw in RULE_KEYWORDS):
            rules.append(re.sub(r"\s+", " ", sentence).strip())
    return rules


def parse_details(
    pdf, pages_text: list[tuple[int, str]], start_page: int, end_page: int
) -> tuple[list[Section2DetailEntry], list[str]]:
    warnings: list[str] = []
    entries: list[Section2DetailEntry] = []

    # Concatenate with per-page offsets so a match position can be mapped
    # back to the physical page it started on.
    full_text = ""
    offsets: list[tuple[int, int]] = []  # (start_offset, page_no)
    for page_no, text in pages_text:
        offsets.append((len(full_text), page_no))
        full_text += text + "\n"

    def page_for_offset(offset: int) -> int:
        page = offsets[0][1]
        for start_offset, page_no in offsets:
            if start_offset <= offset:
                page = page_no
            else:
                break
        return page

    stream_markers = [(m.start(), int(m.group(1))) for m in STREAM_MARKER_RE.finditer(full_text)]

    def stream_index_for_offset(offset: int) -> int | None:
        current = None
        for marker_offset, idx in stream_markers:
            if marker_offset <= offset:
                current = idx
            else:
                break
        return current

    # Format B: "2.2.N.M <title>" — N/M give the stream/sub-index directly.
    format_b = [
        {
            "start": m.start(),
            "stream_index": int(m.group(1)),
            "course_title": re.sub(r"\s+", " ", m.group(3)).strip(),
            "university": None,  # not present in this header form; comes from prose or stays unresolved
        }
        for m in FORMAT_B_RE.finditer(full_text)
    ]

    # Format A: "N. Course of Study in <title> offered by <university>" —
    # no stream index in the header itself, so it's inferred from the
    # nearest preceding "2.2.N ..." stream-section marker.
    format_a = []
    for m in FORMAT_A_RE.finditer(full_text):
        idx = stream_index_for_offset(m.start())
        if idx is None:
            warnings.append(
                f"Skipped a 'Course of Study in {m.group(2)[:40]}...' entry: "
                "could not determine which stream section it belongs to."
            )
            continue
        format_a.append(
            {
                "start": m.start(),
                "stream_index": idx,
                "course_title": re.sub(r"\s+", " ", m.group(2)).strip(),
                "university": re.sub(r"\s+", " ", m.group(3)).strip().rstrip("."),
            }
        )

    headers = sorted(format_a + format_b, key=lambda h: h["start"])

    for i, header in enumerate(headers):
        stream_index = header["stream_index"]
        course_title = header["course_title"]
        university = header["university"]

        block_start = header["start"]
        block_end = headers[i + 1]["start"] if i + 1 < len(headers) else len(full_text)
        block_text = full_text[block_start:block_end]
        source_page = page_for_offset(block_start)

        if university is None and not CODE_RE.search(block_text[:200]):
            # Format B ("2.2.N.M Title") headers are always immediately
            # followed by "(Course Code - NNN)" in the real detailed
            # entries; the same-looking "2.2.N.M Title <page-number>" text
            # also appears, harmlessly, in Section 2's own sub-table-of-
            # contents (e.g. page 24) — treated as a false-positive match
            # and skipped rather than emitted as a bogus row.
            warnings.append(
                f"page {source_page}: skipped '{course_title}' — matched a "
                "2.2.N.M-style heading with no nearby Course Code (likely a "
                "table-of-contents listing, not a real entry)."
            )
            continue

        if university is not None and not CODE_RE.search(block_text):
            # Format A ("N. Course of Study in X offered by Y") also appears
            # as a plain summary/index list before some streams' real
            # detailed entries (e.g. Arts, page 41) — those summary items
            # are never followed by a Course Code anywhere in their block,
            # unlike the real entries reached later in the text.
            warnings.append(
                f"page {source_page}: skipped '{course_title}' ({university}) — "
                "matched a 'Course of Study in ... offered by ...' phrase with no "
                "Course Code anywhere in its block (likely a summary list entry, not a real entry)."
            )
            continue

        is_university_specific = university is not None
        if not is_university_specific:
            # Format B headers describe requirements shared by every
            # university offering this course title (per the 2.1 catalog),
            # not one specific university — resolved by course-title match
            # in parse_section2(), not left as a guessed/placeholder value.
            pass

        label = f"'{course_title}'" + (f" ({university})" if university else " (course-wide)")

        code_match = CODE_RE.search(block_text)
        uni_code = code_match.group(1) if code_match else None
        if not uni_code:
            warnings.append(f"page {source_page}: no Course Code found for {label}.")

        degree_match = DEGREE_NAME_RE.search(block_text)
        degree_name = re.sub(r"\s+", " ", degree_match.group(1)).strip() if degree_match else None

        duration = _extract_duration(block_text)
        if duration is None:
            warnings.append(f"page {source_page}: no duration found for {label}; left null, needs review.")

        eligibility_match = ELIGIBILITY_START_RE.search(block_text)
        subjects_raw = re.sub(r"\s+", " ", eligibility_match.group(0)).strip() if eligibility_match else None

        rules_raw = _extract_rules(block_text)

        entries.append(
            Section2DetailEntry(
                stream_index=stream_index,
                stream=STREAM_GROUP_ORDER.get(stream_index),
                course_title=course_title,
                university=university,
                is_university_specific=is_university_specific,
                degree_name=degree_name,
                uni_code=uni_code,
                duration_years=duration,
                subjects_raw=subjects_raw,
                rules_raw=rules_raw,
                source_page=source_page,
            )
        )

    if not entries:
        warnings.append(f"No 2.2.N.M detailed entries found in pages {start_page}-{end_page}.")
    return entries, warnings


def parse_section2(pdf, start_page: int, end_page: int) -> Section2Result:
    result = Section2Result()
    pages_text = [(p, pdf.pages[p - 1].extract_text() or "") for p in range(start_page, end_page + 1)]

    catalog_entries, catalog_warnings = parse_catalog(pages_text)
    detail_entries, detail_warnings = parse_details(pdf, pages_text, start_page, end_page)
    result.warnings.extend(catalog_warnings)
    result.warnings.extend(detail_warnings)

    # University-specific details (Format A) match by (university, course).
    # Course-wide details (Format B) match by course title alone — they
    # apply to every university offering that course per the 2.1 catalog.
    detail_by_uni_course: dict[tuple[str, str], Section2DetailEntry] = {}
    detail_by_course: dict[str, Section2DetailEntry] = {}
    for detail in detail_entries:
        course_key = _normalize_title(detail.course_title)
        if detail.is_university_specific:
            detail_by_uni_course[(_normalize_title(detail.university), course_key)] = detail
        else:
            detail_by_course[course_key] = detail

    matched_keys: set[tuple[str, str]] = set()
    matched_course_keys: set[str] = set()
    for catalog in catalog_entries:
        uni_key = _normalize_title(catalog.university)
        course_key = _normalize_title(catalog.course_title)
        detail = detail_by_uni_course.get((uni_key, course_key)) or detail_by_course.get(course_key)
        if detail:
            matched_keys.add((uni_key, course_key))
            if not detail.is_university_specific:
                matched_course_keys.add(course_key)
            result.rows.append(
                Section2Row(
                    stream=catalog.stream,
                    course_title=catalog.course_title,
                    university=catalog.university,
                    degree_name=detail.degree_name,
                    uni_code=detail.uni_code,
                    duration_years=detail.duration_years,
                    subjects_raw=detail.subjects_raw,
                    rules_raw=detail.rules_raw,
                    source_page=detail.source_page,
                    has_detail=True,
                    needs_review=detail.duration_years is None,
                )
            )
        else:
            result.rows.append(
                Section2Row(
                    stream=catalog.stream,
                    course_title=catalog.course_title,
                    university=catalog.university,
                    degree_name=None,
                    uni_code=None,
                    duration_years=None,
                    subjects_raw=None,
                    rules_raw=[],
                    source_page=catalog.source_page,
                    has_detail=False,
                    needs_review=True,
                )
            )

    unmatched_details = [d for k, d in detail_by_uni_course.items() if k not in matched_keys]
    unmatched_details += [d for k, d in detail_by_course.items() if k not in matched_course_keys]
    for detail in unmatched_details:
        result.warnings.append(
            f"page {detail.source_page}: detailed entry for '{detail.course_title}' "
            f"({detail.university or 'course-wide'}) had no matching 2.1 catalog row."
        )
        result.rows.append(
            Section2Row(
                stream=detail.stream,
                course_title=detail.course_title,
                university=detail.university or "Unknown",
                degree_name=detail.degree_name,
                uni_code=detail.uni_code,
                duration_years=detail.duration_years,
                subjects_raw=detail.subjects_raw,
                rules_raw=detail.rules_raw,
                source_page=detail.source_page,
                has_detail=True,
                needs_review=detail.duration_years is None or not detail.university,
            )
        )

    no_detail_count = sum(1 for r in result.rows if not r.has_detail)
    if no_detail_count:
        result.warnings.append(
            f"{no_detail_count} catalog rows have no matching detailed 2.2.N.M entry "
            "(no duration/prerequisites/Uni-Code) — cross-listed/shared courses "
            "typically described only under their primary stream's entry."
        )

    return result
