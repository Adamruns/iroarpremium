"""Build the Chrome Web Store ZIP from the manifest and packaged grade reports."""
import argparse
import json
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]

def build(output):
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    files = {'manifest.json',manifest['background']['service_worker'],*manifest['icons'].values()}
    for group in manifest['content_scripts']:
        files.update(group.get('css', []))
        files.update(group.get('js', []))
    files.update(str(path.relative_to(ROOT)) for path in (ROOT / 'grade_distributions_final').glob('*.csv'))
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
