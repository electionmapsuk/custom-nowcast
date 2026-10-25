"""Fit the 2024 tactical-vote 'loans' from the British Election Study and write them into data/seats.json (loans24).
    python3 build/fit_unwind.py            (run from the project root; only needs re-running if seat data changes)
Source: BES wave 29 (post-2024 election) - 'Why did you vote for the party that you did?' = 'I really preferred another
party but it had no chance of winning in this constituency' + 'Which party did you really prefer?' + 2024 constituency.
For each 2024 race type (top two parties) and closeness band (<10, 10-25, 25+ pts), the share F of each party's SINCERE
supporters who voted for another party tactically (and where they went). Seat loan from a party outside the top two =
F/(1-F) x its actual 2024 share, split by destination. Green-led races (few respondents) borrow the Lib Dem pattern.
Extract: analysis/bes_w29_tactical.csv (made with analysis/bes_savmeta.py + bes_extract_tactical.c from the BES .sav).
"""
import pandas as pd, numpy as np, json, sys, os
HERE=os.path.dirname(os.path.abspath(__file__))
SRC=sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'data','seats.json'); DST=sys.argv[2] if len(sys.argv)>2 else SRC
SEATS=json.load(open(SRC)); S={s['code']:s for s in SEATS}
d=pd.read_csv(os.path.join(HERE,'..','analysis','bes_w29_tactical.csv'))
P={1:'CON',2:'LAB',3:'LDM',4:'SNP',5:'PLC',7:'GRN',12:'RFM',13:'IND',9:'OTH',0:'NV'}
d['v']=d.vote.map(P); d['pref']=d.preferred.map(P); d=d[d.pcon.isin(S.keys())]
PART=['CON','LAB','LDM','GRN','RFM','SNP','PLC']
d=d[d.v.isin(PART+['IND','OTH'])].copy()
d['sinc']=np.where((d.reason==4)&d.pref.isin(PART),d.pref,d.v)
def race(c):
    a=S[c]['a24']; t=sorted([p for p in a if p not in('MIN','OTH','WPB')],key=lambda p:-a[p])[:2]; return tuple(sorted(t)), a[t[0]]-a[t[1]]
R={c:race(c) for c in S}
d['typ']=d.pcon.map(lambda c:R[c][0]); d['gap']=d.pcon.map(lambda c:R[c][1])
gb=lambda g: 0 if g<0.10 else (1 if g<0.25 else 2)
d['gb']=d.gap.map(gb)
MIN_N=40
def table(sub):
    out={}
    for p in PART:
        x=sub[sub.sinc==p]
        if len(x)<MIN_N: continue
        W=x.wt.sum(); fl=x[(x.reason==4)&(x.v!=p)&x.v.isin(PART)].groupby('v').wt.sum()/W
        out[p]=({k:float(v) for k,v in fl.items() if v>0.005}, len(x))
    return out
T_fine={k:table(g) for k,g in d.groupby(['typ','gb'])}
T_type={k:table(g) for k,g in d.groupby('typ')}
n=0
for s in SEATS:
    s.pop('loans24',None)
    if s['code'] not in R or not s.get('a24'): continue
    typ,gap=R[s['code']]; a=s['a24']; L=[]
    for p in PART:
        if p in typ or a.get(p,0)<=0: continue        # parties in the top two weren't lending
        e=T_fine.get((typ,gb(gap)),{}).get(p) or T_type.get(typ,{}).get(p); swap=None
        if not e and 'GRN' in typ:   # few Green-held/target races: borrow the matching Lib Dem race pattern, Green as recipient
            alt=tuple(sorted(['LDM' if q=='GRN' else q for q in typ])); swap=('LDM','GRN')
            e=T_fine.get((alt,gb(gap)),{}).get(p) or T_type.get(alt,{}).get(p)
        if not e: continue
        fl=dict(e[0])
        if swap: fl={ (swap[1] if k==swap[0] else ('LDM' if k=='GRN' else k)):v for k,v in fl.items() }
        F=min(0.6,sum(fl.values()))
        if F<=0: continue
        tot=F/(1-F)*a.get(p,0)
        for r,v in fl.items():
            if r==p: continue
            amt=tot*v/sum(fl.values())
            amt=min(amt, 0.5*a.get(r,0))
            if amt>0.002: L.append([p,r,round(float(amt),4)])
    if L: s['loans24']=L; n+=1
for s in SEATS: s.pop('loanOverride',None); s.pop('loanOverride_note',None)
json.dump(SEATS,open(DST,'w'),separators=(',',':'),ensure_ascii=False)
print('seats with BES loans',n,' avg total',round(100*np.mean([sum(x[2] for x in s['loans24']) for s in SEATS if s.get('loans24')]),2),'pts')
for nm in ['Ely and East Cambridgeshire','Waveney Valley','Lichfield','Harwich and North Essex','Wimbledon','Bath','Glasgow South']:
    s=next(x for x in SEATS if x['name']==nm); print(' ',nm,[(a,b,round(v*100,1)) for a,b,v in s.get('loans24') or []])
