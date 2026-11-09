import pathlib, json
B=pathlib.Path('willedtech-brand'); prod=json.load(open('/tmp/prod.json'))['productos']
def il(rel, cls):
    s=(B/rel).read_text().strip().replace(' xmlns="http://www.w3.org/2000/svg"','')
    return s.replace('<svg', f'<svg class="{cls}"', 1)
def card(title, body, dark=False, sub=''):
    return f'''<section class="{'dark ' if dark else ''}rounded-asym bg-canvas p-8 ring-1 ring-line shadow-asym-sm">
<h2 class="font-heading text-sm font-bold uppercase tracking-[0.14em] text-ink-faint">{title}</h2>{f'<p class="mt-2 max-w-3xl font-body text-sm text-ink-soft">{sub}</p>' if sub else ''}<div class="mt-6">{body}</div></section>'''
logo = '<div class="flex flex-wrap items-center gap-x-14 gap-y-10 text-ink">' + il('logo/willedtech-horizontal.svg','h-14 w-auto') + il('logo/willedtech-horizontal-lema.svg','h-16 w-auto') + il('logo/willedtech-vertical.svg','h-36 w-auto') + il('logo/willedtech-vertical-lema.svg','h-40 w-auto') + '</div>'
iso = '<div class="flex flex-wrap items-end gap-10 text-ink">' + il('logo/willedtech-isotipo.svg','h-28 w-28') + il('logo/willedtech-isotipo-badge.svg','h-28 w-28') + il('logo/willedtech-isotipo-badge.svg','h-28 w-28 text-violet-500') + ''.join(il('logo/willedtech-isotipo.svg',f'h-{n} w-{n}') for n in (12,8,6,4)) + '</div>'
fam = '<div class="grid grid-cols-2 gap-8 text-ink md:grid-cols-4">' + ''.join(f'<figure class="flex flex-col items-center gap-3">{il(f"products/{s}/{s}-marca.svg","h-28 w-28")}<figcaption class="text-center"><span class="block font-heading font-extrabold">{p["name"]}</span><span class="font-mono text-xs text-ink-faint">{p["letter"]} · {p["color"]}</span></figcaption></figure>' for s,p in prod.items()) + '</div>'
hz = '<div class="grid gap-8 text-ink md:grid-cols-2">' + ''.join(il(f'products/{s}/{s}-horizontal.svg','h-14 w-auto') for s in prod) + '</div>'
vt = '<div class="flex flex-wrap justify-around gap-10 text-ink">' + ''.join(il(f'products/{s}/{s}-vertical.svg','h-44 w-auto') for s in prod) + '</div>'
solo = '<div class="grid gap-8 text-ink md:grid-cols-2">' + ''.join(il(f'products/{s}/{s}-solo.svg','h-12 w-auto') for s in prod) + '</div>'
app = '<div class="flex flex-wrap items-end gap-6">' + ''.join(il(f'products/{s}/{s}-app.svg','h-24 w-24') for s in prod) + ''.join(il(f'products/{s}/{s}-app.svg','h-8 w-8') for s in prod) + '</div>'
dark = '<div class="flex flex-col gap-10 text-ink">' + il('logo/willedtech-horizontal-lema.svg','h-16 w-auto') + '<div class="grid gap-8 md:grid-cols-2">' + ''.join(il(f'products/{s}/{s}-horizontal.svg','h-14 w-auto') for s in prod) + '</div></div>'
recipe = '''<ol class="grid gap-4 font-body text-sm text-ink md:grid-cols-4">''' + ''.join(f'<li class="rounded-asym-sm bg-surface p-4 ring-1 ring-line"><span class="marker bg-violet-500 font-heading font-extrabold text-white">{i}</span><p class="mt-3">{t}</p></li>' for i,t in enumerate([
 'Parte del bloque base: corte a 20,3° y radio 70 abajo.',
 'Vacía la inicial solo con rectángulos. Fustes de 235 y base en y = 585.',
 'Sin diagonales internas: son exclusivas de la W.',
 'Un círculo de r = 88 en el color del producto, en el vacío mayor.'],1)) + '</ol>'
body = f'''<main class="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
<header class="flex flex-wrap items-end justify-between gap-6">
  <div><span class="marker bg-violet-500 font-heading text-sm font-bold text-white">Sistema de marca v3</span>
  <h1 class="mt-3 font-heading text-5xl font-extrabold tracking-tight text-ink">WillEdTech</h1>
  <p class="mt-2 max-w-xl font-body text-ink-soft">Isotipo, logos y sub-marcas de producto. Todos los productos se dibujan con la misma construcción de la W. La guía completa está en BRAND.md.</p></div>
  {il('logo/willedtech-isotipo.svg','h-24 w-24 text-ink')}
</header>
{card('Logo con nombre', logo, sub='Horizontal y vertical, con y sin lema. Los textos están convertidos a trazos y cada archivo tiene su versión negativa.')}
{card('Isotipo', iso, sub='Positivo, badge y badge en violeta. Tamaños de 48 a 16 px.')}
{card('Familia de producto · monogramas', fam, sub='Cada producto es una letra construida como la W, más un único punto de color.')}
{card('Receta para un producto nuevo', recipe)}
{card('Lockup horizontal', hz)}
{card('Lockup vertical', vt)}
{card('Monograma con nombre', solo)}
{card('Modo oscuro', dark, dark=True)}
{card('Icono de app y favicon', app)}
</main>'''
pathlib.Path('/tmp/body.html').write_text(body)
css=pathlib.Path('/tmp/out.css').read_text() if pathlib.Path('/tmp/out.css').exists() else ''
html=f'''<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>WillEdTech · Sistema de marca</title>
<link rel="icon" href="logo/favicon.svg">
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Merriweather+Sans:wght@400;700;800&display=swap" rel="stylesheet"><style>{css}</style></head>
<body class="bg-surface-sunken bg-mesh font-body antialiased">{body}</body></html>'''
(B/'index.html').write_text(html)
