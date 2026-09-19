#!/usr/bin/env python3
"""Re-encode the 1K Poly Haven surface JPEGs for transfer size.

The upstream 1K JPEGs are ~1 MB each (near-lossless quality). Base colour and roughness are re-encoded at
quality 82/80; normal maps keep 4:4:4 chroma (no subsampling) at quality 88 so the tangent-space data is not
smeared. Dimensions stay 1024x1024. Refuses to overwrite unless --overwrite is given; previews go to
node_modules/.cache/runway-environment-polish/. Requires Pillow only.

    python3 scripts/shrink-environment-textures.py --overwrite
"""
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'assets' / 'environment'
CACHE = Path(__file__).resolve().parents[1] / 'node_modules' / '.cache' / 'runway-environment-polish'
CACHE.mkdir(parents=True, exist_ok=True)
overwrite = '--overwrite' in sys.argv

SETTINGS = {
    'color': dict(quality=82, subsampling=2, optimize=True, progressive=False),
    'roughness': dict(quality=80, subsampling=2, optimize=True, progressive=False),
    'normal': dict(quality=88, subsampling=0, optimize=True, progressive=False),
}

report = {}
for kind in ('brick', 'concrete'):
    for channel, settings in SETTINGS.items():
        source = ROOT / f'{kind}-{channel}.jpg'
        before = source.read_bytes()
        image = Image.open(source)
        if image.size != (1024, 1024):
            raise SystemExit(f'{source.name}: expected 1024x1024, got {image.size}')
        target = source if overwrite else CACHE / source.name
        image.convert('RGB').save(target, 'JPEG', **settings)
        after = target.read_bytes()
        if len(after) >= len(before):
            raise SystemExit(f'{source.name}: re-encode did not shrink ({len(after)} >= {len(before)})')
        report[source.name] = {
            'before': len(before), 'after': len(after),
            'sha256Before': hashlib.sha256(before).hexdigest(), 'sha256After': hashlib.sha256(after).hexdigest(),
            'quality': settings['quality'], 'chroma': '4:4:4' if settings['subsampling'] == 0 else '4:2:0',
        }
        print(f"{source.name}: {len(before)} -> {len(after)} bytes ({'written' if overwrite else 'preview'})")

(CACHE / 'shrink-textures-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps({'totalBefore': sum(v['before'] for v in report.values()), 'totalAfter': sum(v['after'] for v in report.values())}))
