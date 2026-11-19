"""Збирає dist/mandrock0-start-<version>.zip зі зберіганням прямих слешів у шляхах."""
import json, pathlib, zipfile

root = pathlib.Path(__file__).resolve().parent.parent
version = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))['version']
files = ['manifest.json', 'newtab.html', 'LICENSE']
for d in ('css', 'js', 'icons'):
    files += sorted(p.relative_to(root).as_posix() for p in (root / d).rglob('*') if p.is_file())
dist = root / 'dist'
dist.mkdir(exist_ok=True)
out = dist / f'mandrock0-start-{version}.zip'
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(root / f, f)
print(out)
