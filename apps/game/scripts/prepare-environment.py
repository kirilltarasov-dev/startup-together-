import argparse
import concurrent.futures
import hashlib
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / 'node_modules/.cache/runway-environment-source'
OUTPUT = ROOT / 'public/assets/environment'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--direct', action='store_true')
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    curl = ['curl', '--fail', '--silent', '--show-error', '--location', '--max-time', '180', '--retry', '2', '--user-agent', 'RUNWAY-asset-preparation/1.0']
    if args.direct:
        curl += ['--noproxy', '*']

    def metadata(asset):
        return json.loads(subprocess.check_output(curl + [f'https://api.polyhaven.com/files/{asset}']))

    jobs = []
    for kind, asset in [('brick', 'brick_wall_02'), ('concrete', 'concrete_pavement')]:
        data = metadata(asset)
        for channel, key in [('color', 'Diffuse'), ('normal', 'nor_gl'), ('roughness', 'Rough')]:
            source = data[key]['1k']['jpg']
            jobs.append((OUTPUT / f'{kind}-{channel}.jpg', source, asset))
    hdr = metadata('urban_courtyard')['hdri']['1k']['hdr']
    jobs.append((OUTPUT / 'courtyard.hdr', hdr, 'urban_courtyard'))
    tree = metadata('tree_small_02')['blend']['1k']['blend']
    jobs.append((CACHE / 'tree.blend', tree, 'tree_small_02'))
    for name, source in tree['include'].items():
        path = CACHE / name
        if not path.resolve().is_relative_to(CACHE.resolve()):
            raise ValueError('Asset path escapes source directory')
        jobs.append((path, source, 'tree_small_02'))

    def download(job):
        path, source, asset = job
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            if hashlib.md5(path.read_bytes()).hexdigest() != source['md5'].zfill(32):
                raise ValueError(f'Refusing to overwrite unexpected file: {path}')
        else:
            subprocess.run(curl + [source['url'], '--output', str(path)], check=True)
        content = path.read_bytes()
        if hashlib.md5(content).hexdigest() != source['md5'].zfill(32):
            raise ValueError(f'Checksum mismatch: {path}')
        print(f'{path.name}: {len(content)} bytes', flush=True)
        return {'file': str(path.relative_to(ROOT)), 'asset': asset, 'source': source['url'], 'license': 'CC0-1.0', 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()}

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        records = list(pool.map(download, jobs))
    manifest = OUTPUT / 'sources.json'
    manifest.write_text(json.dumps({'provider': 'Poly Haven', 'license': 'https://polyhaven.com/license', 'files': records}, indent=2) + '\n')


if __name__ == '__main__':
    main()
