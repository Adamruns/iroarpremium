"""Build the Chrome Web Store ZIP from the manifest and packaged grade reports."""
import argparse
import json
import re
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]

def build(output):
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    files = {'manifest.json',manifest['background']['service_worker'],*manifest['icons'].values()}
    for group in manifest['content_scripts']:
        files.update(group.get('css', []))
        files.update(group.get('js', []))
    worker = (ROOT / manifest['background']['service_worker']).read_text()
    listed = set(re.findall(r"'(grade_distributions_final/[^']+\.csv)'", worker))
    bundled = {str(path.relative_to(ROOT)) for path in (ROOT / 'grade_distributions_final').glob('*.csv')}
    # The service worker stops loading all grade history when one listed report is missing.
    if listed != bundled:
        raise SystemExit(f'Grade reports differ from gradeDistributionFiles. Missing: {sorted(listed - bundled)} Unlisted: {sorted(bundled - listed)}')
    files.update(listed)
    output.parent.mkdir(parents=True,exist_ok=True)
    with ZipFile(output, 'w') as archive:
        for name in sorted(files):
            info = ZipInfo(name,date_time=(2024,1,1,0,0,0))
            info.external_attr = 0o100644 << 16
            archive.writestr(info,(ROOT / name).read_bytes(),compress_type=ZIP_DEFLATED)
    with ZipFile(output) as archive:
        assert archive.testzip() is None
    print(f'{output} · {len(files)} files · version {manifest["version"]}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output',type=Path)
    build(parser.parse_args().output)
