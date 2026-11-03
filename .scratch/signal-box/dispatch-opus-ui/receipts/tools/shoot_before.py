import sys
from playwright.sync_api import sync_playwright

out, url = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    browser = p.chromium.launch()
    try:
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        pg = ctx.new_page()
        pg.goto(url)
        pg.wait_for_load_state("networkidle")

        def shot(name):
            pg.wait_for_timeout(250)
            pg.screenshot(path=f"{out}/{name}.png")
            pg.screenshot(path=f"{out}/{name}-full.png", full_page=True)

        shot("b0-initial")
        pulls = pg.get_by_role("button", name="PULL (REV)")
        pulls.nth(2).click()
        pulls.nth(0).click()
        shot("b1-north-to-bridge")
        pulls.nth(3).click()
        shot("b2-blocked-ilk01")
        pg.get_by_role("button", name="PRESET: CURSED_MISSING_CROSSOVER_LOCK").click()
        pg.get_by_role("button", name="RUN PBT EXORCIST (fast-check)").click()
        shot("b3-exorcist")
        step = pg.get_by_role("button", name="Step Replay Forward (stepReplayForward)")
        for _ in range(3):
            step.click()
        shot("b4-replay-receipt")
    finally:
        browser.close()
