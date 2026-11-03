"""Drive the redesigned Signal Box through the four demo states and screenshot each one."""
import re
import sys
from playwright.sync_api import sync_playwright

out, url = sys.argv[1], sys.argv[2]
sizes = [(int(w), int(h)) for w, h in (s.split("x") for s in sys.argv[3].split(","))] if len(sys.argv) > 3 else [(1920, 1080)]

with sync_playwright() as p:
    browser = p.chromium.launch()
    try:
        for w, h in sizes:
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
            pg = ctx.new_page()
            errors = []
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            pg.goto(url)
            pg.wait_for_load_state("networkidle")
            pg.evaluate("document.fonts.ready.then(() => true)")

            def lever(n):
                return pg.get_by_role("button", name=re.compile(rf"^Lever {n},"))

            def shot(name, settle=1400, keep_hover=False):
                if not keep_hover:
                    pg.mouse.move(3, 3)
                pg.wait_for_timeout(settle)
                pg.screenshot(path=f"{out}/{w}x{h}-{name}.png")

            shot("00-initial", 600)
            lever(3).click()
            lever(1).click()
            shot("01-lever-frame-interlock", 1600)
            lever(4).click()
            shot("02-ears-tappet-block", 1900, keep_hover=True)
            pg.get_by_role("radio", name="CURSED_MISSING_CROSSOVER_LOCK").click()
            pg.get_by_role("button", name="Run PBT Exorcist").click()
            shot("03-pbt-exorcist-shrinking", 1500)
            step = pg.get_by_role("button", name="Step Replay Forward")
            for _ in range(3):
                step.click()
                pg.wait_for_timeout(700)
            shot("04-trial-receipt-verified", 1700)
            doc_h = pg.evaluate("document.documentElement.scrollHeight")
            print(f"{w}x{h}: scrollHeight={doc_h} errors={errors}")
            ctx.close()
    finally:
        browser.close()
