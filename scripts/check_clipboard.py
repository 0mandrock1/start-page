"""Headless Edge: Clipboard Radar reads only on click, classifies, copies, and falls back."""
from pathlib import Path
import json
import re
import subprocess
import tempfile

root = Path(__file__).resolve().parent.parent
html = (root / "newtab.html").read_text(encoding="utf-8")
base = root.as_uri() + "/"
setup = """
<script>
window.testRadar = {value: '', fail: false, reads: 0, writes: [], error: null};
Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {
  readText() {
    window.testRadar.reads++;
    return window.testRadar.fail
      ? Promise.reject(Object.assign(new Error('denied'), {name:'NotAllowedError'}))
      : Promise.resolve(window.testRadar.value);
  },
  writeText(value) {
    window.testRadar.writes.push(value);
    return Promise.resolve();
  }
}});
</script>
"""
probe = """
<script>
setTimeout(async () => {
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const tests = {};
  const clipboard = window.testRadar;
  const trigger = $('clipboardRadar');
  const panel = $('clipboardRadarPanel');
  const close = $('clipboardRadarClose');
  const readBeforeClick = clipboard.reads;
  tests.noAutomaticRead = readBeforeClick === 0;
  clipboard.value = '{"b":1,"a":{"x":true}}';
  trigger.click();
  await sleep(35);
  tests.readOnClick = clipboard.reads === 1 && !panel.hidden;
  tests.jsonRecognition = $('clipboardRadarType').textContent.startsWith('JSON');
  $('clipboardRadarCopy').click();
  await sleep(35);
  tests.jsonCopy = clipboard.writes[0] === '{\\n  "b": 1,\\n  "a": {\\n    "x": true\\n  }\\n}'
    && $('clipboardRadarCopy').textContent.includes('скопійовано');
  close.click();
  tests.clearedOnClose = $('clipboardRadarPreview').textContent === '' && panel.hidden;

  clipboard.value = 'https://example.com/path?x=1';
  trigger.click();
  await sleep(35);
  tests.urlRecognition = $('clipboardRadarType').textContent.startsWith('URL')
    && $('clipboardRadarAction').dataset.url === clipboard.value;
  close.click();

  clipboard.value = 'A0A0A0A0-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
  trigger.click();
  await sleep(35);
  tests.uuidRecognition = $('clipboardRadarType').textContent.startsWith('UUID')
    && !$('clipboardRadarAction').hidden;
  close.click();

  clipboard.fail = true;
  trigger.click();
  await sleep(35);
  tests.deniedFallsBack = !$('clipboardRadarPaste').hidden;
  const paste = $('clipboardRadarInput');
  paste.value = 'TypeError: failed to decode\\n at app.js:33';
  paste.dispatchEvent(new Event('input', {bubbles:true}));
  tests.pasteRecognizesError = $('clipboardRadarType').textContent.startsWith('ERROR')
    && $('clipboardRadarPaste').hidden;
  close.click();
  tests.emptyAfterFallback = $('clipboardRadarInput').value === '';

  const pre = document.createElement('pre');
  pre.id = 'radar-test-result';
  pre.textContent = JSON.stringify(tests);
  document.body.append(pre);
}, 500);
</script>
"""
html = html.replace("<head>", f'<head><base href="{base}">')
html = html.replace('<script src="js/clipboard-radar.js"></script>',
                    setup + '<script src="js/clipboard-radar.js"></script>')
html = html.replace("</body>", probe + "</body>")
probe_path = root / "dist" / "check-clipboard.html"
probe_path.parent.mkdir(exist_ok=True)
probe_path.write_text(html, encoding="utf-8")
edge = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
try:
    with tempfile.TemporaryDirectory(prefix="edge-clipboard-radar-") as profile:
        result = subprocess.run([
            edge, "--headless", "--disable-gpu", "--no-first-run",
            "--disable-background-networking", "--host-resolver-rules=MAP * ~NOTFOUND",
            "--user-data-dir=" + profile, "--window-size=1366,768",
            "--virtual-time-budget=2300", "--dump-dom", probe_path.as_uri() + "?focus=page"
        ], capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=45)
    match = re.search(r'<pre id="radar-test-result">(.*?)</pre>', result.stdout)
    if not match:
        raise RuntimeError(f"Edge exit={result.returncode}; result missing")
    checks = json.loads(match.group(1))
    print(json.dumps(checks, ensure_ascii=False), flush=True)
    assert all(checks.values()), "Clipboard regression failed"
finally:
    probe_path.unlink(missing_ok=True)
