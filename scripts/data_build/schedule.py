"""Read NTA schedule spreadsheets (archived under references/raw/nta-web)."""

from __future__ import annotations

import datetime as dt
import re
from dataclasses import dataclass
from pathlib import Path

import openpyxl

from .geo import RAW


@dataclass(frozen=True)
class Row:
    """One schedule row with its spreadsheet location (for citations)."""

    sheet: str
    row: int
    values: dict[str, object]

    def get(self, *keys: str) -> object:
        """First non-empty value among header names that start with one of `keys`."""
        for key in keys:
            for header, value in self.values.items():
                if header.strip().startswith(key) and value not in (None, ""):
                    return value
        return None


def read_rows(relative: str, header_row: int, sheet_index: int = 0) -> list[Row]:
    """All non-empty rows of a sheet, keyed by the header row's (stripped) titles."""
    wb = openpyxl.load_workbook(Path(RAW) / relative, data_only=True)
    ws = wb.worksheets[sheet_index]
    headers = [
        str(c.value).strip() if c.value is not None else f"col{i}" for i, c in enumerate(ws[header_row])
    ]
    rows = []
    for r in range(header_row + 1, ws.max_row + 1):
        values = {headers[i]: ws.cell(r, i + 1).value for i in range(len(headers))}
        if any(v not in (None, "") for v in values.values()):
            rows.append(Row(ws.title, r, values))
    return rows


_MONTH_YEAR = re.compile(r"^(\d{1,2})/(\d{4})$")
_RANGE = re.compile(r"^(\d{2})-(\d{4})\s*-\s*(\d{2})-(\d{4})$")


def to_datespec(value: object) -> str | None:
    """Convert a cell to a DateSpec (YYYY-MM-DD / YYYY-MM).

    Ranges like 'MM-YYYY - MM-YYYY' give the later month.
    """
    if isinstance(value, dt.datetime):
        if value.year > 2100:
            return None
        return value.strftime("%Y-%m-%d")
    if isinstance(value, str):
        text = value.strip()
        if m := _MONTH_YEAR.match(text):
            return f"{m[2]}-{int(m[1]):02d}"
        if m := _RANGE.match(text):
            return f"{m[4]}-{m[3]}"
    return None


def earliest_datespec(value: object) -> str | None:
    """Like to_datespec, but for ranges returns the earlier month."""
    if isinstance(value, str) and (m := _RANGE.match(value.strip())):
        return f"{m[2]}-{m[1]}"
    return to_datespec(value)
