from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
FD='node_modules/@fontsource'
FONTS={'head':f'{FD}/merriweather-sans/files/merriweather-sans-latin-800-normal.woff',
       'head7':f'{FD}/merriweather-sans/files/merriweather-sans-latin-700-normal.woff',
       'body':f'{FD}/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff',
       'body7':f'{FD}/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff'}
_c={}
def font(k):
    if k not in _c: _c[k]=TTFont(FONTS[k])
    return _c[k]
def kern_table(f):
    pairs={}
    if 'GPOS' not in f: return pairs
    for lk in f['GPOS'].table.LookupList.Lookup:
        if lk.LookupType!=2: continue
        for st in lk.SubTable:
            if st.Format==1:
                cov=st.Coverage.glyphs
                for i,ps in enumerate(st.PairSet):
                    for pv in ps.PairValueRecord:
                        v=getattr(pv.Value1,'XAdvance',0) or 0
                        if v: pairs.setdefault((cov[i],pv.SecondGlyph),v)
            elif st.Format==2:
                cov=st.Coverage.glyphs; c1=st.ClassDef1.classDefs; c2=st.ClassDef2.classDefs
                for g1 in cov:
                    r=st.Class1Record[c1.get(g1,0)]
                    for g2,k2 in c2.items():
                        v=getattr(r.Class2Record[k2].Value1,'XAdvance',0) or 0
                        if v: pairs.setdefault((g1,g2),v)
    return pairs
_k={}
def text_path(s, k, size, x=0, y=0, track=0):
    """Devuelve (d, ancho) con la línea base en y."""
    f=font(k); upm=f['head'].unitsPerEm; gs=f.getGlyphSet(); cmap=f.getBestCmap(); hm=f['hmtx']
    if k not in _k: _k[k]=kern_table(f)
    sc=size/upm; pen=SVGPathPen(gs, ntos=lambda v: f'{v:.1f}'.rstrip('0').rstrip('.')); cx=0; names=[cmap[ord(ch)] for ch in s]
    for i,g in enumerate(names):
        tp=TransformPen(pen,(sc,0,0,-sc,x+cx*sc,y)); gs[g].draw(tp)
        cx+=hm[g][0]+(_k[k].get((g,names[i+1]),0) if i+1<len(names) else 0)+track*upm
    return pen.getCommands(), (cx-track*upm)*sc
def cap_height(k, size):
    f=font(k); return getattr(f['OS/2'],'sCapHeight',0)*size/f['head'].unitsPerEm
