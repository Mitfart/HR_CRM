"""Unit tests for Google Sheets row parsers and normalizers."""
import pytest
from app.tasks_sheets import (
    _row_hash,
    _strip_emojis,
    _detect_legacy_mark,
    _detect_stage,
    _detect_priority,
    _parse_sources,
    _parse_salary,
    _normalize_phone,
    EMOJI_TO_STAGE,
    EMOJI_TO_PRIORITY,
)


# ── _row_hash ────────────────────────────────────────────────────────────────

def test_row_hash_stable():
    row = ["2024-01-01", "Аня", "Клиент", "тг/хх", "5/2", "няня", "80000", "Москва"]
    h1 = _row_hash(row)
    h2 = _row_hash(row)
    assert h1 == h2


def test_row_hash_changes_on_modification():
    row = ["2024-01-01", "Аня", "Клиент", "тг", "5/2", "няня", "80000", "Москва"]
    h1 = _row_hash(row)
    row[7] = "Питер"
    h2 = _row_hash(row)
    assert h1 != h2


def test_row_hash_handles_none():
    row = [None, "Аня", None]
    h = _row_hash(row)
    assert isinstance(h, str) and len(h) == 32


# ── _strip_emojis ─────────────────────────────────────────────────────────────

def test_strip_emojis_removes_checkmark():
    assert _strip_emojis("✅Иванова Мария") == "Иванова Мария"


def test_strip_emojis_removes_urgent():
    assert _strip_emojis("‼️Срочная вакансия") == "Срочная вакансия"


def test_strip_emojis_clean_string():
    assert _strip_emojis("Иванова Мария") == "Иванова Мария"


def test_strip_emojis_empty():
    assert _strip_emojis("") == ""


# ── _detect_legacy_mark & _detect_stage ──────────────────────────────────────

def test_detect_stage_won():
    assert _detect_stage("✅✔️Клиент") == "Закрыт успешно"


def test_detect_stage_urgent():
    assert _detect_stage("‼️Срочно") == "Поиск кандидатов"


def test_detect_stage_active():
    assert _detect_stage("✅В работе") == "Поиск кандидатов"


def test_detect_stage_plain():
    assert _detect_stage("Новый клиент") == "Новая"


def test_detect_priority_urgent():
    assert _detect_priority("‼️Срочно") == "urgent"


def test_detect_priority_normal():
    assert _detect_priority("Обычный клиент") == "normal"


# ── _parse_sources ────────────────────────────────────────────────────────────

def test_parse_sources_multiple():
    result = _parse_sources("тг/хх/пм")
    assert "Telegram" in result
    assert "HeadHunter" in result
    assert "Помогатор" in result


def test_parse_sources_single():
    assert _parse_sources("тг") == ["Telegram"]


def test_parse_sources_empty():
    assert _parse_sources("") == []


def test_parse_sources_none():
    assert _parse_sources(None) == []


def test_parse_sources_unknown():
    assert _parse_sources("xyz") == []


# ── _parse_salary ─────────────────────────────────────────────────────────────

def test_parse_salary_plain_number():
    from_val, to_val = _parse_salary("80000")
    assert from_val == 80000.0
    assert to_val is None


def test_parse_salary_spaced():
    from_val, _ = _parse_salary("80 000")
    assert from_val == 80000.0


def test_parse_salary_range():
    from_val, to_val = _parse_salary("80000-100000")
    assert from_val == 80000.0
    assert to_val == 100000.0


def test_parse_salary_shorthand():
    from_val, _ = _parse_salary("8т")
    assert from_val == 8000.0


def test_parse_salary_none():
    assert _parse_salary(None) == (None, None)


def test_parse_salary_empty():
    assert _parse_salary("") == (None, None)


# ── _normalize_phone ──────────────────────────────────────────────────────────

def test_normalize_phone_10_digits():
    assert _normalize_phone("9161234567") == "+79161234567"


def test_normalize_phone_11_digits_8():
    assert _normalize_phone("89161234567") == "+79161234567"


def test_normalize_phone_plus_7():
    assert _normalize_phone("+79161234567") == "+79161234567"


def test_normalize_phone_formatted():
    assert _normalize_phone("+7 (916) 123-45-67") == "+79161234567"


def test_normalize_phone_none():
    assert _normalize_phone(None) is None


def test_normalize_phone_empty():
    result = _normalize_phone("")
    assert result is None or result == "+"
