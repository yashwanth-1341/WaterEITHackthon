"""Render every prototype view via file:// in headless Chromium, save screenshots
to docs/, and fail on any console error / page error / failed request.

    pip install playwright   (then: python -m playwright install chromium, if no browser is present)
    python scripts/screenshots.py
"""
from __future__ import annotations

import glob
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
URL = (ROOT / "prototype" / "index.html").as_uri()
DOCS = ROOT / "docs"
DOCS.mkdir(exist_ok=True)


def chromium_path() -> str | None:
    hits = sorted(glob.glob("/opt/pw-browsers/chromium-*/chrome-linux/chrome"))
    return hits[-1] if hits else None


def main() -> int:
    problems: list[str] = []
    with sync_playwright() as p:
        exe = chromium_path()
        browser = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
        page = browser.new_page(viewport={"width": 1600, "height": 1000}, device_scale_factor=1)
        page.on("console", lambda m: problems.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        page.on("pageerror", lambda e: problems.append(f"pageerror: {e}"))
        page.on("requestfailed", lambda r: problems.append(f"requestfailed: {r.url}"))

        def shot(name: str, full: bool = True) -> None:
            page.wait_for_timeout(400)
            page.screenshot(path=str(DOCS / name), full_page=full)
            print("saved", name)

        page.goto(URL)
        page.wait_for_timeout(800)
        shot("01-explorer.png")
        page.click("#sizeSeg button[data-k=W]")
        page.click("#cmpTable tbody tr[data-id='MWP-SE-0009']")
        shot("01b-explorer-withdrawal-view.png", full=False)

        page.click("#tabs button[data-view=hotspots]")
        shot("02-hotspots.png")

        page.click("#tabs button[data-view=supply]")
        shot("03-supply-chain-lithium.png")
        page.click("#supCom button[data-c=Cu]")
        page.select_option("#supSite", "MWP-PE-0005")
        shot("03b-supply-chain-copper.png")

        page.click("#tabs button[data-view=card]")
        page.select_option("#cardSite", "MWP-SE-0009")
        shot("04-report-card-A.png")
        page.select_option("#cardSite", "MWP-CD-0015")
        shot("04b-report-card-E.png")
        page.select_option("#cardSite", "MWP-PE-0005")
        page.wait_for_timeout(300)
        page.emulate_media(media="print")
        page.pdf(path=str(DOCS / "report-card-example.pdf"), format="A4", print_background=True, scale=0.62,
                 margin={"top": "10mm", "bottom": "10mm", "left": "8mm", "right": "8mm"})
        print("saved report-card-example.pdf")
        page.emulate_media(media="screen")

        page.click("#tabs button[data-view=entry]")
        shot("05-entry-form-tier2.png")
        page.click("#fBlank")
        page.fill("[data-path='/site/site_id']", "MWP-XX-12")
        page.fill("[data-path='/water/withdrawals/0/volume_ml']", "1200")
        shot("05b-entry-form-blank-validation.png", full=False)

        page.click("#tabs button[data-view=extract]")
        shot("06-extractor-sample1.png")
        page.click("#samples button[data-i='2']")
        shot("06b-extractor-sample3-ambiguous.png")
        page.click("#samples button[data-i='1']")
        page.click("#exSend")
        shot("06c-extractor-to-form.png", full=False)

        page.click("#tabs button[data-view=framework]")
        shot("07-framework-crosswalk.png")
        browser.close()

    if problems:
        print("\nPROBLEMS:")
        for x in problems:
            print("  ", x)
        return 1
    print("\nOK - all views rendered, zero console errors/warnings, zero failed requests")
    return 0


if __name__ == "__main__":
    sys.exit(main())
