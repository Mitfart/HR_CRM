import argparse
import json
import os
import re
import tempfile
import sys
import threading
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import parse_qs, urlencode, urljoin, urlparse, urlunparse
import shlex

from bs4 import BeautifulSoup
from openpyxl import Workbook
from playwright.sync_api import Browser, BrowserContext, Page, Playwright, sync_playwright

PRINT_LOCK = threading.Lock()


def log_line(message: str) -> None:
    with PRINT_LOCK:
        print(message, flush=True)


@dataclass
class ScraperConfig:
    start_url: str
    link_pattern: str
    output_file: str
    headless: bool = False
    # Max profile/detail rows to collect across all listing pages (not “listing page count”).
    max_pages: int = 100
    wait_seconds: float = 1.0
    autotest_filter: Optional[str] = None
    connect_cdp: Optional[str] = None
    browser_channel: str = "msedge"
    wait_for_login: bool = False
    data_tag: str = "data-autotest-id"
    login_wait_seconds: int = 0
    use_system_default_browser: bool = False
    browser_executable_path: Optional[str] = None


@dataclass
class PageRecord:
    source_page: str
    target_url: str
    title: str = ""
    plain_text: str = ""
    autotest_values: Dict[str, str] = field(default_factory=dict)

    def as_flat_dict(self) -> Dict[str, str]:
        row = {
            "source_page": self.source_page,
            "title": self.title,
            "plain_text": self.plain_text,
        }
        for key, value in self.autotest_values.items():
            row[key] = value
        return row


def normalize_url(base_url: str, href: str) -> Optional[str]:
    if not href:
        return None
    href = href.strip()
    if href.lower().startswith("javascript:"):
        return None
    if href.startswith("#"):
        # Hash-router SPAs: attach fragment to current page URL (strip existing fragment first).
        if href == "#":
            return None
        base = base_url.strip().rsplit("#", 1)[0]
        return f"{base}{href}"
    return urljoin(base_url, href)


def is_same_domain(url_a: str, url_b: str) -> bool:
    return urlparse(url_a).netloc == urlparse(url_b).netloc


def is_target_page_url(current_url: str, target_url: str) -> bool:
    current = urlparse(current_url.strip())
    target = urlparse(target_url.strip())
    if current.netloc != target.netloc:
        return False
    target_path = (target.path or "/").rstrip("/")
    current_path = (current.path or "/").rstrip("/")
    if not target_path:
        target_path = "/"
    if not current_path:
        current_path = "/"
    return current_path == target_path or current_path.startswith(target_path + "/")


def wait_until_target_page_open(page: Page, target_url: str, max_wait_seconds: int) -> None:
    log_line("\nWaiting until target page is open in browser...")
    log_line(f"Target: {target_url.strip()}")
    start = time.time()

    while True:
        current = page.url
        if is_target_page_url(current, target_url):
            log_line(f"Target page detected: {current}")
            log_line("Waiting for page to fully load and stabilize before scraping...")
            wait_for_profile_page_ready(page, timeout_ms=120000)
            return
        elapsed = int(time.time() - start)
        if max_wait_seconds > 0 and elapsed >= max_wait_seconds:
            raise TimeoutError(f"Timed out waiting for target page after {max_wait_seconds} seconds.")
        if max_wait_seconds > 0:
            left = max_wait_seconds - elapsed
            log_line(f"  Current: {current} | waiting... ({left}s left)")
        else:
            log_line(f"  Current: {current} | waiting...")
        time.sleep(2)


def extract_links(page: Page, pattern: str, base_url: str) -> List[str]:
    """Collect candidate URLs from <a href>. Supports root-relative, relative, and hash-router hrefs."""
    html = page.content()
    soup = BeautifulSoup(html, "lxml")
    regex = re.compile(pattern)
    links: List[str] = []
    for a_tag in soup.find_all("a", href=True):
        href = (a_tag.get("href") or "").strip()
        if not href or href.lower().startswith("javascript:"):
            continue
        full_url = normalize_url(base_url, href)
        if not full_url:
            continue
        if not is_same_domain(base_url, full_url):
            continue
        parsed = urlparse(full_url)
        path = parsed.path or ""
        frag = parsed.fragment or ""
        frag_path = frag.split("?", 1)[0] if frag else ""
        # Match pattern against path, hash path (SPA), raw href, or full URL
        haystack = " ".join(
            s
            for s in (href, path, frag_path, full_url, f"/{frag_path.lstrip('/')}")
            if s
        )
        if not regex.search(haystack):
            continue
        links.append(full_url)
    return list(dict.fromkeys(links))


def extract_tag_data(page_html: str, data_tag: str, autotest_filter: Optional[str]) -> Dict[str, str]:
    soup = BeautifulSoup(page_html, "lxml")
    result: Dict[str, str] = {}

    nodes = soup.select(f"[{data_tag}]")
    for node in nodes:
        key = (node.get(data_tag) or "").strip()
        if not key:
            continue
        if autotest_filter and autotest_filter.lower() not in key.lower():
            continue
        value = node.get_text(separator=" ", strip=True)
        if not value:
            # fallback to value-bearing attributes
            value = node.get("value", "") or node.get("content", "") or ""
        result[key] = value

    return result


def extract_plain_text(page_html: str, max_len: int = 1000) -> str:
    soup = BeautifulSoup(page_html, "lxml")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = " ".join(soup.get_text(separator=" ", strip=True).split())
    return text[:max_len]


def wait_for_page_fully_loaded(page: Page, timeout_ms: int = 60000) -> None:
    # Wait for DOM readiness and then for network to settle.
    page.wait_for_load_state("domcontentloaded", timeout=timeout_ms)
    page.wait_for_load_state("load", timeout=timeout_ms)
    try:
        page.wait_for_load_state("networkidle", timeout=timeout_ms)
    except Exception:
        # Some pages poll in background forever; continue after DOM/load are ready.
        pass


def wait_until_document_ready(page: Page, timeout_ms: int = 60000) -> None:
    page.wait_for_function(
        "() => document.readyState === 'complete'",
        timeout=timeout_ms,
    )


def wait_for_dom_stable(page: Page, settle_ms: int = 800, timeout_ms: int = 60000) -> None:
    deadline = time.time() + (timeout_ms / 1000.0)
    last_hash = ""
    stable_cycles = 0
    while time.time() < deadline:
        digest = page.evaluate(
            """() => {
                const body = document.body;
                if (!body) return '';
                return [
                  document.readyState,
                  document.documentElement ? document.documentElement.innerHTML.length : 0,
                  body.innerText ? body.innerText.length : 0
                ].join('|');
            }"""
        )
        if digest == last_hash:
            stable_cycles += 1
        else:
            stable_cycles = 0
            last_hash = digest
        if stable_cycles >= 2:
            return
        page.wait_for_timeout(settle_ms)
    raise TimeoutError("Timed out waiting for DOM to stabilize.")


def wait_for_profile_page_ready(page: Page, timeout_ms: int = 60000) -> None:
    """Wait for load without requiring long DOM stability (SPAs often never become 'stable')."""
    try:
        page.wait_for_load_state("load", timeout=timeout_ms)
    except Exception:
        pass
    try:
        page.wait_for_function(
            "() => document.readyState === 'complete'",
            timeout=min(30000, timeout_ms),
        )
    except Exception:
        pass
    try:
        page.wait_for_load_state("domcontentloaded", timeout=min(15000, timeout_ms))
    except Exception:
        pass
    # Best-effort settle; many apps animate or poll forever — do not block scraping on this.
    try:
        wait_for_dom_stable(page, settle_ms=400, timeout_ms=min(20000, timeout_ms))
    except Exception:
        pass


def _pagination_control_looks_disabled(loc) -> bool:
    """Skip Next controls that are visibly disabled (last page) or ARIA-disabled."""
    try:
        if loc.count() == 0:
            return True
        return bool(
            loc.first.evaluate(
                """el => {
                    const next = el.closest('.ant-pagination-next');
                    if (next && next.classList.contains('ant-pagination-disabled')) return true;
                    const item = el.closest('.page-item');
                    if (item && item.classList.contains('disabled')) return true;
                    if (el.getAttribute('aria-disabled') === 'true') return true;
                    if (el.disabled) return true;
                    return false;
                }"""
            )
        )
    except Exception:
        return False


def _try_click_pagination_control(page: Page) -> bool:
    """Try common next/previous/chevron patterns (many UIs do not use rel=next)."""
    selectors = [
        "a[rel='next']",
        "button[rel='next']",
        "[aria-label*='Next']",
        "[aria-label*='next']",
        "[title*='Next']",
        "[title*='next']",
        "[data-testid*='next']",
        "[data-testid*='Next']",
        "a:has-text('Next')",
        "button:has-text('Next')",
        "span:has-text('Next')",
        "a:has-text('>')",
        "button:has-text('>')",
        "button:has-text('›')",
        "a:has-text('›')",
        "a.page-link:has-text('›')",
        "a.page-link:has-text('>')",
        "button.page-link",
        ".ant-pagination-next:not(.ant-pagination-disabled) button",
        ".ant-pagination-next:not(.ant-pagination-disabled) a",
        "[class*='pagination'] [class*='next']:not([disabled])",
        "[class*='Pagination'] button[aria-label*='next']",
        "[class*='Pagination'] button[aria-label*='Next']",
        "nav[aria-label*='pagination'] a:last-of-type",
        "nav[aria-label*='Pagination'] a:last-of-type",
        "nav[aria-label*='pagination'] button:last-of-type",
    ]
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if loc.count() == 0:
                continue
            if not loc.is_visible():
                continue
            if _pagination_control_looks_disabled(loc):
                continue
            try:
                if not loc.is_enabled():
                    continue
            except Exception:
                pass
            loc.scroll_into_view_if_needed(timeout=3000)
            loc.click(timeout=4000)
            wait_for_page_fully_loaded(page, timeout_ms=45000)
            return True
        except Exception:
            continue
    # Role-based next inside pagination-like regions (avoid unrelated “Next” buttons)
    pag_roots = [
        page.locator(".ant-pagination"),
        page.locator("[class*='pagination']"),
        page.locator("[class*='Pagination']"),
        page.locator("nav[aria-label*='page']"),
        page.locator("nav[aria-label*='Page']"),
        page.locator("ul.pagination"),
    ]
    for root in pag_roots:
        try:
            r = root.first
            if r.count() == 0:
                continue
            for name_pat in (r"next", r"forward"):
                try:
                    btn = r.get_by_role("button", name=re.compile(name_pat, re.I)).first
                    if btn.count() and btn.is_visible() and not _pagination_control_looks_disabled(btn):
                        btn.scroll_into_view_if_needed(timeout=2000)
                        btn.click(timeout=4000)
                        wait_for_page_fully_loaded(page, timeout_ms=45000)
                        return True
                except Exception:
                    continue
        except Exception:
            continue
    return False


def _try_click_page_number(page: Page, next_page_num: int) -> bool:
    """Click a numbered pagination control for page N (e.g. 2 after finishing page 1)."""
    label = str(next_page_num)
    roots = [
        page.locator(".ant-pagination"),
        page.locator("[class*='pagination']"),
        page.locator("[class*='Pagination']"),
        page.locator("nav[aria-label*='pagination']"),
        page.locator("nav[aria-label*='Pagination']"),
        page.locator("ul.pagination"),
        page.locator("[role='navigation']"),
    ]
    for root in roots:
        try:
            r = root.first
            if r.count() == 0:
                continue
            for role in ("link", "button"):
                try:
                    item = r.get_by_role(role, name=label, exact=True).first
                    if item.count() and item.is_visible():
                        item.scroll_into_view_if_needed(timeout=2000)
                        item.click(timeout=4000)
                        wait_for_page_fully_loaded(page, timeout_ms=45000)
                        return True
                except Exception:
                    continue
        except Exception:
            continue
    try:
        link = page.get_by_role("link", name=label, exact=True).first
        if link.count() and link.is_visible():
            link.scroll_into_view_if_needed(timeout=2000)
            link.click(timeout=4000)
            wait_for_page_fully_loaded(page, timeout_ms=45000)
            return True
    except Exception:
        pass
    try:
        btn = page.get_by_role("button", name=label, exact=True).first
        if btn.count() and btn.is_visible():
            btn.scroll_into_view_if_needed(timeout=2000)
            btn.click(timeout=4000)
            wait_for_page_fully_loaded(page, timeout_ms=45000)
            return True
    except Exception:
        pass
    return False


def _try_increment_url_page_param(page: Page) -> bool:
    """Advance ?page= / ?p= / etc. when the UI does not expose a working Next control."""
    parsed = urlparse(page.url)
    qs = parse_qs(parsed.query, keep_blank_values=True)
    page_keys = ("page", "p", "pageNumber", "pageNo", "currentPage", "current")
    changed = False
    for key in page_keys:
        if key not in qs or not qs[key]:
            continue
        try:
            cur = int(str(qs[key][0]).strip())
        except (ValueError, TypeError):
            continue
        qs[key] = [str(cur + 1)]
        changed = True
        break
    if not changed:
        return False
    new_query = urlencode(qs, doseq=True)
    new_url = urlunparse(
        (parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment)
    )
    try:
        page.goto(new_url, wait_until="domcontentloaded", timeout=45000)
        wait_for_page_fully_loaded(page, timeout_ms=45000)
        return True
    except Exception:
        return False


def wait_for_listing_change_after_pagination(
    page: Page,
    pattern: str,
    url_before: str,
    links_fp_before: frozenset,
    *,
    timeout_ms: int = 120_000,
    poll_ms: int = 500,
) -> Tuple[bool, List[str]]:
    """
    After Next / page change, many SPAs keep stale HTML for a short time. If we read links
    immediately, the fingerprint matches the previous page and we wrongly think pagination ended.
    Poll until the URL or the matching link set changes, or until timeout.
    """
    deadline = time.time() + timeout_ms / 1000.0
    start = time.time()
    stale_logged = False
    while time.time() < deadline:
        try:
            cur_url = page.url
            links = extract_links(page, pattern, cur_url)
        except Exception:
            page.wait_for_timeout(poll_ms)
            continue
        fp = frozenset(links)
        if cur_url != url_before or fp != links_fp_before:
            return True, links
        if not stale_logged and (time.time() - start) >= 12.0:
            log_line(
                "  (Listing HTML not updated yet after pagination; waiting for new rows to render...)"
            )
            stale_logged = True
        page.wait_for_timeout(poll_ms)
    try:
        links = extract_links(page, pattern, page.url)
    except Exception:
        return False, []
    fp = frozenset(links)
    changed = page.url != url_before or fp != links_fp_before
    return changed, links


def go_to_next_listing_page(page: Page, current_listing_page_index: int) -> bool:
    """
    Move listing forward (page 1 -> 2 -> 3 ...). Tries controls first, then ?page= style URLs,
    then clicking the next page number.
    """
    next_num = current_listing_page_index + 1
    log_line(f"  -> Pagination: trying to open listing page {next_num}...")

    if _try_click_pagination_control(page):
        log_line(f"     OK (next/previous control).")
        return True
    if _try_increment_url_page_param(page):
        log_line(f"     OK (URL page parameter).")
        return True
    if _try_click_page_number(page, next_num):
        log_line(f"     OK (clicked page number {next_num}).")
        return True
    if _try_goto_with_page_query(page, next_num):
        log_line(f"     OK (opened ?page={next_num} on current path).")
        return True

    log_line(
        "     Could not find next listing page (no Next control, no ?page= param, "
        f"no clickable '{next_num}', ?page={next_num} failed). Check pagination or URL pattern."
    )
    return False


def _try_goto_with_page_query(page: Page, page_num: int) -> bool:
    """Last resort: same path with ?page=N (many APIs use this when UI clicks fail)."""
    parsed = urlparse(page.url)
    qs = parse_qs(parsed.query, keep_blank_values=True)
    qs["page"] = [str(page_num)]
    new_query = urlencode(qs, doseq=True)
    new_url = urlunparse(
        (parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment)
    )
    try:
        page.goto(new_url, wait_until="domcontentloaded", timeout=45000)
        wait_for_page_fully_loaded(page, timeout_ms=45000)
        return True
    except Exception:
        return False


def scrape_profile_page(
    context: BrowserContext, source_page_url: str, target_url: str, cfg: ScraperConfig
) -> PageRecord:
    timeout_ms = 120000
    tab = context.new_page()
    try:
        log_line(f"    -> Opening profile: {target_url}")
        tab.goto(target_url, wait_until="load", timeout=timeout_ms)
        wait_for_profile_page_ready(tab, timeout_ms=timeout_ms)
        log_line(f"       Loaded tab URL: {tab.url}")
        time.sleep(cfg.wait_seconds)
        html = tab.content()
        title = tab.title()
    finally:
        tab.close()

    autotest_data = extract_tag_data(html, cfg.data_tag, cfg.autotest_filter)
    plain_text = extract_plain_text(html)
    return PageRecord(
        source_page=source_page_url,
        target_url=target_url,
        title=title,
        plain_text=plain_text,
        autotest_values=autotest_data,
    )


def append_record_jsonl(jsonl_path: str, record: PageRecord) -> None:
    row = record.as_flat_dict()
    with open(jsonl_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


def iter_jsonl_rows(jsonl_path: str):
    if not os.path.exists(jsonl_path):
        return
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(row, dict):
                yield row


def save_records_checkpoint(jsonl_path: str, records_count: int, output_path: str) -> None:
    """Write Excel after each listing page so progress survives crashes or early stop."""
    if records_count <= 0:
        return
    try:
        save_to_excel(jsonl_path, records_count, output_path)
    except Exception as exc:
        log_line(f"Warning: could not write Excel checkpoint ({output_path}): {exc}")


def run_scraper(cfg: ScraperConfig) -> None:
    """One browser window: listing stays on the main tab; each profile opens as another tab (same context)."""
    output_dir = os.path.dirname(cfg.output_file) or "."
    os.makedirs(output_dir, exist_ok=True)
    fd, jsonl_path = tempfile.mkstemp(prefix="._records_", suffix=".jsonl", dir=output_dir)
    os.close(fd)
    records_count = 0
    try:
        with sync_playwright() as p:
            browser = create_browser(p, cfg)
            context = browser.new_context()
            page = context.new_page()

            page.goto(cfg.start_url.strip(), wait_until="domcontentloaded", timeout=60000)
            wait_for_page_fully_loaded(page, timeout_ms=60000)
            if cfg.wait_for_login:
                wait_until_target_page_open(page, cfg.start_url, cfg.login_wait_seconds)
            time.sleep(cfg.wait_seconds)
            log_line(f"Listing tab ready. URL: {page.url}")
            log_line(f"__PROGRESS__ 0 {cfg.max_pages}")

            discovered: Set[str] = set()

            current_page_index = 1
            # Enough listing steps when few profiles appear per page or the site has many index pages.
            max_listing_steps = max(10_000, cfg.max_pages * 50)
            while records_count < cfg.max_pages and current_page_index <= max_listing_steps:
                current_url = page.url
                try:
                    links = extract_links(page, cfg.link_pattern, current_url)
                except Exception as exc:
                    log_line(f"Stopping: listing page is no longer available ({exc}).")
                    break
                log_line(f"[Page {current_page_index}] Found {len(links)} matching links")
                listing_url_before_nav = current_url
                listing_links_fingerprint = frozenset(links)
                if not links:
                    log_line(
                        "  (No links matched the pattern in the current HTML. "
                        "Check Link Pattern regex, scroll the list if it is virtualized, or wait for the table to load.)"
                    )

                batch_links: List[str] = []
                for link in links:
                    if records_count >= cfg.max_pages:
                        break
                    remaining = cfg.max_pages - records_count
                    if remaining <= 0:
                        break
                    if link in discovered:
                        continue
                    if not is_same_domain(cfg.start_url, link):
                        continue
                    discovered.add(link)
                    batch_links.append(link)
                    if len(batch_links) >= remaining:
                        break

                if batch_links:
                    log_line(
                        f"  -> Opening {len(batch_links)} profile page(s) as new tabs in the same browser window..."
                    )
                    for link in batch_links:
                        if records_count >= cfg.max_pages:
                            break
                        try:
                            record = scrape_profile_page(context, current_url, link, cfg)
                            append_record_jsonl(jsonl_path, record)
                            records_count += 1
                            log_line(f"__PROGRESS__ {records_count} {cfg.max_pages}")
                        except Exception as exc:
                            log_line(f"    !! Failed to read {link}: {exc}")

                # One Excel checkpoint per listing page (after all profiles for this page are done).
                save_records_checkpoint(jsonl_path, records_count, cfg.output_file)

                if records_count >= cfg.max_pages:
                    log_line("Reached max page limit.")
                    break

                try:
                    moved = go_to_next_listing_page(page, current_page_index)
                except Exception as exc:
                    log_line(f"Pagination stopped: page is no longer available ({exc}).")
                    break
                if not moved:
                    log_line("Stopped: pagination finished (no next listing page).")
                    break
                try:
                    listing_changed, _verify_links = wait_for_listing_change_after_pagination(
                        page,
                        cfg.link_pattern,
                        listing_url_before_nav,
                        listing_links_fingerprint,
                    )
                except Exception as exc:
                    log_line(f"Stopping: could not read listing after pagination ({exc}).")
                    break
                if not listing_changed:
                    log_line(
                        "Stopped: listing did not change after the next page (waited for new content) "
                        "— reached the last listing page or pagination did not update the list."
                    )
                    break
                current_page_index += 1
                time.sleep(cfg.wait_seconds)
            if current_page_index > max_listing_steps:
                log_line(f"Stopped pagination after safety limit of {max_listing_steps} listing pages.")

            context.close()
            browser.close()
            log_line(f"\nDone. Saved {records_count} records to {cfg.output_file}")
    finally:
        try:
            save_to_excel(jsonl_path, records_count, cfg.output_file)
        except Exception as exc:
            log_line(f"Warning: could not write Excel file ({cfg.output_file}): {exc}")
        finally:
            if os.path.exists(jsonl_path):
                os.unlink(jsonl_path)


def _cell_is_blank(val: object) -> bool:
    if val is None:
        return True
    if isinstance(val, str):
        return val.strip() == ""
    return str(val).strip() == ""


def save_to_excel(jsonl_path: str, records_count: int, output_path: str) -> None:
    if records_count <= 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 0:
        log_line(
            f"No records collected; keeping existing Excel file unchanged: {output_path}"
        )
        return

    headers_order: List[str] = []
    non_blank_columns: Set[str] = set()
    for row in iter_jsonl_rows(jsonl_path):
        row.pop("target_url", None)
        for key, value in row.items():
            if key not in headers_order:
                headers_order.append(key)
            if not _cell_is_blank(value):
                non_blank_columns.add(key)

    selected_headers = [h for h in headers_order if h in non_blank_columns]
    if not selected_headers:
        selected_headers = ["message"]

    wb = Workbook(write_only=True)
    ws = wb.create_sheet(title="data")
    ws.append(selected_headers)

    if selected_headers == ["message"]:
        ws.append(["No variable data columns after cleanup"])
    else:
        for row in iter_jsonl_rows(jsonl_path):
            row.pop("target_url", None)
            ws.append([row.get(h, "") for h in selected_headers])

    output_dir = os.path.dirname(output_path) or "."
    os.makedirs(output_dir, exist_ok=True)
    fd, temp_path = tempfile.mkstemp(prefix="._tmp_", suffix=".xlsx", dir=output_dir)
    os.close(fd)
    try:
        wb.save(temp_path)
        os.replace(temp_path, output_path)
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


def create_browser(
    playwright: Playwright, cfg: ScraperConfig, *, announce_executable: bool = True
) -> Browser:
    if cfg.connect_cdp:
        # Use existing Chrome/Edge instance started with remote debugging port.
        # Example: msedge --remote-debugging-port=9222
        return playwright.chromium.connect_over_cdp(cfg.connect_cdp)
    if cfg.browser_executable_path:
        return playwright.chromium.launch(
            headless=cfg.headless, executable_path=cfg.browser_executable_path
        )
    if cfg.use_system_default_browser:
        executable = get_windows_default_browser_executable()
        if not executable:
            raise RuntimeError(
                "Could not detect system default browser executable. "
                "Use --browser-executable-path to set it manually."
            )
        if announce_executable:
            log_line(f"Using system default browser executable: {executable}")
        return playwright.chromium.launch(headless=cfg.headless, executable_path=executable)
    return playwright.chromium.launch(headless=cfg.headless, channel=cfg.browser_channel)


def get_windows_default_browser_executable() -> Optional[str]:
    if sys.platform != "win32":
        return None
    try:
        import winreg  # type: ignore
    except Exception:
        return None

    prog_id = None
    command = None
    try:
        user_choice_key = r"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice"
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, user_choice_key) as key:
            prog_id = winreg.QueryValueEx(key, "ProgId")[0]
    except Exception:
        prog_id = None

    if prog_id:
        try:
            cmd_key = rf"{prog_id}\shell\open\command"
            with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, cmd_key) as key:
                command = winreg.QueryValueEx(key, "")[0]
        except Exception:
            command = None

    if not command:
        try:
            with winreg.OpenKey(
                winreg.HKEY_CLASSES_ROOT, r"http\shell\open\command"
            ) as key:
                command = winreg.QueryValueEx(key, "")[0]
        except Exception:
            return None

    parts = shlex.split(command, posix=False)
    if not parts:
        return None
    return parts[0].strip('"')


def parse_args() -> ScraperConfig:
    parser = argparse.ArgumentParser(
        description="Scrape relative links, extract page data, and export to Excel."
    )
    parser.add_argument("--start-url", required=True, help="Entry URL to begin crawling.")
    parser.add_argument(
        "--link-pattern",
        required=True,
        help=r"Regex to match relative links. Example: /Candidate/Profile",
    )
    parser.add_argument("--output", default="output.xlsx", help="Excel file path.")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode.")
    parser.add_argument(
        "--max-pages",
        type=int,
        default=100,
        help="Target number of profile/detail rows to collect (listing pagination continues until this is reached).",
    )
    parser.add_argument("--wait-seconds", type=float, default=1.0, help="Delay between actions.")
    parser.add_argument(
        "--autotest-filter",
        default=None,
        help="Optional text filter for data-autotest-id keys.",
    )
    parser.add_argument(
        "--data-tag",
        default="data-autotest-id",
        help="HTML attribute tag to extract from (default: data-autotest-id).",
    )
    parser.add_argument(
        "--connect-cdp",
        default=None,
        help="Connect to running browser via CDP (e.g. http://127.0.0.1:9222).",
    )
    parser.add_argument(
        "--browser-channel",
        default="msedge",
        choices=["msedge", "chrome", "chromium"],
        help="Installed browser channel to launch (default: msedge).",
    )
    parser.add_argument(
        "--wait-for-login",
        action="store_true",
        help="Wait until target page URL is opened (supports login/register redirects).",
    )
    parser.add_argument(
        "--login-wait-seconds",
        type=int,
        default=0,
        help="Max wait for target page; 0 means wait indefinitely.",
    )
    parser.add_argument(
        "--use-system-default-browser",
        action="store_true",
        help="Launch using Windows system default browser executable (chromium-based only).",
    )
    parser.add_argument(
        "--browser-executable-path",
        default=None,
        help="Full browser executable path (overrides channel/default browser detection).",
    )
    args = parser.parse_args()

    return ScraperConfig(
        start_url=args.start_url,
        link_pattern=args.link_pattern,
        output_file=args.output,
        headless=args.headless,
        max_pages=args.max_pages,
        wait_seconds=args.wait_seconds,
        autotest_filter=args.autotest_filter,
        connect_cdp=args.connect_cdp,
        browser_channel=args.browser_channel,
        wait_for_login=args.wait_for_login,
        data_tag=args.data_tag,
        login_wait_seconds=args.login_wait_seconds,
        use_system_default_browser=args.use_system_default_browser,
        browser_executable_path=args.browser_executable_path,
    )


if __name__ == "__main__":
    config = parse_args()
    run_scraper(config)
