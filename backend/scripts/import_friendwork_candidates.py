#!/usr/bin/env python3
"""
Import FriendWork scraped candidates into CRM database.

Input:
  out/friendwork/candidates.jsonl (from scripts/friendwork_scraper.py)

Upsert strategy:
  1) by phone (contacts.phone)
  2) by email (contacts.email)
  3) fallback by full_name (case-insensitive)
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, or_, select
from sqlalchemy.orm import Session

from app.models.candidate import Candidate


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if not digits:
        return ""
    if len(digits) == 10:
        digits = "7" + digits
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    return "+" + digits


def choose_primary(values: list[str]) -> str:
    return values[0].strip() if values else ""


def derive_name(rec: dict[str, Any]) -> str:
    explicit = (rec.get("name") or "").strip()
    if explicit and explicit.lower() not in {"импорт кандидата"}:
        return explicit
    title = (rec.get("page_title") or "").strip()
    if title:
        # e.g. "Иванова Мария — FriendWork"
        left = re.split(r"\s+[—-]\s+FriendWork", title, maxsplit=1)[0].strip()
        left = re.sub(r"\s*\(\s*Нурия\s*\)\s*$", "", left, flags=re.IGNORECASE).strip()
        if left and left.lower() not in {"кандидаты", "создание кандидата", "friendwork recruiter"}:
            return left
    return ""


def make_contacts(rec: dict[str, Any]) -> dict[str, str]:
    contacts: dict[str, str] = {}
    links = rec.get("links", []) or []
    tel_from_links: list[str] = []
    mail_from_links: list[str] = []
    for item in links:
        href = str((item or {}).get("href", ""))
        if href.startswith("tel:"):
            tel_from_links.append(href.replace("tel:", "", 1))
        if href.startswith("mailto:"):
            mail_from_links.append(href.replace("mailto:", "", 1))

    raw_phones = rec.get("phones", []) or []
    normalized_phones = [normalize_phone(p) for p in [*tel_from_links, *raw_phones]]
    normalized_phones = [p for p in normalized_phones if len(p) == 12 and p.startswith("+7")]
    phone = choose_primary(normalized_phones)

    raw_emails = [*mail_from_links, *(rec.get("emails", []) or [])]
    parsed_emails: list[str] = []
    for item in raw_emails:
        parsed_emails.extend(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", item or ""))
    email = choose_primary(parsed_emails)

    tg = choose_primary(rec.get("telegrams", []))
    if phone:
        contacts["phone"] = phone
    if email:
        contacts["email"] = email
    if tg:
        contacts["telegram"] = tg
    return contacts


def compose_notes(rec: dict[str, Any]) -> str:
    parts: list[str] = []
    if rec.get("url"):
        parts.append(f"FriendWork URL: {rec['url']}")
    if rec.get("snapshot_png"):
        parts.append(f"Profile screenshot: {rec['snapshot_png']}")
    image_files = rec.get("profile_images") or []
    if image_files:
        parts.append("Profile images:")
        for p in image_files[:10]:
            parts.append(f"- {p}")
    if rec.get("page_title"):
        parts.append(f"Page title: {rec['page_title']}")
    labels = rec.get("labels") or {}
    if isinstance(labels, dict) and labels:
        parts.append("Fields:")
        for k, v in labels.items():
            parts.append(f"- {k}: {v}")
    raw_text = (rec.get("raw_text") or "").strip()
    if raw_text:
        parts.append("")
        parts.append("Raw text (truncated):")
        parts.append(raw_text[:4000])
    return "\n".join(parts).strip()


def find_existing(session: Session, full_name: str, contacts: dict[str, str]) -> Candidate | None:
    filters = []
    phone = contacts.get("phone")
    email = contacts.get("email")
    if phone:
        filters.append(Candidate.contacts["phone"].astext == phone)
    if email:
        filters.append(Candidate.contacts["email"].astext == email)
    if filters:
        existing = session.execute(select(Candidate).where(or_(*filters))).scalar_one_or_none()
        if existing:
            return existing
    if full_name:
        return session.execute(
            select(Candidate).where(Candidate.full_name.ilike(full_name))
        ).scalar_one_or_none()
    return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        default="out/friendwork/candidates.jsonl",
        help="Path to candidates.jsonl produced by scraper",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        raise FileNotFoundError(f"Input not found: {input_path}")

    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")
    sync_url = database_url.replace("+asyncpg", "")
    engine = create_engine(sync_url, pool_pre_ping=True)

    created = 0
    updated = 0
    skipped = 0

    with Session(engine) as session:
        with input_path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                rec = json.loads(line)
                if rec.get("error"):
                    skipped += 1
                    continue
                url = (rec.get("url") or "").strip()
                if "/Candidate/Profile/" not in url:
                    skipped += 1
                    continue

                full_name = derive_name(rec) or "Кандидат FriendWork"
                contacts = make_contacts(rec)
                tags = ["friendwork", "imported"]
                notes = compose_notes(rec)

                existing = find_existing(session, full_name, contacts)
                if existing:
                    existing.full_name = full_name
                    existing.contacts = {**(existing.contacts or {}), **contacts}
                    existing.tags = list({*(existing.tags or []), *tags})
                    existing.notes = notes
                    updated += 1
                else:
                    session.add(
                        Candidate(
                            full_name=full_name,
                            contacts=contacts or None,
                            tags=tags,
                            notes=notes,
                        )
                    )
                    created += 1

        session.commit()

    print(f"Done. created={created}, updated={updated}, skipped={skipped}")


if __name__ == "__main__":
    main()
