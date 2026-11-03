"""Exercise hover, keyboard focus, digit shortcuts, MCP keys, reduced motion and a phone viewport."""
import re
import sys
from playwright.sync_api import sync_playwright

out, url = sys.argv[1], sys.argv[2]
report = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    try:
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080})
        pg = ctx.new_page()
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: errors.append(m.text) if m.type in ("error", "warning") else None)
        pg.goto(url)
        pg.wait_for_load_state("networkidle")
        lever = lambda n: pg.get_by_role("button", name=re.compile(rf"^Lever {n},"))

        # hover hint on a locked lever
        lever(4).hover()
        pg.wait_for_timeout(400)
        box = lever(4).bounding_box()
        pg.screenshot(path=f"{out}/hover-lever4.png", clip={"x": box["x"] - 60, "y": box["y"] - 10, "width": box["width"] + 120, "height": 520})
        report.append(f"hover hint opacity: {pg.locator('.lf-lever').nth(3).locator('.lf-hint').evaluate('e => getComputedStyle(e).opacity')}")

        # keyboard: tab into the levers and check the focus ring shows
        pg.mouse.move(3, 3)
        lever(1).focus()
        pg.keyboard.press("Tab")
        focused = pg.evaluate("document.activeElement.getAttribute('aria-label')")
        report.append(f"after Tab from lever 1, focus on: {focused[:40]}")
        # the ring fades in over 160 ms; read it after the transition, not mid-fade
        pg.wait_for_timeout(450)
        ring = pg.locator('.lf-lever').nth(1).locator('.lf-ring').evaluate('e => getComputedStyle(e).opacity')
        report.append(f"focus ring opacity on lever 2: {ring}")
        box2 = lever(2).bounding_box()
        pg.screenshot(path=f"{out}/focus-lever2.png", clip={"x": box2["x"] - 30, "y": box2["y"] - 10, "width": box2["width"] + 60, "height": 470})
        pg.keyboard.press("Enter")
        pg.wait_for_timeout(300)
        report.append(f"Enter on lever 2 -> aria-pressed={lever(2).get_attribute('aria-pressed')}")
        pg.keyboard.press("Enter")
        pg.wait_for_timeout(300)

        # digit shortcuts 3 then 1
        pg.keyboard.press("3")
        pg.keyboard.press("1")
        pg.wait_for_timeout(900)
        report.append(f"digits 3,1 -> lever3={lever(3).get_attribute('aria-pressed')} lever1={lever(1).get_attribute('aria-pressed')}")
        report.append("register: " + pg.locator(".reg-headline").inner_text())

        # MCP: Migrator asks for the bridge while Builder holds it -> refused
        pg.get_by_role("button", name="Migrator: MCP request_route SOUTH_TO_BRIDGE").click()
        pg.wait_for_timeout(700)
        report.append("MCP refused register: " + pg.locator(".reg-headline").inner_text() + " | " + pg.locator(".reg-sub").inner_text()[:120])
        # release Builder, then Migrator is granted (levers move in sequence)
        pg.get_by_role("button", name="Builder: MCP release_route NORTH_TO_BRIDGE").click()
        pg.wait_for_timeout(500)
        pg.get_by_role("button", name="Migrator: MCP request_route SOUTH_TO_BRIDGE").click()
        pg.wait_for_timeout(1500)
        report.append("MCP granted register: " + pg.locator(".reg-headline").inner_text() + " | " + pg.locator(".reg-sub").inner_text()[:160])
        pg.mouse.move(3, 3)
        pg.screenshot(path=f"{out}/mcp-migrator-granted.png")

        # mute toggle must not re-jerk or change the register
        before = pg.locator(".reg-headline").inner_text()
        pg.get_by_role("button", name=re.compile("Sound")).click()
        report.append(f"mute -> aria-pressed={pg.get_by_role('button', name=re.compile('Sound')).get_attribute('aria-pressed')} register unchanged={before == pg.locator('.reg-headline').inner_text()}")
        report.append(f"console errors/warnings: {errors}")
        ctx.close()

        # reduced motion + phone
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, reduced_motion="reduce")
        pg = ctx.new_page()
        pg.goto(url)
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(300)
        pg.screenshot(path=f"{out}/phone-390.png", full_page=True)
        dur = pg.locator(".lf-arm").first.evaluate("e => getComputedStyle(e).transitionDuration")
        report.append(f"reduced-motion lever transition-duration: {dur}")
        report.append(f"phone scrollWidth={pg.evaluate('document.documentElement.scrollWidth')} (viewport 390)")
        ctx.close()
    finally:
        browser.close()
print("\n".join(report))
