#!/usr/bin/env python3
"""Headless-browser viewer for the router admin panel (WrtWeb / gl-ui / LuCI).

Opens the router in a real browser engine, lets the SPA render, and prints what the
browser actually shows: URL, title, visible text, links, and the API calls with
their responses. A PNG is saved next to the text dump so a human can look at it too.

    python3 tools/browser_view.py [PAGE] [--login user:pass] [--shot] [--wait 20]

Examples
    python3 tools/browser_view.py --base http://<router-ip>                     # SPA root
    python3 tools/browser_view.py "#/clients" --base http://<router-ip>         # SPA route
    python3 tools/browser_view.py "admin/status/overview" --base http://<router-ip>   # LuCI page

The router address comes from --base or $WRTWEB_BASE; nothing about your network,
and no password, is stored in this file. Pass the password on the command line, or
through $WRTWEB_PASS. The text/screenshot dumps contain session ids, MACs and client
names, so they are written outside the repo (~/Downloads/wrtview) and never committed.
Self-signed certs on the router are accepted.
"""
import argparse
import json
import os
import pathlib
import sys
import time
from urllib.parse import urljoin, urlparse

from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service

BASE_DEFAULT = os.environ.get("WRTWEB_BASE", "http://192.168.100.1")
OUT_DEFAULT = os.environ.get("WRTWEB_OUT", str(pathlib.Path.home() / "Downloads" / "wrtview"))
def firefox_binary() -> str:
    """Prefer an override, then the snap bundle (which ships geckodriver), then PATH."""
    for cand in (
        os.environ.get("WRTWEB_FIREFOX"),
        "/snap/firefox/current/usr/lib/firefox/firefox",
        "/usr/bin/firefox",
        "firefox",
    ):
        if cand and (os.path.exists(cand) or cand in ("firefox",)):
            return cand
    return "firefox"


def geckodriver_binary() -> str:
    for cand in (
        os.environ.get("WRTWEB_GECKODRIVER"),
        "/snap/firefox/current/usr/lib/firefox/geckodriver",
        "geckodriver",
    ):
        if cand and (os.path.exists(cand) or cand == "geckodriver"):
            return cand
    return "geckodriver"

CALLS_JS = """
window.__calls = [];
const X = window.XMLHttpRequest.prototype.open, S = window.XMLHttpRequest.prototype.send;
window.XMLHttpRequest.prototype.open = function (m, u) { this.__u = u; return X.apply(this, arguments); };
window.XMLHttpRequest.prototype.send = function (b) {
    this.__b = b;
    this.addEventListener('load', () => window.__calls.push(
        { url: String(this.__u), body: String(b || ''), resp: String(this.responseText).slice(0, 400) }));
    return S.apply(this, arguments);
};
const F = window.fetch;
window.fetch = async (u, o) => {
    const r = await F(u, o);
    const txt = await r.text();
    window.__calls.push({ url: String(u), body: String((o && o.body) || ''), resp: txt.slice(0, 400) });
    return new Response(txt, { status: r.status, headers: r.headers });
};
"""


def slug(url: str) -> str:
    p = urlparse(url)
    return (p.path.strip("/") or "root").replace("/", "_") or "root"


def poll(driver, seconds: int, test) -> bool:
    end = time.time() + seconds
    while time.time() < end:
        try:
            if test(driver):
                return True
        except Exception:
            pass
        time.sleep(1)
    return False


def login_spa(driver, user: str, password: str) -> str:
    """gl-ui login: the form only exists after Vue boots, and the value has to be set
    with real key events for the model to accept it."""
    if not poll(driver, 20, lambda d: d.execute_script("return document.querySelectorAll('input').length") > 0):
        return "no SPA login form appeared"
    inp = driver.find_element("css selector", "input[type='password']")
    inp.send_keys(password)
    driver.find_element("css selector", "button").click()
    ok = poll(driver, 25, lambda d: "/login" not in d.current_url)
    return f"login {'ok' if ok else 'failed'}: {driver.current_url}"


def login_luci(driver, user: str, password: str) -> str:
    """LuCI login form (server rendered)."""
    if not poll(driver, 15, lambda d: d.execute_script("return document.querySelector('form') !== null")):
        return "no LuCI form appeared"
    driver.find_element("css selector", "input[name='luci_username']").send_keys(user)
    driver.find_element("css selector", "input[type='password']").send_keys(password)
    driver.execute_script("document.querySelector('button').click()")   # bypass the modal overlay
    ok = poll(driver, 20, lambda d: ";stok=" in d.current_url or "Authorization Required" not in d.page_source)
    return f"login {'ok' if ok else 'failed'}: {driver.current_url}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("page", nargs="?", default="", help="full URL, SPA hash route, or LuCI path")
    ap.add_argument("--base", default=BASE_DEFAULT)
    ap.add_argument("--login", help="user:password (or set WRTWEB_USER / WRTWEB_PASS)")
    ap.add_argument("--out", default=OUT_DEFAULT)
    ap.add_argument("--wait", type=int, default=20, help="seconds to let the SPA render")
    ap.add_argument("--shot", action="store_true")
    ap.add_argument("--dump-html", action="store_true")
    args = ap.parse_args()

    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    opts = Options()
    opts.add_argument("--headless")
    opts.binary_location = firefox_binary()
    opts.set_capability("acceptInsecureCerts", True)
    driver = webdriver.Firefox(service=Service(executable_path=geckodriver_binary()), options=opts)

    try:
        if args.page.startswith("http"):
            target = args.page
        elif args.page.startswith("#"):
            target = args.base + "/wrtweb/" + args.page
        elif args.page == "":
            target = args.base + "/wrtweb/"
        else:
            target = urljoin(args.base + "/cgi-bin/luci/", args.page)

        driver.get(args.base + "/wrtweb/") if "#" in target else driver.get(target)
        driver.execute_script(CALLS_JS)

        note = ""
        creds = args.login
        if not creds and os.environ.get("WRTWEB_USER") and os.environ.get("WRTWEB_PASS"):
            creds = f"{os.environ['WRTWEB_USER']}:{os.environ['WRTWEB_PASS']}"
        if creds:
            user, _, password = creds.partition(":")
            note = login_luci(driver, user, password) if "/cgi-bin/luci" in target else login_spa(driver, user, password)

        if "#" in target and "#/login" not in target:
            route = target.split("#", 1)[1]
            # Re-enter the route after the hook is installed, so the API calls are captured.
            driver.execute_script("location.hash = arguments[0]", route)
            poll(driver, args.wait, lambda d: d.execute_script("return (window.__calls || []).length") > 0)

        poll(driver, args.wait, lambda d: bool((d.find_element("css selector", "body").text or "").strip()))

        body = driver.find_element("css selector", "body").text or ""
        links = [e.get_attribute("href") for e in driver.find_elements("css selector", "a[href]")]
        calls = driver.execute_script("return window.__calls") or []

        name = slug(driver.current_url)
        report = "\n".join(
            [
                f"URL:    {driver.current_url}",
                f"TITLE:  {driver.title}",
                f"LOGIN:  {note}" if note else "",
                "",
                "--- visible text ---",
                body.strip(),
                "",
                "--- links ---",
                "\n".join(links[:60]),
                "",
                "--- API calls ---",
                json.dumps(calls[:25], ensure_ascii=False, indent=1),
            ]
        )
        (out / f"{name}.txt").write_text(report)
        print(report)

        if args.dump_html:
            (out / f"{name}.html").write_text(driver.page_source)
        if args.shot:
            shot = out / f"{name}.png"
            driver.save_screenshot(str(shot))
            print(f"\nscreenshot: {shot}")
    finally:
        driver.quit()
    return 0


if __name__ == "__main__":
    sys.exit(main())
