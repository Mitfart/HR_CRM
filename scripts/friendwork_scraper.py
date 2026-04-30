#!/usr/bin/env python3
"""
FriendWork candidate scraper (interactive, browser-driven).

What it does:
1) Opens a real Chromium browser (Playwright) with persistent profile.
2) Lets you log in manually once (or reuses existing session).
3) Reads candidate links from the list page with infinite-scroll support.
4) Opens each candidate page and extracts:
   - visible text
   - email/phone/telegram links
   - label/value pairs (heuristic)
5) Saves everything to disk:
   - out/friendwork/candidates.jsonl
   - out/friendwork/candidates.csv
   - out/friendwork/profiles/*.html
   - out/friendwork/profiles/*.png

Usage examples:
  python scripts/friendwork_scraper.py --start-url https://app.friend.work/Candidate
  python scripts/friendwork_scraper.py --start-url https://app.friend.work/Candidate --limit 200
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(?:\+?\d[\d\-\s()]{8,}\d)")
TG_RE = re.compile(r"(?:https?://t\.me/[A-Za-z0-9_]+|@[A-Za-z0-9_]{4,})")


def slugify_url(url: str) -> str:
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]
    tail = urlparse(url).path.strip("/").replace("/", "_")[-40:] or "profile"
    tail = re.sub(r"[^a-zA-Z0-9_-]+", "_", tail)
    return f"{tail}_{digest}"


def uniq(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


def safe_text(v: str | None) -> str:
    return (v or "").strip()


def extract_label_pairs(page) -> dict[str, str]:
    # Heuristic extraction from common "label: value" UI blocks.
    data = page.evaluate(
        """
() => {
  const out = {};
  const add = (k, v) => {
    const key = (k || "").trim();
    const val = (v || "").trim();
    if (!key || !val) return;
    if (key.length > 120 || val.length > 3000) return;
    if (!(key in out)) out[key] = val;
  };

  document.querySelectorAll("dt").forEach((dt) => {
    const dd = dt.nextElementSibling;
    if (dd && dd.tagName.toLowerCase() === "dd") add(dt.textContent, dd.textContent);
  });

  document.querySelectorAll("tr").forEach((tr) => {
    const tds = tr.querySelectorAll("th,td");
    if (tds.length >= 2) add(tds[0].textContent, tds[1].textContent);
  });

  document.querySelectorAll("*").forEach((el) => {
    const txt = (el.textContent || "").trim();
    if (!txt || txt.length > 250) return;
    if (!txt.endsWith(":")) return;
    if (el.children.length > 0) return;
    const key = txt.slice(0, -1);
    let value = "";
    if (el.nextElementSibling) {
      value = (el.nextElementSibling.textContent || "").trim();
    } else if (el.parentElement) {
      const nodes = Array.from(el.parentElement.childNodes);
      const idx = nodes.indexOf(el);
      if (idx >= 0 && nodes[idx + 1]) value = (nodes[idx + 1].textContent || "").trim();
    }
    add(key, value);
  });

  return out;
}
        """
    )
    return {safe_text(k): safe_text(v) for k, v in data.items() if safe_text(k) and safe_text(v)}


def extract_candidate_links(page, base_url: str) -> list[str]:
    hrefs = page.evaluate(
        """
() => Array.from(document.querySelectorAll("a[href]"))
  .map(a => a.getAttribute("href") || "")
        """
    )
    urls: list[str] = []
    for href in hrefs:
        if not href:
            continue
        if "/candidate/profile/" not in href.lower():
            continue
        full = urljoin(base_url, href)
        if full.lower().startswith(("http://", "https://")):
            urls.append(full.split("#")[0])
    return uniq(urls)


def scroll_collect_links(page, base_url: str, max_rounds: int = 40) -> list[str]:
    links: list[str] = []
    stable_rounds = 0
    for _ in range(max_rounds):
        before = len(links)
        links = uniq(links + extract_candidate_links(page, base_url))
        page.mouse.wheel(0, 5000)
        page.wait_for_timeout(700)
        after = len(links)
        if after == before:
            stable_rounds += 1
        else:
            stable_rounds = 0
        if stable_rounds >= 4:
            break
    return links


def click_next_page(page) -> bool:
    return bool(
        page.evaluate(
            """
() => {
  const bySelectors = [
    'a[rel="next"]',
    'a[aria-label*="next" i]',
    'button[aria-label*="next" i]',
    '.pagination a.next',
    '.pagination li.next a',
    '.pager a.next',
  ];
  for (const sel of bySelectors) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const disabled = el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true';
    if (!disabled) { el.click(); return true; }
  }

  const all = Array.from(document.querySelectorAll('a,button'));
  for (const el of all) {
    const txt = (el.textContent || '').trim().toLowerCase();
    if (!txt) continue;
    const isNext = txt === '>' || txt === '›' || txt === '→' || txt.includes('след') || txt.includes('next');
    if (!isNext) continue;
    const disabled = el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true';
    if (!disabled) { el.click(); return true; }
  }
  return false;
}
            """
        )
    )


def collect_links_all_pages(page, base_url: str, max_pages: int = 100) -> list[str]:
    links: list[str] = []
    no_growth_rounds = 0
    for _ in range(max_pages):
        before = len(links)
        links = uniq(links + scroll_collect_links(page, base_url))
        after = len(links)
        if after == before:
            no_growth_rounds += 1
        else:
            no_growth_rounds = 0
        if no_growth_rounds >= 3:
            break
        moved = click_next_page(page)
        if not moved:
            break
        page.wait_for_timeout(1800)
    return links


def save_profile_images(page, profile_dir: Path, slug: str) -> list[str]:
    img_urls: list[str] = page.evaluate(
        """
() => {
  const imgs = Array.from(document.querySelectorAll('img'));
  return imgs
    .map((img) => ({
      src: img.currentSrc || img.getAttribute('src') || '',
      w: img.naturalWidth || 0,
      h: img.naturalHeight || 0
    }))
    .filter((x) => x.src && x.w >= 120 && x.h >= 120)
    .map((x) => x.src);
}
        """
    )
    img_urls = uniq(img_urls)
    saved: list[str] = []
    images_dir = profile_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    for idx, img_url in enumerate(img_urls, start=1):
        try:
            resp = page.context.request.get(img_url, timeout=30_000)
            if not resp.ok:
                continue
            content_type = (resp.headers.get("content-type") or "").lower()
            ext = ".jpg"
            if "png" in content_type:
                ext = ".png"
            elif "webp" in content_type:
                ext = ".webp"
            elif "gif" in content_type:
                ext = ".gif"
            img_path = images_dir / f"{slug}_{idx}{ext}"
            img_path.write_bytes(resp.body())
            saved.append(str(img_path))
        except Exception:
            continue
    return saved


def extract_profile(page, url: str) -> dict:
    page.wait_for_timeout(400)
    title = safe_text(page.title())
    h1 = safe_text(page.locator("h1").first.text_content() if page.locator("h1").count() else "")
    body_text = safe_text(page.inner_text("body"))
    links = page.eval_on_selector_all(
        "a[href]",
        "els => els.map(el => ({href: el.getAttribute('href') || '', text: (el.textContent || '').trim()}))",
    )
    labels = extract_label_pairs(page)

    emails = uniq(EMAIL_RE.findall(body_text))
    phones = uniq([p.strip() for p in PHONE_RE.findall(body_text)])
    telegrams = uniq(TG_RE.findall(body_text))

    return {
        "url": url,
        "page_title": title,
        "name": h1 or labels.get("Имя") or labels.get("ФИО") or "",
        "emails": emails,
        "phones": phones,
        "telegrams": telegrams,
        "labels": labels,
        "links": links,
        "raw_text": body_text,
        "scraped_at": int(time.time()),
    }


def try_login(page, email: str, password: str) -> bool:
    try:
        page.wait_for_timeout(1200)
        email_selectors = [
            'input[type="email"]',
            'input[name="email"]',
            'input[placeholder*="mail" i]',
            'input[placeholder*="логин" i]',
        ]
        pass_selectors = [
            'input[type="password"]',
            'input[name="password"]',
            'input[placeholder*="парол" i]',
        ]
        submit_selectors = [
            'button[type="submit"]',
            'button:has-text("Войти")',
            'button:has-text("Login")',
            'button:has-text("Sign in")',
        ]

        email_filled = False
        for sel in email_selectors:
            locator = page.locator(sel).first
            if locator.count():
                locator.fill(email)
                email_filled = True
                break
        if not email_filled:
            return False

        pass_filled = False
        for sel in pass_selectors:
            locator = page.locator(sel).first
            if locator.count():
                locator.fill(password)
                pass_filled = True
                break
        if not pass_filled:
            return False

        for sel in submit_selectors:
            locator = page.locator(sel).first
            if locator.count():
                locator.click()
                page.wait_for_timeout(2500)
                return True

        page.keyboard.press("Enter")
        page.wait_for_timeout(2500)
        return True
    except Exception:
        return False


def write_csv(records: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["name", "url", "emails", "phones", "telegrams", "page_title", "summary"],
        )
        writer.writeheader()
        for r in records:
            writer.writerow(
                {
                    "name": r.get("name", ""),
                    "url": r.get("url", ""),
                    "emails": "; ".join(r.get("emails", [])),
                    "phones": "; ".join(r.get("phones", [])),
                    "telegrams": "; ".join(r.get("telegrams", [])),
                    "page_title": r.get("page_title", ""),
                    "summary": r.get("raw_text", "")[:700].replace("\n", " "),
                }
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape FriendWork candidates via browser automation.")
    parser.add_argument("--start-url", required=True, help="Candidate list URL, e.g. https://app.friend.work/Candidate")
    parser.add_argument("--limit", type=int, default=100, help="Max candidate profiles to scrape")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode")
    parser.add_argument("--email", default="", help="FriendWork login email (optional)")
    parser.add_argument("--password", default="", help="FriendWork login password (optional)")
    parser.add_argument(
        "--wait-seconds",
        type=int,
        default=0,
        help="Wait N seconds for manual login instead of ENTER prompt",
    )
    parser.add_argument("--out-dir", default="out/friendwork", help="Output directory")
    parser.add_argument(
        "--profile-dir",
        default=".playwright-friendwork-profile",
        help="Persistent browser profile dir (stores login session)",
    )
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    html_dir = out_dir / "profiles"
    html_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=args.profile_dir,
            headless=args.headless,
            viewport={"width": 1440, "height": 960},
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.goto(args.start_url, wait_until="domcontentloaded", timeout=90_000)

        if args.email and args.password:
            ok = try_login(page, args.email, args.password)
            print(f"Auto-login attempted: {'ok' if ok else 'failed'}")
            page.goto(args.start_url, wait_until="domcontentloaded", timeout=90_000)

        if args.wait_seconds > 0:
            print(f"Login in opened browser. Waiting {args.wait_seconds} seconds...")
            time.sleep(args.wait_seconds)
        else:
            print("If required, login manually in opened browser. Press ENTER here when list is visible.")
            input()

        links = collect_links_all_pages(page, args.start_url)
        links = links[: args.limit]
        print(f"Collected candidate links: {len(links)}")

        records: list[dict] = []
        for idx, link in enumerate(links, start=1):
            print(f"[{idx}/{len(links)}] {link}")
            profile_page = context.new_page()
            try:
                profile_page.goto(link, wait_until="domcontentloaded", timeout=90_000)
                profile_page.wait_for_timeout(1200)
                rec = extract_profile(profile_page, link)

                slug = slugify_url(link)
                html_path = html_dir / f"{slug}.html"
                png_path = html_dir / f"{slug}.png"
                html_path.write_text(profile_page.content(), encoding="utf-8")
                profile_page.screenshot(path=str(png_path), full_page=True)
                image_files = save_profile_images(profile_page, html_dir, slug)

                rec["snapshot_html"] = str(html_path)
                rec["snapshot_png"] = str(png_path)
                rec["profile_images"] = image_files
                records.append(rec)
            except PlaywrightTimeoutError:
                records.append({"url": link, "error": "timeout"})
            except Exception as exc:  # noqa: BLE001
                records.append({"url": link, "error": str(exc)})
            finally:
                profile_page.close()

        jsonl_path = out_dir / "candidates.jsonl"
        with jsonl_path.open("w", encoding="utf-8") as f:
            for rec in records:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")

        write_csv(records, out_dir / "candidates.csv")
        context.close()

    print(f"Done. Saved {len(records)} records to: {out_dir}")


if __name__ == "__main__":
    main()
