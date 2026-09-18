from pathlib import Path
import json
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
ITEMS = ROOT / 'data' / 'items'
OUTPUT = ITEMS / 'index.js'

def snapshot():
    return tuple((path.name, path.stat().st_mtime_ns, path.stat().st_size) for path in sorted(ITEMS.glob('*.json')))


def build():
    catalog = []
    for path in sorted(ITEMS.glob('*.json'), key=lambda item: item.name.lower()):
        raw = path.read_text(encoding='utf-8').strip()
        if not raw:
            print(f'Ignorado: {path.name} está vazio')
            continue
        try:
            item = json.loads(raw)
        except json.JSONDecodeError as error:
            print(f'Erro em {path.name}: {error}')
            continue
        item.setdefault('slug', path.stem.lower().replace(' ', '-'))
        catalog.append({
            'file': path.name,
            **{key: item.get(key) for key in (
                'slug', 'Title', 'aliases', 'Description', 'Category', 'Image', 'Logo', 'Banner'
            )}
        })
    OUTPUT.write_text(
        'window.ESSENTIALS_ITEMS = ' + json.dumps(catalog, ensure_ascii=False, indent=2) + ';\n',
        encoding='utf-8'
    )
    print(f'Índice atualizado: {OUTPUT} ({len(catalog)} itens)')


build()
if '--watch' in sys.argv:
    print('Observando data/items/. Pressione Ctrl+C para parar.')
    previous = snapshot()
    try:
        while True:
            time.sleep(1)
            current = snapshot()
            if current != previous:
                build()
                previous = current
    except KeyboardInterrupt:
        print('\nObservador encerrado.')