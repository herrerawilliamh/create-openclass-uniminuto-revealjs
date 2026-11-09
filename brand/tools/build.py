import pathlib, shutil, json
from marks import *
from text import text_path, cap_height
OUT=pathlib.Path('willedtech-brand'); shutil.rmtree(OUT, ignore_errors=True)
for d in ['logo','products','tokens']: (OUT/d).mkdir(parents=True)
INK='currentColor'
def wrap(w,h,body,label): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" role="img" aria-label="{label}">{body}</svg>\n'
def place(inner,x,y,s): return f'<g transform="translate({x:.1f} {y:.1f}) scale({s/810:.5f})">{inner}</g>'
def txt(s,k,size,x,y,fill=INK,track=0):
    d,w=text_path(s,k,size,x,y,track); return f'<path fill="{fill}" d="{d}"/>', w
def save(rel, svg):
    p=OUT/rel; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(svg)
    neg=svg.replace('currentColor','#FFFFFF')
    p.with_name(p.stem+'-negativo.svg').write_text(neg)
Wi=f'<path fill="{INK}" d="{W}"/>'
LEMA=('Buscando transformar la educación','Explorando tecnologías innovadoras')
M=100; P=8  # tamaño del isotipo y margen
# ── LOGO ───────────────────────────────────────────────
def horizontal(lema=False):
    gap=0.32*M; x=P+M+gap
    if not lema:
        size=0.56*M/0.743; t,w=txt('WillEdTech','head',size,x,P+M*0.83,track=-0.015)
        return wrap(x+w+P, M+2*P, place(Wi,P,P,M)+t, 'WillEdTech')
    size=0.44*M/0.743; t,w=txt('WillEdTech','head',size,x,P+M*0.5,track=-0.015)
    ls=0.15*M; a,w1=txt(LEMA[0],'body',ls,x,P+M*0.74,'currentColor'); b,w2=txt(LEMA[1],'body',ls,x,P+M*0.96)
    return wrap(x+max(w,w1,w2)+P, M+2*P, place(Wi,P,P,M)+t+a+b, 'WillEdTech')
def vertical(lema=False):
    size=0.36*M/0.743
    _,w=text_path('WillEdTech','head',size,track=-0.015)
    ls=0.13*M; lw=[text_path(l,'body',ls)[1] for l in LEMA]
    W_=max(w,M,*(lw if lema else [0]))+2*P; cx=W_/2
    y=P+M+0.28*M+0.36*M
    t,_=txt('WillEdTech','head',size,cx-w/2,y,track=-0.015)
    body=place(Wi,cx-M/2,P,M)+t; H=y+P+0.06*M
    if lema:
        for i,l in enumerate(LEMA):
            y+= 0.26*M if i==0 else 0.19*M
            body+=txt(l,'body',ls,cx-lw[i]/2,y)[0]
        H=y+P+0.04*M
    return wrap(W_,H,body,'WillEdTech')
save('logo/willedtech-isotipo.svg', wrap(810,810,Wi,'WillEdTech'))
save('logo/willedtech-isotipo-badge.svg', wrap(810,810,f'<path fill="{INK}" fill-rule="evenodd" d="M70 0h670a70 70 0 0 1 70 70v670a70 70 0 0 1-70 70H70a70 70 0 0 1-70-70V70A70 70 0 0 1 70 0Z{W}"/>','WillEdTech'))
save('logo/willedtech-horizontal.svg', horizontal())
save('logo/willedtech-horizontal-lema.svg', horizontal(True))
save('logo/willedtech-vertical.svg', vertical())
save('logo/willedtech-vertical-lema.svg', vertical(True))
(OUT/'logo/favicon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 810 810"><style>path{fill:#0C0E15}@media (prefers-color-scheme:dark){path{fill:#FAFAFD}}</style><path d="'+W+'"/></svg>\n')
# ── PRODUCTOS ──────────────────────────────────────────
for slug,p in PRODUCTS.items():
    mk=mark_inner(slug); nm=p['name']
    save(f'products/{slug}/{slug}-marca.svg', wrap(810,810,mk,nm))
    (OUT/f'products/{slug}/{slug}-app.svg').write_text(wrap(1024,1024,f'<rect width="1024" height="1024" rx="88" fill="#121137"/>'+place(mark_inner(slug,'#FFFFFF'),187,187,650),nm))
    # solo: marca + nombre
    gap=0.3*M; x=P+M+gap; size=0.5*M/0.743
    t,w=txt(nm,'head',size,x,P+M*0.62,track=-0.015); s,w2=txt(p['tag'],'body',0.21*M,x,P+M*0.92)
    save(f'products/{slug}/{slug}-solo.svg', wrap(x+max(w,w2)+P, M+2*P, place(mk,P,P,M)+t+s, nm))
    # horizontal endosado: W | marca  nombre / de WillEdTech
    x2=P+M+0.22*M; div=f'<rect x="{x2:.1f}" y="{P+0.08*M:.1f}" width="{0.025*M:.1f}" height="{0.84*M:.1f}" fill="{INK}" opacity=".35"/>'
    x3=x2+0.025*M+0.22*M; x4=x3+M+0.3*M
    t,w=txt(nm,'head',size,x4,P+M*0.62,track=-0.015); s,w2=txt('by WillEdTech','body7',0.22*M,x4,P+M*0.92)
    save(f'products/{slug}/{slug}-horizontal.svg', wrap(x4+max(w,w2)+P, M+2*P, place(Wi,P,P,M)+div+place(mk,x3,P,M)+t+s, f'WillEdTech · {nm}'))
    # vertical endosado: marca, nombre, divisor, W + WillEdTech
    vs=0.36*M/0.743; _,wn=text_path(nm,'head',vs,track=-0.015)
    sw=0.3*M; ws=0.19*M/0.743; _,ww=text_path('WillEdTech','head7',ws)
    Wd=max(wn,M,sw+0.08*M+ww)+2*P; cx=Wd/2
    y=P+M+0.24*M+0.36*M; t,_=txt(nm,'head',vs,cx-wn/2,y,track=-0.015)
    y+=0.18*M; div=f'<rect x="{cx-0.3*M:.1f}" y="{y:.1f}" width="{0.6*M:.1f}" height="{0.02*M:.1f}" fill="{INK}" opacity=".35"/>'
    y+=0.14*M; bx=cx-(sw+0.08*M+ww)/2
    e=place(Wi,bx,y,sw)+txt('WillEdTech','head7',ws,bx+sw+0.08*M,y+sw*0.82)[0]
    save(f'products/{slug}/{slug}-vertical.svg', wrap(Wd,y+sw+P,place(mk,cx-M/2,P,M)+t+div+e, f'{nm} · WillEdTech'))
json.dump({'productos':{s:{k:v for k,v in p.items() if k in('name','letter','color','tag')} for s,p in PRODUCTS.items()}}, open('/tmp/prod.json','w'), ensure_ascii=False, indent=1)
print(sorted(str(p.relative_to(OUT)) for p in OUT.rglob('*.svg')))
