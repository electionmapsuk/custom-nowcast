/* Tactical-voting model, transcribed from the 'Tactical Vote' sheet.
   Per-matchup transfer matrices (F = to 1st place, S = to 2nd place),
   logistic bloc clarity, incumbent shields, cross-bloc "hijack", and
   national vote conservation. Matchup keys are the two parties in
   alphabetical order joined by "_". All numbers are editable here.       */

const LEFT  = new Set(['LAB','LDM','GRN','SNP','PLC']);
const RIGHT = new Set(['CON','RFM','RES']);
// SCOTLAND: two blocs on the constitutional axis - unionist (LAB, LDM, CON, RFM, RES) and nationalist
// (SNP, GRN). A voter whose bloc has a candidate in the race acts at full strength, with clarity from the
// gap between the top two parties of that bloc; if their bloc isn't in the race, lesser-evil strength.
const SC_BLOC = { LAB:'UN', LDM:'UN', CON:'UN', RFM:'UN', RES:'UN', SNP:'NAT', GRN:'NAT' };
const scBlocMembers = b => Object.keys(SC_BLOC).filter(p=>SC_BLOC[p]===b);
const RANK_PARTIES = ['LAB','CON','RFM','LDM','GRN','RES','SNP','PLC','MIN','WPB'];

// transfer-out fractions per donor party, keyed by alphabetical matchup
// F = to 1st (alphabetical) party. Updated from YouGov tactical head-to-heads, 15-22 Sep 2026.
const F = {
  LAB:{CON_GRN:.13,CON_LDM:.08,CON_RFM:.43,GRN_LDM:.32,GRN_RFM:.68,LDM_RFM:.74,CON_SNP:.2,LDM_SNP:.2,GRN_SNP:.15,CON_PLC:.1,LDM_PLC:.1,GRN_PLC:.05},
  LDM:{CON_GRN:.22,CON_LAB:.14,CON_RFM:.49,GRN_LAB:.31,GRN_RFM:.71,LAB_RFM:.68,CON_SNP:.2,LAB_SNP:.2,GRN_SNP:.1,CON_PLC:.1,LAB_PLC:.1,GRN_PLC:.05},
  GRN:{CON_LAB:.04,CON_LDM:.04,CON_RFM:.26,LAB_LDM:.34,LAB_RFM:.63,LDM_RFM:.6,CON_SNP:.02,LAB_SNP:.05,LDM_SNP:.05,CON_PLC:.02,LAB_PLC:.05,LDM_PLC:.05},
  CON:{GRN_LAB:.1,GRN_LDM:.04,GRN_RFM:.16,LAB_LDM:.12,LAB_RFM:.18,LDM_RFM:.3,LAB_SNP:.2,LDM_SNP:.2,GRN_SNP:.1,LAB_PLC:.15,LDM_PLC:.15,GRN_PLC:.1},
  RFM:{CON_GRN:.46,CON_LAB:.41,CON_LDM:.44,GRN_LAB:.06,GRN_LDM:.03,LAB_LDM:.06,CON_SNP:.1,LAB_SNP:.1,LDM_SNP:.1,CON_PLC:.05,LAB_PLC:.05,LDM_PLC:.05},
  RES:{CON_GRN:.32,CON_LAB:.30,CON_LDM:.30,GRN_LAB:.02,GRN_LDM:.01,LAB_LDM:.02,CON_RFM:.05,GRN_RFM:.01,LAB_RFM:0,LDM_RFM:.01,CON_SNP:.07,LAB_SNP:.07,LDM_SNP:.07,CON_PLC:.04,LAB_PLC:.04,LDM_PLC:.04},  // estimated: stickier + more extreme than RFM (not surveyed)
  SNP:{__const:.02},
  PLC:{__const:.03},
};
// S = to 2nd (alphabetical) party. Updated from YouGov tactical head-to-heads, 15-22 Sep 2026.
const S = {
  LAB:{CON_GRN:.6,CON_LDM:.63,CON_RFM:.02,GRN_LDM:.38,GRN_RFM:.03,LDM_RFM:.03,CON_SNP:.02,LDM_SNP:.02,GRN_SNP:.02,CON_PLC:.1,LDM_PLC:.1,GRN_PLC:.05},
  LDM:{CON_GRN:.46,CON_LAB:.52,CON_RFM:.03,GRN_LAB:.41,GRN_RFM:.04,LAB_RFM:.05,CON_SNP:.05,LAB_SNP:.05,GRN_SNP:.05,CON_PLC:.05,LAB_PLC:.05,GRN_PLC:.05},
  GRN:{CON_LAB:.55,CON_LDM:.54,CON_RFM:.02,LAB_LDM:.25,LAB_RFM:.02,LDM_RFM:.02,CON_SNP:.3,LAB_SNP:.3,LDM_SNP:.3,CON_PLC:.15,LAB_PLC:.15,LDM_PLC:.15},
  CON:{GRN_LAB:.2,GRN_LDM:.4,GRN_RFM:.4,LAB_LDM:.3,LAB_RFM:.37,LDM_RFM:.36,LAB_SNP:.01,LDM_SNP:.01,GRN_SNP:.01,LAB_PLC:.02,LDM_PLC:.02,GRN_PLC:.02},
  RFM:{CON_GRN:.04,CON_LAB:.02,CON_LDM:.03,GRN_LAB:.08,GRN_LDM:.18,LAB_LDM:.15,CON_SNP:0,LAB_SNP:0,LDM_SNP:0,CON_PLC:0,LAB_PLC:0,LDM_PLC:0},
  RES:{CON_GRN:.01,CON_LAB:.01,CON_LDM:.01,GRN_LAB:.03,GRN_LDM:.06,LAB_LDM:.06,CON_RFM:.45,GRN_RFM:.50,LAB_RFM:.55,LDM_RFM:.50,CON_SNP:0,LAB_SNP:0,LDM_SNP:0,CON_PLC:0,LAB_PLC:0,LDM_PLC:0},  // estimated
  SNP:{__const:.02},
  PLC:{__const:.03},
};
// SCOTLAND-SPECIFIC stated rates: Survation for the Diffley Partnership, 31 Mar 2026 (Holyrood constituency
// two-party scenarios, crossbroken by current Holyrood constituency VI; likely voters). Used for Scottish
// seats wherever the matchup is covered; otherwise the GB (YouGov) tables apply. SNP-voter rates for
// contests the survey didn't ask (CON_LAB, CON_RFM, CON_LDM) are estimates from the YouGov Scottish subsample.
const F_SC = {
  LAB:{RFM_SNP:.13, CON_SNP:.22, LDM_SNP:.35},
  CON:{LAB_SNP:.21, RFM_SNP:.43, LAB_RFM:.11, LDM_SNP:.34},
  RFM:{LAB_SNP:.24, CON_SNP:.34, LDM_SNP:.25},
  LDM:{LAB_SNP:.34, RFM_SNP:.14, LAB_RFM:.42, CON_SNP:.27},
  GRN:{LAB_SNP:.10, RFM_SNP:.13, LAB_RFM:.42, CON_SNP:.09, LDM_SNP:.16},
  SNP:{LAB_RFM:.31, CON_LAB:.05, CON_RFM:.20, CON_LDM:.05},
};
const S_SC = {
  LAB:{RFM_SNP:.34, CON_SNP:.26, LDM_SNP:.26},
  CON:{LAB_SNP:.04, RFM_SNP:.04, LAB_RFM:.39, LDM_SNP:.03},
  RFM:{LAB_SNP:.15, CON_SNP:.16, LDM_SNP:.19},
  LDM:{LAB_SNP:.11, RFM_SNP:.24, LAB_RFM:.11, CON_SNP:.17},
  GRN:{LAB_SNP:.45, RFM_SNP:.46, LAB_RFM:.10, CON_SNP:.41, LDM_SNP:.38},
  SNP:{LAB_RFM:.10, CON_LAB:.40, CON_RFM:.05, CON_LDM:.35},
};
F_SC.RES = F_SC.RFM; S_SC.RES = S_SC.RFM;   // Restore voters (not surveyed) treated like Reform voters in Scotland
const DONORS = ['LAB','LDM','GRN','CON','RFM','SNP','PLC','RES'];
// ---- Find Out Now / Electoral Calculus tactical preferences (Oct 2026), blended in ----
// [nation, donor, A, B, % to A, % to B]. Scaled by FON_R (= YouGov's overall switching level / FON's, on the 16
// England cells both cover) so the model's calibration (TSCALE) is unchanged, then averaged FON_W : (1-FON_W) with
// the existing table: YouGov (England/GB), Survation (Scotland). Cells only FON covers are used as they are
// (Restore donors everywhere; Wales, incl. Plaid voters and Plaid contests). Wales: FON Wales blended with the GB table.
const FON = [
 ['E','LDM','CON','LAB',18,62],['E','RFM','CON','LAB',47,2],
 ['E','LAB','CON','LDM',9,69],['E','RFM','CON','LDM',44,5],['E','GRN','CON','LDM',2,69],['E','RES','CON','LDM',30,7],
 ['E','LAB','CON','RFM',50,4],['E','LDM','CON','RFM',64,3],['E','GRN','CON','RFM',38,1],['E','RES','CON','RFM',9,56],
 ['E','CON','GRN','LAB',12,28],['E','LDM','GRN','LAB',28,48],['E','RFM','GRN','LAB',10,9],['E','RES','GRN','LAB',7,8],
 ['E','CON','LAB','RFM',21,43],['E','LDM','LAB','RFM',75,7],['E','GRN','LAB','RFM',84,1],['E','RES','LAB','RFM',3,60],
 ['E','CON','LDM','RFM',26,34],['E','LAB','LDM','RFM',77,3],
 ['S','LAB','CON','SNP',34,39],['S','LDM','CON','SNP',36,34],['S','RFM','CON','SNP',57,11],['S','GRN','CON','SNP',0,79],['S','RES','CON','SNP',29,20],
 ['S','CON','LAB','SNP',74,3],['S','LDM','LAB','SNP',49,25],['S','RFM','LAB','SNP',30,18],['S','GRN','LAB','SNP',25,50],['S','RES','LAB','SNP',20,21],
 ['S','CON','LDM','SNP',61,14],['S','LAB','LDM','SNP',58,23],['S','RFM','LDM','SNP',29,13],['S','GRN','LDM','SNP',7,66],['S','RES','LDM','SNP',20,21],
 ['S','CON','RFM','SNP',49,17],['S','LAB','RFM','SNP',15,52],['S','LDM','RFM','SNP',6,57],['S','GRN','RFM','SNP',0,77],['S','RES','RFM','SNP',56,12],
 ['W','LDM','CON','LAB',31,42],['W','RFM','CON','LAB',54,1],['W','GRN','CON','LAB',2,71],['W','RES','CON','LAB',32,3],['W','PLC','CON','LAB',3,52],
 ['W','LAB','CON','RFM',31,0],['W','LDM','CON','RFM',66,7],['W','GRN','CON','RFM',40,2],['W','RES','CON','RFM',0,55],['W','PLC','CON','RFM',26,3],
 ['W','CON','LAB','RFM',30,37],['W','LDM','LAB','RFM',82,7],['W','GRN','LAB','RFM',71,3],['W','RES','LAB','RFM',2,67],['W','PLC','LAB','RFM',53,5],
 ['W','CON','PLC','RFM',33,37],['W','LAB','PLC','RFM',67,0],['W','LDM','PLC','RFM',56,6],['W','GRN','PLC','RFM',77,1],['W','RES','PLC','RFM',1,65],
];
const FON_R = 0.868, FON_W = 0.5;
const F_WA={}, S_WA={}; let _WALES=false, loans24G=null;
(function(){
  F_SC.RES=Object.assign({},F_SC.RFM); S_SC.RES=Object.assign({},S_SC.RFM);
  const put=(Ft,St,d,a,b,ta,tb,mode)=>{ const [x,y]=[a,b].sort(), k=x+'_'+y, tx=(x===a?ta:tb)/100*FON_R, ty=(x===a?tb:ta)/100*FON_R;
    Ft[d]=Ft[d]||{}; St[d]=St[d]||{};
    if (mode==='blend' && k in Ft[d] && k in St[d]) { Ft[d][k]=(1-FON_W)*Ft[d][k]+FON_W*tx; St[d][k]=(1-FON_W)*St[d][k]+FON_W*ty; }
    else { Ft[d][k]=tx; St[d][k]=ty; } };
  FON.forEach(([n,d,a,b,ta,tb])=>{
    if(n==='E') put(F,S,d,a,b,ta,tb, d==='RES'?'replace':'blend');
    if(n==='S') put(F_SC,S_SC,d,a,b,ta,tb, d==='RES'?'replace':'blend');
    if(n==='W'){ const [x,y]=[a,b].sort(),k=x+'_'+y, g=(F[d]&&k in F[d]&&!('__const' in F[d]))?[F[d][k],S[d][k]]:null;
      F_WA[d]=F_WA[d]||{}; S_WA[d]=S_WA[d]||{}; const tx=(x===a?ta:tb)/100*FON_R, ty=(x===a?tb:ta)/100*FON_R;
      if(g && d!=='RES'){ F_WA[d][k]=(1-FON_W)*g[0]+FON_W*tx; S_WA[d][k]=(1-FON_W)*g[1]+FON_W*ty; } else { F_WA[d][k]=tx; S_WA[d][k]=ty; } } });
})();
const CANON = ['LAB','CON','RFM','LDM','GRN','RES','SNP','PLC','MIN','WPB','OTH'];

const logistic=(k,mid,x)=>1/(1+Math.exp(-k*(x-mid)));
// Realism scaling applied per flow on top of the YouGov rates: a vote lent to a party in the donor's
// OWN bloc (e.g. LD->Lab, Con->Reform) is scaled by INTRA; a vote lent ACROSS blocs (e.g. Lab->Con,
// Con->Lab) by INTER. Parties outside both blocs (MIN/OTH) count as intra.
const INTRA_BLOC = 1, INTER_BLOC = 1;   // bloc limits OFF (was 0.8 / 0.6); double-counting now handled by the 2024 loan unwind
function blocScale(donor, recip){
  const L=LEFT.has(donor)&&LEFT.has(recip), R=RIGHT.has(donor)&&RIGHT.has(recip);
  const cross=(LEFT.has(donor)&&RIGHT.has(recip))||(RIGHT.has(donor)&&LEFT.has(recip));
  return cross ? INTER_BLOC : INTRA_BLOC;
}
// Restore as a RECIPIENT (not surveyed): in a Reform-v-Restore contest donors use RES_RFM_T
// [to RES, to RFM]; Reform voters back Restore when it is the right-wing contender; everyone else
// treats Restore like Reform (alphabetical order vs every other party is identical, so keys map 1:1).
const RES_RFM_T = { CON:[.05,.30], LAB:[.01,.15], LDM:[.01,.15], GRN:[.01,.10] };
// Global realism scale: stated tactical intentions (hypothetical survey Qs) overstate real behaviour
// (2019->24 squeezes were well below face value), so every transfer rate is scaled by TSCALE.
const COMP_FLOOR = 0.5;
const TSCALE = 1;   // realisation rate of stated tactical intentions today. Oct 2026: backtest + by-elections best at 0.75-1.0
function frac(tbl, party, matchup, scot){ return TSCALE*fracRaw(tbl, party, matchup, scot); }
function fracRaw(tbl, party, matchup, scot){
  if (_WALES) { const st=(tbl===F?F_WA:S_WA)[party]; if (st && matchup in st) return st[matchup]; }   // Wales-specific (FON-blended)
  if (scot) { const key=matchup.indexOf('RES')<0 ? matchup : null;
    const st=(tbl===F?F_SC:S_SC)[party]; if (key && st && key in st) return st[key]; }
  const t=tbl[party]; if(!t) return 0; if('__const'in t) return t.__const;
  if(matchup in t) return t[matchup];
  if(matchup.indexOf('RES')<0) return 0;
  const isF = (tbl===F);
  if(matchup==='RES_RFM'){ const x=RES_RFM_T[party]; return x ? x[isF?0:1] : 0; }
  const other = matchup.split('_').find(x=>x!=='RES');
  if(party==='RFM'){
    const toRES = other==='CON'?0.30:0.50, toOther = other==='CON'?0.15:0.01;
    const resFirst = 'RES' < other;
    return isF ? (resFirst?toRES:toOther) : (resFirst?toOther:toRES);
  }
  const key = matchup.replace('RES','RFM');
  return t[key]||0;
}

function rank3(base){
  const arr = RANK_PARTIES.map(p=>[p, base[p]||0]).sort((a,b)=>b[1]-a[1]);
  return { p1:arr[0][0],p2:arr[1][0],p3:arr[2][0], v1:arr[0][1],v2:arr[1][1],v3:arr[2][1] };
}
function bloc2(base, members){
  const vals = members.map(p=>base[p]||0).sort((a,b)=>b-a);
  return (vals[0]||0)-(vals[1]||0);
}

// ---- UNWINDING 2024's TACTICAL VOTE: loans measured from REAL results (build/fit_unwind.py -> seats.json loans24) ----
// Each seat carries [donor, recipient, pts] loans made in 2024, from the British Election Study (voters' own reports of
// voting tactically and the party they really preferred, by race type and closeness) - see build/fit_unwind.py.
// Today: each loan is handed back, shrunk if the donor has fallen since 2024 (never grown - growth may already be those
// voters returning), then today's tactical voting is applied.
// (Replaced Oct 2026: the survey-based 'working backwards' unwind and the 2019-notional Labour loans.)
function seatTactical(base, incumbent, prev, gaza, scot){
  const sb={}; CANON.forEach(p=>sb[p]=base[p]||0);
  if (prev) (loans24G||[]).forEach(([d,r,v])=>{ const k=(prev[d]||0)>0?Math.min(1,(base[d]||0)/prev[d]):1, m=Math.min(v*k, sb[r]||0); sb[d]+=m; sb[r]-=m; });
  // voters judge which race they're in from the last ACTUAL result (swung to today), not from the sincere vote
  const dT=tacticalDelta(sb, base, incumbent, null, gaza, scot);
  const out={}; CANON.forEach(p=>out[p]=Math.max(0,sb[p]+(dT[p]||0)));
  return out;
}
// Tactical flows given donor volumes (base) and the race as voters perceive it (perc).
function tacticalDelta(base, perc, incumbent, donors, gaza, scot, intraOnly){
  const DONORS_ = donors || DONORS;
  const r = rank3(perc);
  // Clarity = share of a bloc's tactical voters who act, given how clear the bloc's vehicle is:
  // 1 - 0.5*exp(-gap/9.5pt) -> 50% at a tie, 55% at 1pt, 70% at 5pt, 83% at 10pt, 90% at 15pt.
  const clarCurve = g => 1 - 0.5*Math.exp(-g/0.095);
  const AI = clarCurve(bloc2(perc,['LAB','LDM','GRN','SNP','PLC']));   // left clarity
  const AJ = clarCurve(bloc2(perc,['CON','RFM','RES']));        // right clarity
  const shield = p => (p===incumbent ? 0.5 : 1);   // incumbent's voters keep 50% of would-be tactical outflow

  function scenario(pa, va, pb, vb){
    const firstP = pa < pb ? pa : pb;
    const secondP = pa < pb ? pb : pa;
    const matchup = firstP+'_'+secondP;
    const bothRight = RIGHT.has(firstP)&&RIGHT.has(secondP);
    const bothLeft  = LEFT.has(firstP)&&LEFT.has(secondP);
    // Clarity no longer suppresses tactical VOLUME much: if the bloc's vehicle is unclear, voters still
    // switch but SPLIT across the candidates (via the tie-blend W below); only up to 25% stay put out of
    // confusion (0.75 + 0.25*clarity). If the donor's own bloc isn't in the contest ("lesser evil"),
    // they vote tactically at LESSER_EVIL strength.
    const LESSER_EVIL = 1/3;     // strength when donor's own bloc isn't in the contest (by-elections show ~0; survey implies 1)
    const clarForEW = p => LEFT.has(p) ? (bothRight?LESSER_EVIL:AI) : (RIGHT.has(p) ? (bothLeft?LESSER_EVIL:AJ) : 1);
    const clarForSC = p => { const b=SC_BLOC[p]; if(!b) return 1;
      return (SC_BLOC[firstP]===b || SC_BLOC[secondP]===b) ? clarCurve(bloc2(perc, scBlocMembers(b))) : LESSER_EVIL; };
    const clarFor = scot ? clarForSC : clarForEW;
    const comp = COMP_FLOOR + (1-COMP_FLOOR)*Math.pow(Math.max(0, 1-(Math.abs(va-vb)/0.25)), 1.5);   // closer race -> more squeezing, but never below COMP_FLOOR (BES 2024: squeezing persists in safe seats)   // 5pt lead 72%, 10pt 46%, 15pt 25%, 25pt+ 0
    const lost={}, gainedFirst={}, gainedSecond={};
    DONORS_.forEach(p=>{
      const cl=clarFor(p);
      const xb = r => (LEFT.has(p)&&RIGHT.has(r))||(RIGHT.has(p)&&LEFT.has(r));
      const fF = (intraOnly&&xb(firstP)?0:1)*frac(F,p,matchup,scot)*blocScale(p,firstP), fS = (intraOnly&&xb(secondP)?0:1)*frac(S,p,matchup,scot)*blocScale(p,secondP);
      lost[p] = (base[p]||0)*cl*(fF+fS);
      gainedFirst[p]  = (base[p]||0)*cl*fF*shield(p);
      gainedSecond[p] = (base[p]||0)*cl*fS*shield(p);
    });
    const out={};
    CANON.forEach(party=>{
      const isTop2 = party===firstP||party===secondP;
      let vLost=0, vGained=0;
      if(!isTop2 && DONORS_.includes(party)) vLost = lost[party]*comp*shield(party);
      if(isTop2){
        const g = (party===firstP)?gainedFirst:gainedSecond;
        vGained = DONORS_.reduce((a,p)=>a+(g[p]||0),0)*comp;
      }
      out[party]=[vLost,vGained];
    });
    return out;
  }

  // SINGLE RULE: weight each possible contest (pair of the top-4 parties) by the probability that
  // those two are genuinely the top two, given seat-level uncertainty CONTEST_SIGMA (same as the
  // Monte Carlo's local error). Smooth and ordering-invariant by construction. Cross-bloc contests
  // get a modest salience bonus (voters frame a nearby opposite-bloc threat as "the" race).
  const top = RANK_PARTIES.map(p=>[p, perc[p]||0]).sort((x,y)=>y[1]-x[1]).slice(0,4);
  const pw = pairWeights(top, scot);
  const out={}; CANON.forEach(p=>out[p]=0);
  pw.forEach(({i,j,w})=>{
    if(w<1e-4) return;
    const sc = scenario(top[i][0],top[i][1], top[j][0],top[j][1]);
    CANON.forEach(p=>{ out[p] += w*(sc[p][1]-sc[p][0]); });
    // GAZA TACTICAL VOTING: in seats with an organised pro-Gaza independent/Workers Party candidate,
    // Greens and that candidate (MIN) act as one bloc. If the race features one of them but not the
    // other, the other's voters switch at GAZA_RATE (x TSCALE), scaled by the clarity of the
    // Green-v-independent gap and the closeness of the race. (No YouGov data - rate estimated from
    // the Rumworth by-election and the May 2026 London locals.)
    if (gaza && (!donors || donors.includes('GRN'))) {
      // Gaza bloc = Greens + the seat's pro-Gaza independent (MIN) + a second-placed Workers Party (WPB).
      // Bloc members in the race receive; bloc members not in the race give (split if two receive).
      const BL=['GRN','MIN','WPB'], a=top[i][0], b=top[j][0];
      const recips=BL.filter(p=>p===a||p===b), givers=BL.filter(p=>p!=='GRN'&&p!==a&&p!==b&&(base[p]||0)>0);   // one-way: IND/WPB voters back a Green in contention, Green voters do NOT lend to IND/WPB
      if (recips.length && givers.length) {
        const cl = clarCurve(bloc2(perc,BL));
        const comp = Math.pow(Math.max(0, 1-(Math.abs(top[i][1]-top[j][1])/0.25)), 1.5);
        givers.forEach(d=>{ const mv=(base[d]||0)*GAZA_RATE*TSCALE*cl*comp*shield(d); out[d]-=w*mv; recips.forEach(r=>{ out[r]+=w*mv/recips.length; }); });
      }
    }
  });
  return out;
}

const CONC_RESCALE = (typeof process!=='undefined'&&process.env&&process.env.CONC) ? true : false;
const GAZA_RATE = 0.65;   // stated-equivalent rate Green<->pro-Gaza IND/WPB (like GRN->LAB vs RFM 0.63)
const GAZA_MIN_IND = 0.10, GAZA_MIN_MUS = 0.10;   // seats: organised IND/WPB (>=10% base) with >=10% Muslim population, plus the listed seats
const CONTEST_SIGMA = 0.04, CROSS_BLOC_SALIENCE = 0.25;
const _Q_unused = (()=>{ const n=41,xs=[],ws=[]; for(let k=0;k<n;k++){const z=-4+8*k/(n-1);xs.push(z);ws.push(Math.exp(-z*z/2));} const t=ws.reduce((a,b)=>a+b,0); return {xs,ws:ws.map(w=>w/t)}; })();
function Phi(z){ const t=1/(1+0.2316419*Math.abs(z)); const d=0.3989423*Math.exp(-z*z/2);
  const p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274)))); return z>0?1-p:p; }
// P(parties i,j both finish above every other listed party) = integral over m = max(rest) of
// dF_max(m) * P(x_i>m) * P(x_j>m). One shared grid of normal CDFs per seat -> fast enough for the MC.
// Same arithmetic as before (identical results), written for speed: party CDFs and survival midpoints
// computed once per seat instead of once per pair, typed arrays, no closures in the inner loop, and a
// small memo (the 2024-unwind call sees the same 2024 race in every Monte Carlo simulation).
const _PW_MEMO = new Map(), _PW_MEMO_MAX = 4000;
function pairWeights(top, scot){
  const n=top.length;
  let key=scot?'S':'E'; for(let k=0;k<n;k++) key+='|'+top[k][0]+':'+top[k][1];
  const hit=_PW_MEMO.get(key); if(hit) return hit.map(p=>({i:p.i,j:p.j,w:p.w}));
  const s=CONTEST_SIGMA, G=121;
  let lo=Infinity, hi=-Infinity; for(let k=0;k<n;k++){ const v=top[k][1]; if(v<lo) lo=v; if(v>hi) hi=v; }
  lo-=5*s; hi+=5*s;
  const F=[], SM=[];
  for(let k=0;k<n;k++){ const f=new Float64Array(G), sm=new Float64Array(G), v=top[k][1];
    for(let g=0;g<G;g++){ f[g]=Phi(((lo+(hi-lo)*g/(G-1))-v)/s); if(g>0) sm[g]=1-(f[g]+f[g-1])/2; }
    F.push(f); SM.push(sm); }
  const pairs=[], rest=[];
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++){
    rest.length=0; for(let k=0;k<n;k++) if(k!==i&&k!==j) rest.push(k);
    const Si=SM[i], Sj=SM[j], nr=rest.length;
    let pr=0, prevFM=0;
    for(let g=0;g<G;g++){
      let FM=1; for(let r=0;r<nr;r++) FM*=F[rest[r]][g];
      if(g>0) pr+=(FM-prevFM)*Si[g]*Sj[g];
      prevFM=FM;
    }
    const cross= scot ? (SC_BLOC[top[i][0]] && SC_BLOC[top[j][0]] && SC_BLOC[top[i][0]]!==SC_BLOC[top[j][0]])
                      : ((LEFT.has(top[i][0])&&RIGHT.has(top[j][0]))||(RIGHT.has(top[i][0])&&LEFT.has(top[j][0])));
    pairs.push({i,j,w:pr*(cross?1+CROSS_BLOC_SALIENCE:1)});
  }
  const t=pairs.reduce((a,p)=>a+p.w,0)||1; pairs.forEach(p=>p.w/=t);
  if(_PW_MEMO.size>=_PW_MEMO_MAX) _PW_MEMO.clear();
  _PW_MEMO.set(key, pairs.map(p=>({i:p.i,j:p.j,w:p.w})));
  return pairs;
}

function apply(seats, transShare, cfg){
  // pass 1: tactical raw shares per seat + PER-ENGINE pre/post vote sums
  // (conserve each nation/engine's vote independently, so tactical voting can't move a
  //  party's vote between Scotland / Wales / London / England-ex-London).
  const pre={}, post={}, tac={}, ptop={};
  seats.forEach(s=>{
    const base = transShare[s.code]; if(!base) return;
    const gaza = (cfg&&cfg.greenIndBlocSeats||[]).includes(s.code) || (((s.base&&s.base.MIN)||0) >= GAZA_MIN_IND && (s.mus||0) >= GAZA_MIN_MUS);
    _WALES=(s.engine==='Wales'); loans24G=s.loans24||null; const t = seatTactical(base, s.incumbent2024, s.a24, gaza, (s.engine==='Scotland')); _WALES=false;
    tac[s.code]=t;
    if (CONC_RESCALE) { // P(party is in the genuine top two) from the same contest weights used for tactical voting
      const top = RANK_PARTIES.map(p=>[p, base[p]||0]).sort((x,y)=>y[1]-x[1]).slice(0,4);
      const pt={}; pairWeights(top).forEach(({i,j,w})=>{ pt[top[i][0]]=(pt[top[i][0]]||0)+w; pt[top[j][0]]=(pt[top[j][0]]||0)+w; });
      ptop[s.code]=pt;
    }
    const eng = s.engine || 'EngExLondon';
    if(!pre[eng]){ pre[eng]={}; post[eng]={}; CANON.forEach(p=>{pre[eng][p]=0;post[eng][p]=0;}); }
    const votes = s.electorate*s.turnout;
    CANON.forEach(p=>{ pre[eng][p]+=(base[p]||0)*votes; post[eng][p]+=(t[p]||0)*votes; });
  });
  const ratio={};
  // MIN/OTH aren't polled parties, so their totals aren't conserved (otherwise Gaza-bloc gains for
  // independents would just be clawed back from the same independent seats).
  // NO TOP-UP FOR A PARTY IN SEATS IT ALREADY HOLDS (currently Greens): the national tactical top-up
  // is spread only over that party's other seats, so the regional total is unchanged.
  const NO_TOPUP_HELD=['GRN'], exempt=(s,p)=>NO_TOPUP_HELD.includes(p)&&s.incumbent2024===p;
  const ex={}; seats.forEach(s=>{ const t=tac[s.code]; if(!t) return; const eng=s.engine||'EngExLondon'; ex[eng]=ex[eng]||{};
    NO_TOPUP_HELD.forEach(p=>{ if(exempt(s,p)) ex[eng][p]=(ex[eng][p]||0)+(t[p]||0)*s.electorate*s.turnout; }); });
  for(const eng in pre){ ratio[eng]={}; CANON.forEach(p=>{ const e=(ex[eng]||{})[p]||0;
    ratio[eng][p]= (p==='MIN'||p==='OTH'||p==='WPB') ? 1 : (post[eng][p]-e>0?(pre[eng][p]-e)/(post[eng][p]-e):1); }); }
  // CONC_RESCALE: a party that loses votes nationally to tactical squeezing gets them back
  // where it is actually in contention (weight = share x P(top two)), not pro rata everywhere.
  const cw={};
  if (CONC_RESCALE) for(const eng in pre){ cw[eng]={}; CANON.forEach(p=>{ if(ratio[eng][p]>1){ let W=0; seats.forEach(s=>{ if((s.engine||'EngExLondon')!==eng||!tac[s.code]) return; W+=(tac[s.code][p]||0)*((ptop[s.code]||{})[p]||0)*s.electorate*s.turnout; }); if(W>0) cw[eng][p]=(pre[eng][p]-post[eng][p])/W; } }); }
  // pass 2: conserve each engine's totals, renormalise per seat
  const out={};
  seats.forEach(s=>{
    const t=tac[s.code]; if(!t) return;
    const eng=s.engine || 'EngExLondon';
    const r = ratio[eng] || {};
    const raw={}; CANON.forEach(p=>{ const k=(cw[eng]||{})[p];
      raw[p] = exempt(s,p) ? (t[p]||0) : k!=null ? (t[p]||0)*(1 + k*((ptop[s.code]||{})[p]||0)) : (t[p]||0)*(r[p]!=null?r[p]:1); });
    const tot=CANON.reduce((a,p)=>a+raw[p],0);
    const sh={}; CANON.forEach(p=> sh[p]= tot>0?raw[p]/tot:0);
    out[s.code]=sh;
  });
  return out;
}

module.exports = { apply, seatTactical, F, S };
