import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'node_modules/.cache/runway-realism-source'
OUTPUT = ROOT / 'public/assets/realism'
ASSETS = ['modular_factory_facade', 'SchoolChair_01', 'wooden_table_02']
parser = argparse.ArgumentParser()
parser.add_argument('--direct', action='store_true')
args = parser.parse_args()
CACHE.mkdir(parents=True, exist_ok=True)
OUTPUT.mkdir(parents=True, exist_ok=True)
curl = ['curl', '--fail', '--silent', '--show-error', '--location', '--max-time', '180', '--retry', '2', '--user-agent', 'RUNWAY-asset-preparation/1.0']
if args.direct:
    curl += ['--noproxy', '*']
jobs = []
for asset in ASSETS:
    metadata = json.loads(subprocess.check_output(curl + [f'https://api.polyhaven.com/files/{asset}']))
    source = metadata['gltf']['1k']['gltf']
    package = [(asset + '.gltf', source), *source.get('include', {}).items()]
    total = sum(item['size'] for _, item in package)
    if total > 64_000_000:
        raise ValueError(f'Source package exceeds download budget: {asset}: {total}')
    print(f'{asset}: {len(package)} source files, {total} bytes', flush=True)
    folder = CACHE / asset
    for name, item in package:
        path = folder / name
        if not path.resolve().is_relative_to(folder.resolve()):
            raise ValueError('Unsafe source path')
        jobs.append((asset, path, item))


def download(job):
    asset, path, source = job
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        subprocess.run(curl + [source['url'], '--output', str(path)], check=True)
    data = path.read_bytes()
    if hashlib.md5(data).hexdigest() != source['md5'].zfill(32):
        raise ValueError(f'Checksum mismatch; refusing unexpected source: {path}')
    print(f'Verified {path.name}: {len(data)} bytes', flush=True)
    return {'asset': asset, 'source': source['url'], 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    records = list(pool.map(download, jobs))
(OUTPUT / 'sources.json').write_text(json.dumps({'provider': 'Poly Haven', 'license': 'CC0-1.0', 'licenseUrl': 'https://polyhaven.com/license', 'files': records}, indent=2) + '\n')
