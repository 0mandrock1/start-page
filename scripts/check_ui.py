"""Headless Edge regression checks for start-page layout, accent and shortcuts."""
import json
import pathlib
import re
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parent.parent
edge = pathlib.Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
source = (root / "newtab.html").read_text(encoding="utf-8")
base = root.as_uri() + "/"
probe = """
<script>
setTimeout(() => {
  const accent = document.getElementById('accent');
  const hero = document.querySelector('.hero');
  const label = document.querySelector('.label');
  const quickLink = document.querySelector('.quick-link');
  const initial = {
    label: getComputedStyle(label).borderLeftColor,
    quickLink: getComputedStyle(quickLink).borderBottomColor,
  };
  document.activeElement.blur();
  document.body.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'й', code: 'KeyQ', bubbles: true
  }));
  const qFocus = document.activeElement.id === 'q-tools';
  document.activeElement.blur();
  document.body.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'р', code: 'KeyH', bubbles: true
  }));
  const hInactive = document.activeElement.id !== 'q-tools';
  const fullWidth = Math.abs(accent.getBoundingClientRect().width
    - hero.getBoundingClientRect().width) < 1;
  const clock = document.getElementById('hm');
  const variants = ['shear', 'prism', 'scan', 'phase', 'static'];
  const selected = clock.dataset.clockGlitch;
  const animationNames = variants.map(name => {
    clock.dataset.clockGlitch = name;
    return getComputedStyle(clock, '::before').animationName;
  });
  clock.dataset.clockGlitch = selected;
  const weekday = document.getElementById('dateWeekday');
  const dateFull = document.getElementById('dateFull');
  const dateTwoLines = dateFull.getBoundingClientRect().top > weekday.getBoundingClientRect().top;
  const dateFits = [weekday, dateFull].every(el => el.scrollWidth <= el.clientWidth);
  const coloredClock = getComputedStyle(clock).color !== getComputedStyle(hero).color;
  const hourWarp = document.getElementById('hourWarp');
  const progress = parseFloat(document.getElementById('hourWarpFill').style.width);
  const timeWarpWorks = progress >= 0 && progress < 100
    && Number(hourWarp.getAttribute('aria-valuenow')) === new Date().getMinutes();
  const originalGlitch = clock.dataset.clockGlitch;
  document.getElementById('clockTrigger').dispatchEvent(new MouseEvent('click', {detail: 1, bubbles: true}));
  const cycleWorks = clock.dataset.clockGlitch !== originalGlitch;
  const previousAccent = document.documentElement.dataset.accent;
  const previousGlitch = clock.dataset.clockGlitch;
  document.getElementById('clockTrigger').dispatchEvent(new MouseEvent('dblclick', {detail: 2, bubbles: true}));
  const jackpotWorks = clock.dataset.clockGlitch !== previousGlitch
    && document.documentElement.dataset.accent !== previousAccent;
  // Restore the previous accent so the baseline accent button check remains deterministic.
  document.documentElement.dataset.accent = 'crimson';
  document.getElementById('accentName').textContent = 'crimson';
  accent.click();
  const result = {
    qFocus, hInactive, fullWidth, selected,
    fiveGlitches: variants.includes(selected)
      && new Set(animationNames).size === 5
      && animationNames.every(name => name !== 'none'),
    dateTwoLines, dateFits, coloredClock, timeWarpWorks, cycleWorks, jackpotWorks,
    accentChanged: document.documentElement.dataset.accent === 'purple',
    labelChanged: getComputedStyle(label).borderLeftColor !== initial.label,
    quickLinkChanged: getComputedStyle(quickLink).borderBottomColor !== initial.quickLink,
    clickGlitch: getComputedStyle(accent, '::before').animationName === 'accent-shear',
    fits1080: document.documentElement.scrollHeight <= 1080,
  };
  const out = document.createElement('pre');
  out.id = 'test-result';
  out.textContent = JSON.stringify(result);
  document.body.append(out);
}, 650);
</script>
"""
test_html = root / "dist" / "check-ui.html"
test_html.parent.mkdir(exist_ok=True)
test_html.write_text(source.replace("<head>", f'<head><base href="{base}">')
                     .replace("</body>", probe + "</body>"), encoding="utf-8")
try:
    for width, height in [(1920, 1080), (1366, 768)]:
        with tempfile.TemporaryDirectory(prefix="edge-start-ui-") as profile:
            run = subprocess.run([
                str(edge), "--headless", "--disable-gpu",
                "--no-first-run", "--disable-background-networking",
                "--host-resolver-rules=MAP * ~NOTFOUND",
                "--user-data-dir=" + profile,
                f"--window-size={width},{height}", "--virtual-time-budget=1900",
                "--dump-dom", test_html.as_uri(),
            ], capture_output=True, text=True, encoding="utf-8",
                errors="replace", timeout=45)
        match = re.search(r'<pre id="test-result">(.*?)</pre>', run.stdout)
        if not match:
            raise RuntimeError(f"Edge exit={run.returncode}; no test result at {width}x{height}")
        data = json.loads(match.group(1))
        required = ["qFocus", "hInactive", "fullWidth", "accentChanged",
                    "labelChanged", "quickLinkChanged", "clickGlitch",
                    "fiveGlitches", "dateTwoLines", "dateFits", "coloredClock",
                    "timeWarpWorks", "cycleWorks", "jackpotWorks"]
        if height == 1080:
            required.append("fits1080")
        print(f"{width}x{height}: {data}", flush=True)
        assert all(data[key] for key in required), f"Failed: {data}"
finally:
    test_html.unlink(missing_ok=True)
