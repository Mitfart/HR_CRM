import os
import subprocess
import sys
import tkinter as tk
import time
import threading
import queue
import re
from pathlib import Path
from tkinter import filedialog, messagebox, ttk


if getattr(sys, "frozen", False):
    APP_DIR = Path(sys.executable).resolve().parent
else:
    APP_DIR = Path(__file__).resolve().parent

SCRAPER_FILE = APP_DIR / "web_data_extractor.py"

PROGRESS_LINE_RE = re.compile(r"^__PROGRESS__\s+(\d+)\s+(\d+)\s*$")


class LauncherApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Web Data Extractor Launcher")
        self.root.geometry("860x740")
        self.root.minsize(860, 740)

        self.start_url = tk.StringVar(value="https://app.friend.work/Candidate")
        self.link_pattern = tk.StringVar(value="/Candidate/Profile")
        self.output_file = tk.StringVar(value=str(APP_DIR / "candidates.xlsx"))
        self.data_tag = tk.StringVar(value="data-autotest-id")
        self.max_pages = tk.StringVar(value="20")

        self.status_var = tk.StringVar(value="Idle")
        self.timer_var = tk.StringVar(value="00:00")
        self.process: subprocess.Popen | None = None
        self.process_started_at: float | None = None
        self.log_queue: queue.Queue[str] = queue.Queue()
        self.progress_status_var = tk.StringVar(value="Progress: —")

        self._configure_style()
        self._build_ui()

    def _configure_style(self) -> None:
        style = ttk.Style(self.root)
        style.configure("Title.TLabel", font=("Segoe UI", 16, "bold"))
        style.configure("Hint.TLabel", foreground="#444444")
        style.configure("Run.TButton", font=("Segoe UI", 11, "bold"), padding=(10, 8))
        style.configure("Card.TLabelframe", padding=12)
        style.configure("Card.TLabelframe.Label", font=("Segoe UI", 10, "bold"))

    def _build_ui(self) -> None:
        container = ttk.Frame(self.root, padding=14)
        container.pack(fill="both", expand=True)
        container.columnconfigure(0, weight=1)

        ttk.Label(container, text="Web Data Extractor", style="Title.TLabel").grid(row=0, column=0, sticky="w")
        ttk.Label(
            container,
            text=(
                "Uses system default browser. One window: listing stays open; each profile opens as a "
                "new tab. Target amount = how many profile rows to save; the scraper steps through "
                "listing pagination (1→2→3…) until the target is reached or the list ends."
            ),
            style="Hint.TLabel",
        ).grid(row=1, column=0, sticky="w", pady=(2, 10))

        form_card = ttk.LabelFrame(container, text="Main Parameters", style="Card.TLabelframe")
        form_card.grid(row=2, column=0, sticky="nsew")
        form_card.columnconfigure(1, weight=1)

        row = 0
        row = self._add_entry(form_card, row, "Start URL", self.start_url, browse=False)
        row = self._add_entry(form_card, row, "Link Pattern (regex)", self.link_pattern, browse=False)
        row = self._add_entry(form_card, row, "Output Excel", self.output_file, browse=True)
        row = self._add_entry(form_card, row, "Tag Field (optional)", self.data_tag, browse=False)
        row = self._add_entry(form_card, row, "Target amount", self.max_pages, browse=False, width=18)

        action_frame = ttk.Frame(container, padding=(0, 12, 0, 0))
        action_frame.grid(row=3, column=0, sticky="ew")
        action_frame.columnconfigure(0, weight=1)
        self.run_button = ttk.Button(action_frame, text="Run / Execute", style="Run.TButton", command=self.run_scraper)
        self.run_button.grid(
            row=0, column=0, sticky="ew"
        )

        progress_card = ttk.LabelFrame(container, text="Progress", style="Card.TLabelframe")
        progress_card.grid(row=4, column=0, sticky="ew", pady=(12, 0))
        progress_card.columnconfigure(0, weight=1)
        self.progress_bar = ttk.Progressbar(
            progress_card,
            mode="determinate",
            maximum=100,
            value=0,
            length=400,
        )
        self.progress_bar.grid(row=0, column=0, sticky="ew", padx=2, pady=(4, 2))
        ttk.Label(progress_card, textvariable=self.progress_status_var).grid(
            row=1, column=0, sticky="w", padx=2, pady=(0, 6)
        )

        log_card = ttk.LabelFrame(container, text="Execution Log", style="Card.TLabelframe")
        log_card.grid(row=5, column=0, sticky="nsew", pady=(10, 0))
        log_card.columnconfigure(0, weight=1)
        log_card.rowconfigure(0, weight=1)
        container.rowconfigure(5, weight=1)

        self.log = tk.Text(log_card, height=10, wrap="word", relief="flat", borderwidth=0)
        self.log.grid(row=0, column=0, sticky="nsew")

        scrollbar = ttk.Scrollbar(log_card, orient="vertical", command=self.log.yview)
        scrollbar.grid(row=0, column=1, sticky="ns")
        self.log.configure(yscrollcommand=scrollbar.set)

        footer = ttk.Frame(container, padding=(0, 8, 0, 0))
        footer.grid(row=6, column=0, sticky="ew")
        footer.columnconfigure(1, weight=1)
        ttk.Label(footer, text="Status:").grid(row=0, column=0, sticky="w")
        ttk.Label(footer, textvariable=self.status_var).grid(row=0, column=1, sticky="w", padx=(6, 12))
        ttk.Label(footer, text="Elapsed:").grid(row=0, column=2, sticky="e")
        ttk.Label(footer, textvariable=self.timer_var).grid(row=0, column=3, sticky="e", padx=(6, 0))

    def _add_entry(
        self,
        frame: tk.Frame,
        row: int,
        title: str,
        var: tk.StringVar,
        width: int = 64,
        browse: bool = False,
    ) -> int:
        ttk.Label(frame, text=title).grid(row=row, column=0, sticky="w", pady=5, padx=(0, 8))
        entry = ttk.Entry(frame, textvariable=var, width=width)
        entry.grid(row=row, column=1, sticky="ew", pady=5)
        if browse:
            ttk.Button(frame, text="Browse", command=self.pick_output).grid(
                row=row, column=2, sticky="w", pady=5, padx=(8, 0)
            )
        return row + 1

    def pick_output(self) -> None:
        path = filedialog.asksaveasfilename(
            title="Choose output Excel file",
            defaultextension=".xlsx",
            filetypes=[("Excel files", "*.xlsx"), ("All files", "*.*")],
        )
        if path:
            self.output_file.set(path)

    def _build_command(self) -> list[str]:
        if not SCRAPER_FILE.exists():
            raise FileNotFoundError(f"Scraper file not found: {SCRAPER_FILE}")

        command = [
            "python",
            "-u",
            str(SCRAPER_FILE),
            "--start-url",
            self.start_url.get().strip(),
            "--link-pattern",
            self.link_pattern.get().strip(),
            "--output",
            self.output_file.get().strip(),
            "--max-pages",
            self.max_pages.get().strip(),
        ]

        data_tag = self.data_tag.get().strip()
        if data_tag:
            command.extend(["--data-tag", data_tag])

        command.extend(["--wait-for-login", "--login-wait-seconds", "0"])
        command.append("--use-system-default-browser")

        return command

    def _validate_inputs(self) -> None:
        start_url = self.start_url.get().strip()
        link_pattern = self.link_pattern.get().strip()
        output_file = self.output_file.get().strip()
        data_tag = self.data_tag.get().strip()
        max_pages_raw = self.max_pages.get().strip()

        if not start_url:
            raise ValueError("Start URL is required.")
        if not (start_url.startswith("http://") or start_url.startswith("https://")):
            raise ValueError("Start URL must start with http:// or https://")
        if not link_pattern:
            raise ValueError("Link Pattern is required.")
        try:
            re.compile(link_pattern)
        except re.error as exc:
            raise ValueError(f"Link Pattern is not valid regex: {exc}") from exc
        if not output_file:
            raise ValueError("Output Excel path is required.")
        if not output_file.lower().endswith(".xlsx"):
            raise ValueError("Output file must have .xlsx extension.")
        if not max_pages_raw.isdigit() or int(max_pages_raw) <= 0:
            raise ValueError("Target amount must be a positive integer.")
        if data_tag and (" " in data_tag or "=" in data_tag):
            raise ValueError("Tag Field should be an attribute name only (no spaces or '=').")

    def run_scraper(self) -> None:
        if self.process and self.process.poll() is None:
            messagebox.showinfo("Already Running", "Scraper is already running.")
            return
        try:
            self._validate_inputs()
            command = self._build_command()
            target_n = int(self.max_pages.get().strip())
            self.progress_bar.configure(maximum=max(target_n, 1), value=0)
            self.progress_status_var.set(f"Progress: 0 / {target_n}")
            self.log.delete("1.0", "end")
            self._write_log("Starting scraper in background...\n")
            self._write_log("Command: " + " ".join(command))
            creationflags = 0
            if sys.platform == "win32":
                creationflags = subprocess.CREATE_NO_WINDOW
            proc = subprocess.Popen(
                command,
                cwd=str(APP_DIR),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=creationflags,
                env={**os.environ, "PYTHONUNBUFFERED": "1"},
            )
            self.process = proc
            self.process_started_at = time.time()
            self.status_var.set("Running")
            self.timer_var.set("00:00")
            self.run_button.state(["disabled"])

            threading.Thread(target=self._stream_output, args=(proc,), daemon=True).start()
            self.root.after(50, self._drain_log_queue)
            self.root.after(500, self._update_timer)
            self.root.after(500, self._watch_process_end)
        except Exception as exc:
            self.status_var.set("Error")
            self._reset_progress_ui()
            messagebox.showerror("Run Error", str(exc))

    def _consume_progress_line(self, line: str) -> bool:
        """Parse scraper __PROGRESS__ lines; return True if line should not appear in the log."""
        m = PROGRESS_LINE_RE.match(line.strip())
        if not m:
            return False
        cur = int(m.group(1))
        total = int(m.group(2))
        max_v = max(total, 1)
        self.progress_bar.configure(maximum=max_v, value=min(cur, max_v))
        self.progress_status_var.set(f"Progress: {cur} / {total}")
        return True

    def _reset_progress_ui(self) -> None:
        self.progress_bar.configure(maximum=100, value=0)
        self.progress_status_var.set("Progress: —")

    def _stream_output(self, proc: subprocess.Popen) -> None:
        assert proc.stdout is not None
        for line in proc.stdout:
            self.log_queue.put(line.rstrip("\n"))

    def _drain_log_queue(self) -> None:
        while True:
            try:
                line = self.log_queue.get_nowait()
            except queue.Empty:
                break
            if self._consume_progress_line(line):
                continue
            self._write_log(line)
        if self.process and self.process.poll() is None:
            self.root.after(100, self._drain_log_queue)

    def _update_timer(self) -> None:
        if self.process_started_at and self.process and self.process.poll() is None:
            elapsed = int(time.time() - self.process_started_at)
            mm, ss = divmod(elapsed, 60)
            self.timer_var.set(f"{mm:02d}:{ss:02d}")
            self.root.after(500, self._update_timer)

    def _watch_process_end(self) -> None:
        if not self.process:
            return
        if self.process.poll() is None:
            self.root.after(500, self._watch_process_end)
            return
        self._drain_log_queue()
        code = self.process.returncode
        self.process = None
        self.process_started_at = None
        self.run_button.state(["!disabled"])
        if code == 0:
            self.status_var.set("Completed")
            messagebox.showinfo("Success", "Scraper finished successfully.")
        else:
            self.status_var.set(f"Failed (exit {code})")
            messagebox.showerror("Scraper Failed", f"Exit code: {code}")

    def _write_log(self, text: str) -> None:
        self.log.insert("end", text + ("\n" if not text.endswith("\n") else ""))
        self.log.see("end")
        self.root.update_idletasks()


def main() -> None:
    root = tk.Tk()
    app = LauncherApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
