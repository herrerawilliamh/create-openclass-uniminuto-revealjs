import math, re
from shapely.geometry import Polygon, box, Point
T = math.tan(math.radians(20.3)); R = 70
cut = lambda x: 448 - T*x
MASS = Polygon([(0,cut(0)), (810,cut(810)), (810,810), (0,810)])
W = 'M0 448 94 413 225 725V365l265-97 140 321V215l180-67v592a70 70 0 0 1-70 70H536L405 497v313H70a70 70 0 0 1-70-70Z'
def path(g, corners=((0,810),(810,810))):
    polys=[g] if g.geom_type=='Polygon' else list(g.geoms); out=[]
    for p in polys:
        for ring in [p.exterior,*p.interiors]:
            c=[(round(x),round(y)) for x,y in list(ring.coords)[:-1]]; segs=[]
            for i,v in enumerate(c):
                if v in corners:
                    p_,n=c[i-1],c[(i+1)%len(c)]
                    u=lambda a,b:((a[0]-b[0])/math.dist(a,b),(a[1]-b[1])/math.dist(a,b))
                    a=[v[k]+u(p_,v)[k]*R for k in (0,1)]; b=[v[k]+u(n,v)[k]*R for k in (0,1)]
                    z=(v[0]-p_[0])*(n[1]-v[1])-(v[1]-p_[1])*(n[0]-v[0])
                    segs.append(f'{a[0]:.0f} {a[1]:.0f}A{R} {R} 0 0 {1 if z>0 else 0} {b[0]:.0f} {b[1]:.0f}L')
                else: segs.append(f'{v[0]} {v[1]}')
            d='M'+' '.join(segs)+'Z'
            out.append(re.sub(r'L ', 'L', d).replace('LZ','Z'))
    return ''.join(out)
S1, S2 = 235, 575            # anchos de fuste, como la W (≈225 y 180)
B = 585                      # línea donde nace la base
PRODUCTS = {
 'lti-provider':    dict(name='LTI Provider',    letter='L', color='#5464BF', tag='Integración LTI 1.3',
                         shape=MASS.difference(box(S1,0,900,B)),                         dot=(560,415)),
 'openclass-live':  dict(name='OpenClass Live',  letter='O', color='#F27405', tag='Clases y charlas en vivo',
                         shape=MASS.difference(Polygon([(S1,cut(S1)+120),(S2,cut(S2)+120),(S2,B),(S1,B)])), dot=(150,180)),
 'jarvis-pediatria':dict(name='Jarvis Pediatría', letter='J', color='#079F6C', tag='Asistente clínico con IA',
                         shape=MASS.difference(box(S1,0,S2,B)).difference(box(-10,0,S1,500)), dot=(405,395)),
 'studio':          dict(name='Studio',           letter='S', color='#F2E205', tag='Generador de contenido',
                         shape=MASS.difference(box(S1,470,900,550)).difference(box(-10,635,S2,715)), dot=(150,180), ring=True),
}
DOT_R = 88
def mark_inner(slug, ink='currentColor'):
    p=PRODUCTS[slug]; cx,cy=p['dot']
    ring = f' stroke="{ink}" stroke-width="16"' if p.get('ring') else ''
    return f'<path fill="{ink}" d="{path(p["shape"])}"/><circle cx="{cx}" cy="{cy}" r="{DOT_R}" fill="{p["color"]}"{ring}/>'
