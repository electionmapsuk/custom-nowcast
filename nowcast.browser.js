/* ElectionMapsUK nowcast engine — browser bundle (auto-generated). Do not edit; edit nowcast.js/tactical.js and re-run build_bundle.js */
(function(){
"use strict";
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
const CANON = ['LAB','CON','RFM','LDM','GRN','RES','SNP','PLC','MIN','WPB','OTH'];

const logistic=(k,mid,x)=>1/(1+Math.exp(-k*(x-mid)));
// Realism scaling applied per flow on top of the YouGov rates: a vote lent to a party in the donor's
// OWN bloc (e.g. LD->Lab, Con->Reform) is scaled by INTRA; a vote lent ACROSS blocs (e.g. Lab->Con,
// Con->Lab) by INTER. Parties outside both blocs (MIN/OTH) count as intra.
const INTRA_BLOC = 1, INTER_BLOC = 1;   // bloc limits OFF (was 0.8 / 0.6); double-counting now handled by NET_OF_2024
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
const TSCALE = 2/3;   // realisation rate TODAY: share of stated (YouGov) tactical switching that actually happens (strong within-bloc squeezing, supported by post-Burnham by-elections)
function frac(tbl, party, matchup, scot){ return TSCALE*fracRaw(tbl, party, matchup, scot); }
function fracRaw(tbl, party, matchup, scot){
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

function seatTactical(base, incumbent, prev, gaza, scot){
  const delta = tacticalDelta(base, base, incumbent, null, gaza, scot);
  if(prev && NET_OF_2024>0){
    // The 2024 result already contains the tactical squeeze of 2024's contest. Only apply the
    // CHANGE: subtract the flows the 2024 contest would have produced (same YouGov rates, same
    // current donor volumes). Where the contest is unchanged this nets to ~0; where it has
    // changed, old tactical votes unwind and new ones form.
    // Scotland: 2024 flows can't exceed the donor votes that existed in 2024 (or exist now), so use
    // min(current, 2024) volumes; and, as in England, only unwind left/nationalist donors' 2024 squeezing.
    // England & Wales: 2024 tactical voting was INTRA-bloc (left voters squeezing to Lab/LD against the
    // Tories; Reform/Restore voters squeezing to the Tories in Con-v-Lab seats) - cross-bloc lending
    // (e.g. Con->Lab) is treated as not having happened. All donors, capped at 2024 volumes.
    const vol24 = Object.fromEntries(CANON.map(p=>[p, Math.min(base[p]||0, prev[p]||0)]));
    const d24 = tacticalDelta(vol24, prev, incumbent, scot ? NET_DONORS_SC : DONORS, gaza, scot, !scot);
    CANON.forEach(p=>{ delta[p] -= NET_OF_2024*d24[p]; });
  }
  const out={}; CANON.forEach(p=>out[p]=Math.max(0,(base[p]||0)+delta[p]));
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
    const comp = Math.pow(Math.max(0, 1-(Math.abs(va-vb)/0.25)), 1.5);   // 5pt lead 72%, 10pt 46%, 15pt 25%, 25pt+ 0
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
      const recips=BL.filter(p=>p===a||p===b), givers=BL.filter(p=>p!==a&&p!==b&&(base[p]||0)>0);
      if (recips.length && givers.length) {
        const cl = clarCurve(bloc2(perc,BL));
        const comp = Math.pow(Math.max(0, 1-(Math.abs(top[i][1]-top[j][1])/0.25)), 1.5);
        givers.forEach(d=>{ const mv=(base[d]||0)*GAZA_RATE*TSCALE*cl*comp*shield(d); out[d]-=w*mv; recips.forEach(r=>{ out[r]+=w*mv/recips.length; }); });
      }
    }
  });
  return out;
}

const NET_OF_2024 = (1/3)/(2/3);  // 2024 realisation = TSCALE*0.5 = 1/3 (2019->24 backtest, boundary-stable seats ~0.3); subtract tactical flows already embedded in the 2024 result (left-bloc donors)
const NET_DONORS = ['LAB','LDM','GRN'];   // 2024 tactical voting was an anti-Conservative, left-bloc phenomenon
const NET_DONORS_SC = ['LAB','LDM','GRN','SNP'];
const CONC_RESCALE = (typeof process!=='undefined'&&process.env&&process.env.CONC) ? true : false;
const GAZA_RATE = 0.65;   // stated-equivalent rate Green<->pro-Gaza IND/WPB (like GRN->LAB vs RFM 0.63)
const GAZA_MIN_IND = 0.10, GAZA_MIN_MUS = 0.10;   // seats: organised IND/WPB (>=10% base) with >=10% Muslim population, plus the listed seats
const CONTEST_SIGMA = 0.04, CROSS_BLOC_SALIENCE = 0.25;
const _Q_unused = (()=>{ const n=41,xs=[],ws=[]; for(let k=0;k<n;k++){const z=-4+8*k/(n-1);xs.push(z);ws.push(Math.exp(-z*z/2));} const t=ws.reduce((a,b)=>a+b,0); return {xs,ws:ws.map(w=>w/t)}; })();
function Phi(z){ const t=1/(1+0.2316419*Math.abs(z)); const d=0.3989423*Math.exp(-z*z/2);
  const p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274)))); return z>0?1-p:p; }
// P(parties i,j both finish above every other listed party) = integral over m = max(rest) of
// dF_max(m) * P(x_i>m) * P(x_j>m). One shared grid of normal CDFs per seat -> fast enough for the MC.
function pairWeights(top, scot){
  const s=CONTEST_SIGMA, n=top.length, G=121;
  const vs=top.map(t=>t[1]), lo=Math.min(...vs)-5*s, hi=Math.max(...vs)+5*s;
  const grid=[]; for(let g=0;g<G;g++) grid.push(lo+(hi-lo)*g/(G-1));
  const F=top.map(t=>grid.map(m=>Phi((m-t[1])/s)));
  const pairs=[];
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++){
    const rest=[...Array(n).keys()].filter(k=>k!==i&&k!==j);
    let pr=0, prevFM=0;
    for(let g=0;g<G;g++){
      let FM=1; rest.forEach(k=>{ FM*=F[k][g]; });
      if(g>0){ const Si=1-(F[i][g]+F[i][g-1])/2, Sj=1-(F[j][g]+F[j][g-1])/2; pr+=(FM-prevFM)*Si*Sj; }
      prevFM=FM;
    }
    const cross= scot ? (SC_BLOC[top[i][0]] && SC_BLOC[top[j][0]] && SC_BLOC[top[i][0]]!==SC_BLOC[top[j][0]])
                      : ((LEFT.has(top[i][0])&&RIGHT.has(top[j][0]))||(RIGHT.has(top[i][0])&&LEFT.has(top[j][0])));
    pairs.push({i,j,w:pr*(cross?1+CROSS_BLOC_SALIENCE:1)});
  }
  const t=pairs.reduce((a,p)=>a+p.w,0)||1; pairs.forEach(p=>p.w/=t);
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
    const t = seatTactical(base, s.incumbent2024, s.a24, gaza, (s.engine==='Scotland'));
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
  for(const eng in pre){ ratio[eng]={}; CANON.forEach(p=> ratio[eng][p]= (p==='MIN'||p==='OTH'||p==='WPB') ? 1 : (post[eng][p]>0?pre[eng][p]/post[eng][p]:1)); }
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
      raw[p] = k!=null ? (t[p]||0)*(1 + k*((ptop[s.code]||{})[p]||0)) : (t[p]||0)*(r[p]!=null?r[p]:1); });
    const tot=CANON.reduce((a,p)=>a+raw[p],0);
    const sh={}; CANON.forEach(p=> sh[p]= tot>0?raw[p]/tot:0);
    out[s.code]=sh;
  });
  return out;
}



const TV = { apply, seatTactical, F, S };
/* ElectionMapsUK nowcast engine — client-side port.
   runNowcast(inputs, data)  ->  { aggregateSeats, individualSeatResults }
   Pure functions; no DOM, no globals. Works in browser and Node.        */

const CONFIG = {
  jcurve: { pivot: 0.32, baseMult: 0.30, leftSlope: 1.0, rightSlope: 0.5, floor: 0.10, ceiling: 0.90 },   // leftSlope 1.2 -> 1.0 (24 Sep 2026)
  greenPenalty: { floor: 0.05, conWeight: 0.9, refWeight: 0.15, satWeight: 0, rightPivot: 0.42, rightExtra: 0, rightFloorDrop: 1.0 },   // restored 23 Sep 2026 (CON/RFM weights only; saturation + right-extra stay off)
  defectors: [
    { code:'E14001375', from:'CON', to:'RFM', personalVote:3, moved:false },  // Robert Jenrick, Newark
    { code:'E14001217', from:'CON', to:'RFM', personalVote:2, moved:false },  // Danny Kruger, East Wiltshire
    { code:'E14001233', from:'CON', to:'RFM', personalVote:2, moved:false },  // Suella Braverman, Fareham and Waterlooville
    { code:'E14001448', from:'CON', to:'RFM', personalVote:2, moved:false },  // Andrew Rosindell, Romford
  ],  // [{code, from, to, personalVote(pp), moved}] stayer: transfer pp old->new + shield follows MP; mover: strip old-seat incumbency
  blend: { transition: 8/12, yougov: 2/12, surv: 1/12, mic: 1/12 },   // STM + MRPs (YouGov 26 Sep, Survation/38 Degrees 24 Sep, More in Common)
  minorsFromModel: true,   // MIN + OTH from the main model only; MRPs blended for named parties within the rest
  greenMuslimTilt: 1.0, // log-multiplier on Green vote per unit Muslim share (seats WITHOUT a standing Gaza-IND/WPB); refitted to GM mayoral 2026 after adding indAbsentSeats
  greenMuslimTiltLondon: 0,   // London local elections 2026: Muslim-area anti-Labour vote went to local independents, not Greens -> no tilt in London
  indAbsentSeats: [],   // DEFAULT: every 2024 candidate stands again. List seats here only where told otherwise (40% of their vote -> Green)
  indToGreenShare: 0.4,
  indStandingThreshold: 0.10,   // seats with >=10% IND/WPB base vote: that candidate assumed standing -> no Green Muslim tilt
  greenIndBlocSeats: ['E14001196','E14001098','E14001327','E14001096','E14001120','E14001100','E14001102','E14001095','E14001477','E14001416','E14001118','E14001562','E14001094','E14001433','E14001346'],  // Dewsbury, Perry Barr, Leicester S, Ladywood, Bradford W, Yardley, Blackburn, Hodge Hill, Slough, Oldham W, Bradford E, Walsall, Hall Green, Preston, Luton S       // seats with an organised Gaza-IND/WPB challenger standing -> NO Green Muslim tilt
  scaleMRPbyRestore: true,
  pools: { gb: 28028812, scotland: 2414810, wales: 1319076, london: 3333200 },
  othersExponent: { transition: 4, mrp: 11 },

  // ---- Regional anchoring (EDIT HERE) ----------------------------------
  // For each nation: the regional poll baseline, and the GB-wide ("UK at time")
  // shares when that regional poll was taken. When a visitor changes a GB share,
  // the regional share moves from its baseline by a blend of additive (uniform)
  // and proportional swing. Numbers are shares 0-1 (e.g. 0.181 = 18.1%).
  regionalAnchor: {
    // national = GB-wide at the central projection; regional = that nation at the central projection.
    // Auto-generated by update_central.py from central_inputs.json.
    Scotland: { national:{LAB:0.266,CON:0.203,RFM:0.234,LDM:0.101,GRN:0.101,RES:0.038},
                regional:{LAB:0.1796,CON:0.1095,RFM:0.1618,LDM:0.0912,GRN:0.0709,RES:0.0318} },
    Wales:    { national:{LAB:0.266,CON:0.203,RFM:0.234,LDM:0.101,GRN:0.101,RES:0.038},
                regional:{LAB:0.2065,CON:0.1405,RFM:0.2198,LDM:0.0486,GRN:0.0747,RES:0.028} },
    London:   { national:{LAB:0.266,CON:0.203,RFM:0.234,LDM:0.101,GRN:0.101,RES:0.038},
                regional:{LAB:0.3236,CON:0.2031,RFM:0.1655,LDM:0.1203,GRN:0.1522,RES:0.0222} },
  },
  regionalSwingMix: 0.5,   // (unused since 24 Sep 2026: regional swing now uses the J-curve, see regionalSwing)
  // When SNP/Plaid fall below their central level the freed vote is re-spread to the main
  // parties (mostly LAB/GRN) instead of leaking to MIN/OTH. natBaseline = central nationalist
  // shares (kept in sync by update_central.py). Set a weight to 0 to exclude a party.
  natBaseline: { SNP: 0.308, PLC: 0.234 },
  natRealloc: {   // where SNP/Plaid losses go, per nation (must each sum to ~1, MIN included)
    Scotland: { LAB: 0.35, GRN: 0.30, LDM: 0.15, CON: 0.05, RFM: 0.00, MIN: 0.15 },
    Wales:    { LAB: 0.40, GRN: 0.25, LDM: 0.10, CON: 0.05, RFM: 0.05, MIN: 0.15 },
  },
  natReallocRamp: 0.03,    // recipient eligibility fades in 0->full as its share goes 0->3% (smooth, no cliff)
  minElasticity: 0.4,      // how much independents/MIN shares move with the swing (display dynamics)
  // ----------------------------------------------------------------------
  blocs: { left:['LAB','GRN','LDM'], right:['CON','RFM','RES'], nationalist:['SNP','PLC'], neutral:['MIN','OTH','WPB'] },
  blocProtection: { strength: 0.4, deadband: 0.03 },   // soft bumpers (B2)
  cleanNormalise: true,                                // single clean normalisation (B2)
  // --- Special seats: real local polls / by-election results, swung to the current national
  // picture (50/50 additive + proportional) then blended 50/50 with the normal model output. ---
  specialMix: 0.5,    // within the swing: 0 = pure proportional, 1 = pure additive
  specialBlend: 0.5,  // 0 = ignore the poll, 1 = use only the swung poll, 0.5 = even mix with model
  specialSeats: {
    'E14001455': { name:'Runcorn and Helsby',  // 1 May 2025 by-election
      natAtTime:{LAB:0.234,CON:0.196,RFM:0.282,LDM:0.139,GRN:0.087,RES:0.027,OTH:0.035},
      seatPoll: {LAB:0.387,CON:0.072,RFM:0.387,LDM:0.029,GRN:0.071,RES:0,    OTH:0.054} },
    'E14001251': { name:'Gorton and Denton',
      natAtTime:{LAB:0.198,CON:0.188,RFM:0.282,LDM:0.125,GRN:0.141,RES:0.027,OTH:0.039},
      seatPoll: {LAB:0.254,CON:0.019,RFM:0.287,LDM:0.018,GRN:0.406,RES:0,    OTH:0.016} },
    'E14001256': { name:'Great Yarmouth', blend:0.75,  // local poll, 7 May (weighted 75% to the poll)
      natAtTime:{LAB:0.191,CON:0.181,RFM:0.272,LDM:0.120,GRN:0.144,RES:0.033,OTH:0.029},
      seatPoll: {LAB:0.090,CON:0.120,RFM:0.200,LDM:0.030,GRN:0.110,RES:0.460,OTH:0.000} },
    'E14001350': { name:'Makerfield',  // by-election (nationwide poll at the time below)
      natAtTime:{LAB:0.195,CON:0.186,RFM:0.274,LDM:0.123,GRN:0.130,RES:0.028,OTH:0.023},
      seatPoll: {LAB:0.548,CON:0.022,RFM:0.345,LDM:0.004,GRN:0.007,RES:0.068,OTH:0.006} },
    'S14000061': { name:'Aberdeen South',  // by-election
      natAtTime:{LAB:0.195,CON:0.186,RFM:0.274,LDM:0.123,GRN:0.130,RES:0.028,SNP:0.329,OTH:0.018},
      seatPoll: {CON:0.495,SNP:0.286,RFM:0.086,LAB:0.054,LDM:0.044,GRN:0.034,RES:0,OTH:0.002} },
    'S14000066': { name:'Arbroath and Broughty Ferry',  // by-election
      natAtTime:{LAB:0.195,CON:0.186,RFM:0.274,LDM:0.123,GRN:0.130,RES:0.028,SNP:0.329,OTH:0.018},
      seatPoll: {SNP:0.411,CON:0.194,RFM:0.182,LAB:0.153,LDM:0.061,GRN:0,RES:0,OTH:0} },
  },
};

const ENGINE_PARTIES = {
  EngExLondon: ['LAB','CON','RFM','LDM','GRN','RES','MIN','OTH'],
  London:      ['LAB','CON','RFM','LDM','GRN','RES','MIN','OTH'],
  Scotland:    ['LAB','CON','RFM','LDM','GRN','SNP','RES','MIN','OTH'],
  Wales:       ['LAB','CON','RFM','LDM','GRN','PLC','RES','MIN','OTH'],
};
const MAIN_BY_ENGINE = {
  EngExLondon: ['LAB','CON','RFM','LDM','GRN','RES'],
  London:      ['LAB','CON','RFM','LDM','GRN','RES'],
  Scotland:    ['LAB','CON','RFM','LDM','GRN','SNP','RES'],
  Wales:       ['LAB','CON','RFM','LDM','GRN','PLC','RES'],
};

// ---------- helpers ----------
const sum = a => a.reduce((x,y)=>x+y,0);
const clamp = (x,lo,hi) => Math.max(lo, Math.min(hi, x));

// J-curve weak-vote portion of a party's base share
function weakVote(base, opts, cfg, party) {
  const jp = party && cfg.jcurveByParty && cfg.jcurveByParty[party];
  const j = jp ? Object.assign({}, cfg.jcurve, jp) : cfg.jcurve;
  let raw = base < j.pivot ? j.baseMult + (j.pivot - base)*j.leftSlope
                           : j.baseMult + (base - j.pivot)*j.rightSlope;
  let floor = j.floor;
  if (opts && opts.greenPenalty) {
    const g = cfg.greenPenalty;
    raw = raw - (opts.con*g.conWeight + opts.ref*g.refWeight) - base*g.satWeight;
    floor = g.floor;
    // Extra suppression in right-wing (rural) seats: once the combined CON+RFM
    // base exceeds rightPivot, cut the Green weak-vote further AND drop the floor
    // so it can bite even where high CON already clamps raw to the floor.
    if (g.rightExtra) {
      const over = (opts.con + opts.ref) - g.rightPivot;
      if (over > 0) {
        raw   -= over * g.rightExtra;
        floor  = Math.max(0, g.floor - over * (g.rightFloorDrop || 0));
      }
    }
  }
  return base * clamp(raw, floor, j.ceiling);
}

// ---------- Stage 1: regional target vectors from national inputs ----------
function regionalTargets(inp, cfg) {
  const P = cfg.pools;
  const main = ['LAB','CON','RFM','LDM','GRN','RES'];
  const gbV = {}; main.forEach(p => gbV[p] = (inp.gb[p]||0)*P.gb);
  // SNP/Plaid exist only in their nations - keep their GB-equivalent vote OUT of GB 'OTH'
  // (otherwise unallocated nationalist vote inflates OTH and trips the ^10 minor-suppression).
  const snpGB = (inp.scotland&&inp.scotland.SNP||0)*P.scotland;
  const plcGB = (inp.wales&&inp.wales.PLC||0)*P.wales;
  gbV.OTH = Math.max(0, P.gb - sum(main.map(p=>gbV[p])) - snpGB - plcGB);

  const regionVotes = (share, pool, extra) => {
    const v = {}; main.forEach(p => v[p] = (share[p]||0)*pool);
    let used = sum(main.map(p=>v[p]));
    if (extra) { v[extra.key] = (share[extra.key]||0)*pool; used += v[extra.key]; }
    v.OTH = pool - used;            // residual (absorbs nationalist where not broken out)
    return v;
  };
  const scotV = regionVotes(inp.scotland, P.scotland, {key:'SNP'});
  const walesV = regionVotes(inp.wales,   P.wales,   {key:'PLC'});
  const lonRES = (inp.london.RES!=null)? inp.london.RES : (inp.gb.RES||0);
  const lonShare = Object.assign({}, inp.london, {RES: lonRES});
  const lonV = regionVotes(lonShare, P.london, null);

  // England-excl-London residual over {main6, OTH}
  const cols = ['LAB','CON','RFM','LDM','GRN','RES','OTH'];
  const engV = {}; cols.forEach(p => engV[p] = Math.max(0, gbV[p] - scotV[p] - walesV[p] - lonV[p]));
  const engTot = sum(cols.map(p=>engV[p]));
  const engShare = {}; cols.forEach(p => engShare[p] = engTot>0 ? engV[p]/engTot : 0);

  const lonTot = sum(cols.map(p=>lonV[p]));
  const lonShareN = {}; cols.forEach(p => lonShareN[p] = lonTot>0 ? lonV[p]/lonTot : 0);

  return {
    EngExLondon: pick(engShare,   MAIN_BY_ENGINE.EngExLondon),
    London:      pick(lonShareN,  MAIN_BY_ENGINE.London),
    Scotland:    pick(inp.scotland, MAIN_BY_ENGINE.Scotland),   // direct inputs
    Wales:       pick(inp.wales,    MAIN_BY_ENGINE.Wales),
  };
}
function pick(obj, keys){ const o={}; keys.forEach(k=>o[k]=obj[k]||0); return o; }

// Regional anchoring: move a region's LAB/CON/RFM/LDM/GRN from its baseline by a
// blend of additive (uniform) and proportional swing as GB shares change.
function regionalSwing(gb, region, cfg){
  // J-CURVE REGIONAL SWING (all parties). The four regions (Scotland, Wales, London and the implied
  // England-excl-London) are treated like seats in the swing model: each region's baseline share
  // splits into a 'strong' part and a J-curve 'weak' (swingable) part; the GB change is shared out in
  // proportion to each region's weak vote (pool-weighted), so the GB total always matches. At the
  // anchor GB figures every region returns exactly its baseline. A small party grows roughly in
  // proportion to where it already is; a big party's swing is damped where it is strongest.
  const P=cfg.pools, R=['Scotland','Wales','London'], PE=P.gb-P.scotland-P.wales-P.london;
  const pool={Scotland:P.scotland, Wales:P.wales, London:P.london, EngExLondon:PE};
  const out={};
  ['LAB','CON','RFM','LDM','GRN','RES'].forEach(p=>{
    const nb=cfg.regionalAnchor[region].national[p]||0, g=gb[p]||0;
    const b={}; R.forEach(r=>b[r]=cfg.regionalAnchor[r].regional[p]||0);
    b.EngExLondon=Math.max(0,(nb*P.gb - R.reduce((a,r)=>a+b[r]*pool[r],0))/PE);
    const w={}, st={}; let RS=0, RW=0;
    Object.keys(pool).forEach(r=>{ w[r]=weakVote(b[r],null,cfg); st[r]=b[r]-w[r]; RS+=st[r]*pool[r]/P.gb; RW+=w[r]*pool[r]/P.gb; });
    out[p] = g>=RS ? st[region] + w[region]*(RW>0?(g-RS)/RW:0) : (RS>0 ? st[region]*(g/RS) : 0);
    out[p] = Math.max(0,out[p]);
  });
  return out;
}
// scale LAB..GRN proportionally so they fill `room` (=1-SNP/PLC-RES): SNP/PLC changes
// leak proportionally to/from the other parties instead of all to "others".
function scaleToRoom(obj, room){
  const keys=['LAB','CON','RFM','LDM','GRN']; const s=keys.reduce((a,k)=>a+(obj[k]||0),0);
  if(room<=0){ keys.forEach(k=>obj[k]=0); }
  else if(s>0){ const f=room/s; keys.forEach(k=>obj[k]=(obj[k]||0)*f); }
}
// Expand compact inputs {gb:{LAB..RES}, snpScotland, plcWales} into full regional inputs.
// Re-spread freed nationalist vote (SNP/Plaid below central) onto the mains, weighted to LAB/GRN.
function reallocNat(obj, key, baseline, w, cfg_ramp){ if(baseline==null||!w) return; const d=baseline-(obj[key]||0);
  // Only redistribute to parties still standing (>= floor). A party the user has zeroed must NOT
  // receive freed SNP/Plaid vote; its weight is shared among the surviving recipients (or, if none
  // qualify, the freed vote goes to the largest remaining party). MIN takes its fixed slice.
  const recips=['LAB','CON','RFM','LDM','GRN'], ramp=(cfg_ramp||0.03);
  let wsum=0; const eff={}; recips.forEach(function(p){ var v=Math.min(1,Math.max(0,(obj[p]||0)/ramp)); eff[p]=(w[p]||0)*v; wsum+=eff[p]; });
  const minPart=d*(w.MIN||0), mainPart=d-minPart;
  if(wsum>1e-6){ recips.forEach(function(p){ obj[p]=Math.max(0,(obj[p]||0)+mainPart*eff[p]/wsum); }); }
  else { var top=null,tv=-1; recips.forEach(function(p){ if((obj[p]||0)>tv){ tv=obj[p]||0; top=p; } }); if(top) obj[top]=Math.max(0,(obj[top]||0)+mainPart); }
  obj._minAdd=(obj._minAdd||0)+minPart; }
function expandInputs(c, cfg){
  const gb = c.gb;
  // Restore now comes straight from the regional anchor (regionalSwing), like the other main
  // parties - the regional RES inputs are used directly instead of a GB * scale factor.
  const sc = regionalSwing(gb,'Scotland',cfg); sc.SNP=c.snpScotland||0;
  const wa = regionalSwing(gb,'Wales',cfg);    wa.PLC=c.plcWales||0;
  reallocNat(sc,'SNP',cfg.natBaseline&&cfg.natBaseline.SNP,cfg.natRealloc&&cfg.natRealloc.Scotland,cfg.natReallocRamp);
  reallocNat(wa,'PLC',cfg.natBaseline&&cfg.natBaseline.PLC,cfg.natRealloc&&cfg.natRealloc.Wales,cfg.natReallocRamp);
  const lo = regionalSwing(gb,'London',cfg);
  return { gb, scotland:sc, wales:wa, london:lo };
}

// add suppressed MIN/OTH targets, mirroring  L5 = L4 / (sum(newMain)/sum(oldMain))^exp
function withMinorTargets(mainTarget, ge2024, engine, exp) {
  const mainKeys = MAIN_BY_ENGINE[engine];
  const ratio = sum(mainKeys.map(p=>mainTarget[p])) / sum(mainKeys.map(p=>ge2024[p]||0));
  const t = Object.assign({}, mainTarget);
  ['MIN','OTH'].forEach(p => { t[p] = (ge2024[p]||0) / Math.pow(ratio, exp); });
  return t;
}

// ---------- Stage 2-3: J-curve swing for one engine ----------
function swingEngine(seatsR, target, parties, cfg, opts) {
  // per-seat weak/strong
  const rows = seatsR.map(s => {
    const weak={}, strong={};
    parties.forEach(p => {
      const base = s.base[p]||0;
      const o = (p==='GRN' && opts.greenPenalty) ? {greenPenalty:true, con:s.base.CON||0, ref:s.base.RFM||0} : null;
      weak[p] = weakVote(base, o, cfg, p);
      strong[p] = base - weak[p];
    });
    return {s, weak, strong};
  });
  // regional aggregates (simple average, as the sheet's AVERAGE)
  const n = rows.length;
  const RStrong={}, RWeak={}, mult={};
  parties.forEach(p => {
    RStrong[p] = sum(rows.map(r=>r.strong[p]))/n;
    RWeak[p]   = sum(rows.map(r=>r.weak[p]))/n;
    mult[p]    = RWeak[p]>0 ? Math.max(0, (target[p]||0) - RStrong[p]) / RWeak[p] : 0;
  });
  // per-seat final vote, then calibrate region aggregate to target
  rows.forEach(r => {
    const fin={};
    parties.forEach(p => {
      const t=target[p]||0, st=r.strong[p], wk=r.weak[p], rs=RStrong[p];
      // insurgentSpread[p] reroutes a rising party's gain from base-proportional (wk*mult)
      // toward a uniform component (RWeak*mult), so surging parties grow broadly rather
      // than super-proportionally in their existing strongholds. Aggregate is preserved.
      const sp=(cfg.insurgentSpread&&cfg.insurgentSpread[p])||0;
      const amp = sp>0 ? mult[p]*((1-sp)*wk + sp*RWeak[p]) : wk*mult[p];
      fin[p] = t >= rs ? st + amp : (rs>0 ? st*(t/rs) : 0);
      fin[p] = Math.max(0, fin[p]);
    });
    // Green realignment: real 2026 votes (GM mayoral by-election, by constituency) show Greens now
    // outperforming the proportional swing in Muslim-heavy seats. Tilt the Green vote by
    // exp(k * Muslim share); the calibration below keeps each engine's Green total on target.
    { const k = (r.s.engine==='London' && cfg.greenMuslimTiltLondon!=null) ? cfg.greenMuslimTiltLondon : cfg.greenMuslimTilt;
      if (k && fin.GRN!=null && r.s.mus) {
        const m = Math.exp(k * r.s.mus);
        // seats with an organised Gaza-independent/WPB standing again: that vote already realigned in 2024 -> no extra tilt
        const indStanding = (cfg.greenIndBlocSeats||[]).includes(r.s.code) ||
              (((r.s.base&&r.s.base.MIN)||0) >= (cfg.indStandingThreshold||0.10) && !(cfg.indAbsentSeats||[]).includes(r.s.code));
        if (!indStanding) fin.GRN *= m;
      } }
    const tot = sum(parties.map(p=>fin[p]));
    r.share = {}; parties.forEach(p => r.share[p] = tot>0 ? fin[p]/tot : 0);
  });
  // calibrate: aggregate share by votes, scale each seat so region hits target
  const aggShare = {};
  const totVotes = sum(rows.map(r => r.s.electorate*r.s.turnout));
  parties.forEach(p => {
    const v = sum(rows.map(r => r.share[p]*r.s.electorate*r.s.turnout));
    aggShare[p] = totVotes>0 ? v/totVotes : 0;
  });
  rows.forEach(r => {
    const out={};
    parties.forEach(p => {
      const t=target[p]||0;
      out[p] = aggShare[p]>0 ? r.share[p]*(t/aggShare[p]) : r.share[p];
    });
    // 2024 Gaza-independent / WPB not standing again: GM 2026 evidence -> ~40% of that vote goes Green,
    // the rest spreads proportionally over the other parties.
    if ((cfg.indAbsentSeats||[]).includes(r.s.code) && out.MIN>0) {
      const mv=out.MIN, g=mv*(cfg.indToGreenShare||0), rest=mv-g; out.MIN=0; out.GRN=(out.GRN||0)+g;
      const others=parties.filter(p=>p!=='MIN'&&p!=='GRN'), ot=sum(others.map(p=>out[p]||0));
      if (ot>0) others.forEach(p=>{ out[p]+=rest*(out[p]||0)/ot; });
    }
    r.calib = out;
  });
  return rows;
}

// ---------- Stage 5: MRP swing — run PER NATION (SNP/PLC are nation-specific) ----------
const MRP_PARTIES = ['LAB','CON','RFM','LDM','GRN','RES','SNP','PLC','OTH'];   // RES: only MRPs that report Restore (YouGov from Sep 2026) carry it
function mrpSwing(seats, mrpKey, targetForNation, cfg) {
  const out={};
  // swing each MRP separately within each of the model's four regions (England-excl-London, London,
  // Scotland, Wales) so e.g. MRP London Labour is swung to the London row, not the GB row
  ['EngExLondon','London','Scotland','Wales'].forEach(engine=>{
    const target = targetForNation(engine);
    const rows = seats.filter(s=>s[mrpKey] && s.engine===engine).map(s=>{
      const weak={}, strong={};
      MRP_PARTIES.forEach(p=>{ const b=s[mrpKey][p]||0; weak[p]=weakVote(b,null,cfg); strong[p]=b-weak[p]; });
      return {s, weak, strong};
    });
    const n=rows.length; if(!n) return;
    const RStrong={}, RWeak={}, mult={};
    MRP_PARTIES.forEach(p=>{
      RStrong[p]=sum(rows.map(r=>r.strong[p]))/n;
      RWeak[p]=sum(rows.map(r=>r.weak[p]))/n;
      mult[p]=RWeak[p]>0?Math.max(0,(target[p]||0)-RStrong[p])/RWeak[p]:0;
    });
    rows.forEach(r=>{
      const fin={};
      MRP_PARTIES.forEach(p=>{ const t=target[p]||0,st=r.strong[p],wk=r.weak[p],rs=RStrong[p];
        fin[p]=Math.max(0, t>=rs? st+wk*mult[p] : (rs>0?st*(t/rs):0)); });
      const tot=sum(MRP_PARTIES.map(p=>fin[p]));
      const sh={}; MRP_PARTIES.forEach(p=> sh[p]= tot>0?fin[p]/tot:0);
      out[r.s.code]=sh;
    });
  });
  return out;
}

// ---------- Stage 6b: soft bloc bumpers ----------
function applySpecialSeats(seatShares, inputs, cfg){
  const sp=cfg.specialSeats; if(!sp) return;
  const P=cfg.pools, mains=['LAB','CON','RFM','LDM','GRN','RES'];
  const snpGB=((inputs.scotland&&inputs.scotland.SNP)||0)*P.scotland/P.gb;
  const plcGB=((inputs.wales&&inputs.wales.PLC)||0)*P.wales/P.gb;
  const curBase={}; let ms=0; mains.forEach(p=>{ curBase[p]=inputs.gb[p]||0; ms+=curBase[p]; });
  curBase.OTH=Math.max(0, 1-ms-snpGB-plcGB);
  const snpNow=((inputs.scotland&&inputs.scotland.SNP)||0), plcNow=((inputs.wales&&inputs.wales.PLC)||0);
  const mix=cfg.specialMix, keys=['LAB','CON','RFM','LDM','GRN','RES','SNP','PLC','OTH'];
  seatShares.forEach(x=>{
    const sd=sp[x.s.code]; if(!sd) return;
    const blend=(sd.blend!=null)?sd.blend:cfg.specialBlend;
    const curNat=Object.assign({}, curBase);
    curNat.SNP = (x.s.nation==='Scotland') ? snpNow : 0;   // SNP/Plaid only swing in their own nation
    curNat.PLC = (x.s.nation==='Wales') ? plcNow : 0;
    const est={}; let es=0;
    keys.forEach(p=>{ const sv=sd.seatPoll[p]||0, nt=sd.natAtTime[p]||0, cn=curNat[p]||0;
      const add=sv+(cn-nt), prop=nt>0?sv*(cn/nt):sv; est[p]=Math.max(0, mix*add+(1-mix)*prop); es+=est[p]; });
    if(es>0) keys.forEach(p=>est[p]/=es);
    const f=x.final, fM=f.MIN||0, fO=f.OTH||0, os=fM+fO, rM=os>0?fM/os:1;
    const out={}; CANON.forEach(p=>out[p]=(1-blend)*(f[p]||0));
    keys.forEach(p=>{ if(p==='OTH'){ out.MIN+=blend*est.OTH*rM; out.OTH+=blend*est.OTH*(1-rM); } else out[p]+=blend*est[p]; });
    let ts=0; CANON.forEach(p=>ts+=out[p]); if(ts>0) CANON.forEach(p=>out[p]/=ts);
    x.final=out;
  });
}
function applyBlocBumpers(seatShares, inputs, cfg) {
  const bp = cfg.blocProtection || {};
  if (!bp.strength || bp.strength <= 0) return;
  const totVotes = sum(seatShares.map(x => x.s.electorate*x.s.turnout));
  const agg = {};
  CANON.forEach(p => {
    agg[p] = sum(seatShares.map(x => (x.final[p]||0)*x.s.electorate*x.s.turnout)) / totVotes;
  });
  const blocTargets = {
    left:  (inputs.gb.LAB||0)+(inputs.gb.GRN||0)+(inputs.gb.LDM||0),
    right: (inputs.gb.CON||0)+(inputs.gb.RFM||0)+(inputs.gb.RES||0),
  };
  const factor = {}; CANON.forEach(p => factor[p] = 1);
  ['left','right'].forEach(bl => {
    const members = cfg.blocs[bl];
    const blocAgg = sum(members.map(p => agg[p]||0));
    const target = blocTargets[bl];
    if (blocAgg > 0 && blocAgg < target - bp.deadband) {
      const boosted = blocAgg + bp.strength * ((target - bp.deadband) - blocAgg);
      const f = boosted / blocAgg;
      members.forEach(p => factor[p] = f);
    }
  });
  if (CANON.every(p => factor[p] === 1)) return;
  seatShares.forEach(x => {
    CANON.forEach(p => x.final[p] = (x.final[p]||0)*factor[p]);
    const t = sum(CANON.map(p => x.final[p]));
    CANON.forEach(p => x.final[p] = t>0 ? x.final[p]/t : 0);
  });
}

// ---------- Stage 4: tactical voting (clarity model) ----------


// ---------- top level ----------
function runNowcast(inputs, data, cfgOverride) {
  const cfg = Object.assign({}, CONFIG, cfgOverride||{});
  let seats = data.seats;
  if (cfg.defectors && cfg.defectors.length) {   // defectors: reassign the incumbency/tactical shield (stayer -> new party; mover -> none)
    const dm={}; cfg.defectors.forEach(d=>dm[d.code]=d);
    seats = seats.map(s=>{ const d=dm[s.code]; return d ? Object.assign({}, s, { incumbent2024: d.moved ? '' : d.to }) : s; });
  }
  const cd = data.config_data;

  // Compact inputs ({gb, snpScotland, plcWales}) get expanded via regional anchoring.
  // Full inputs (with .scotland/.wales/.london, e.g. the GE2024 preset) are used as-is.
  if (inputs && inputs.gb && !inputs.scotland) inputs = expandInputs(inputs, cfg);

  // Stage 1
  const targets = regionalTargets(inputs, cfg);

  // Stage 2-3: transition model per engine -> calibrated shares per seat
  const transShare = {};   // code -> {party:share} (10-party canon)
  ['EngExLondon','London','Scotland','Wales'].forEach(engine=>{
    const parties = ENGINE_PARTIES[engine];
    const tgt = withMinorTargets(targets[engine], cd.region_ge2024[engine], engine, cfg.othersExponent.transition);
    if(engine==='Scotland' && inputs.scotland) tgt.MIN=(tgt.MIN||0)+Math.max(0,inputs.scotland._minAdd||0);
    if(engine==='Wales' && inputs.wales) tgt.MIN=(tgt.MIN||0)+Math.max(0,inputs.wales._minAdd||0);
    const seatsR = seats.filter(s=>s.engine===engine);
    const rows = swingEngine(seatsR, tgt, parties, cfg, {greenPenalty: !!cfg.greenPenalty});
    rows.forEach(r=>{ const o={}; CANON.forEach(p=>o[p]=r.calib[p]||0);
      // Workers Party as a SECOND minor (seat's main minor is an independent): carve it out of OTH in
      // proportion to its 2024 share of the starting OTH, so it can take part in Gaza tactical voting.
      const s=r.s; if(s.wpbOth>0 && (s.minType||'MIN')!=='WPB' && o.OTH>0){ const b=(s.base&&s.base.OTH)||0; const w=b>0?Math.min(o.OTH,o.OTH*s.wpbOth/b):0; o.WPB=w; o.OTH-=w; }
      transShare[r.s.code]=o; });
  });

  // Stage 4: tactical voting on the transition shares
  const tvShare = cfg.noTactical ? transShare : TV.apply(seats, transShare, cfg);

  // Stage 5: MRP swings toward inputs — main parties = GB inputs; SNP/PLC per nation
  const mrpTarget = (baseline) => (engine) => {
    // each region's own targets (same as the swing model's): Scotland/Wales/London rows, and the
    // implied England-excl-London residual - not the GB row.
    const m = targets[engine];
    const t = { LAB:m.LAB, CON:m.CON, RFM:m.RFM, LDM:m.LDM, GRN:m.GRN, RES:(baseline.RES>0 ? (m.RES||0) : 0),
                SNP: engine==='Scotland' ? (m.SNP||0) : 0,
                PLC: engine==='Wales'    ? (m.PLC||0) : 0 };
    return withMRPMinor(t, baseline, cfg);
  };
  const MRPK = Object.keys(cfg.blend).filter(k=>k!=='transition' && cd.mrp_baseline[k]);
  const MR = {}; MRPK.forEach(k=>{ MR[k]=mrpSwing(seats, k, mrpTarget(cd.mrp_baseline[k]), cfg); });

  // Stage 6: blend -> per-seat final shares
  const MAINP=['LAB','CON','RFM','LDM','GRN','SNP','PLC'];
  const seatShares = seats.map(s=>{
    const tv = tvShare[s.code] || transShare[s.code];
    const res = tv.RES||0;
    // An MRP that reports Restore (baseline RES>0) is used as-is; one that doesn't (MiC, Survation)
    // has its shares scaled by (1-RES) and takes Restore from the STM.
    const hasRes = key => (cd.mrp_baseline[key]||{}).RES>0;
    const K = {}; MRPK.forEach(k=>{ K[k]=(cfg.scaleMRPbyRestore && !hasRes(k))?(1-res):1; });
    const final = {};
    if (cfg.minorsFromModel) {
      // Independents (MIN) and other minor parties (OTH) both come from the main model only; the MRPs
      // are blended for the named parties WITHIN the remaining (1 - MIN - OTH) of the vote, each MRP's
      // own 'Other' removed first (it largely IS the independent vote, which would double-count it).
      const minor=(tv.MIN||0)+(tv.OTH||0)+(tv.WPB||0), room=1-minor;
      const keys=[...MAINP,'RES'];
      const norm=src=>{ const t=keys.reduce((a,p)=>a+((src&&src[p])||0),0); const o={}; keys.forEach(p=>o[p]=t>0?((src&&src[p])||0)/t:0); return o; };
      const stm=norm(tv);
      const mrps=MRPK.map(k=>{ const m=MR[k][s.code]; if(!m) return null; const x=Object.assign({},m); if(!hasRes(k)) x.RES=res/(1-minor||1)*keys.reduce((a,p)=>a+((m[p])||0),0); return {w:cfg.blend[k], sh:norm(x)}; }).filter(Boolean);
      const wsum=cfg.blend.transition+mrps.reduce((a,x)=>a+x.w,0);
      keys.forEach(p=>{ final[p]=room*(cfg.blend.transition*stm[p]+mrps.reduce((a,x)=>a+x.w*x.sh[p],0))/wsum; });
      final.MIN=tv.MIN||0; final.OTH=tv.OTH||0; final.WPB=tv.WPB||0;
    } else {
    // mains: STM blended with the MRPs
    MAINP.forEach(p=>{ final[p] = cfg.blend.transition*(tv[p]||0) + MRPK.reduce((a,k)=>{ const m=MR[k][s.code]; return a+cfg.blend[k]*K[k]*((m&&m[p])||0); },0); });
    final.RES = cfg.blend.transition*res + MRPK.reduce((a,k)=>{ const m=MR[k][s.code]; return a+cfg.blend[k]*(hasRes(k)?((m&&m.RES)||0):res); },0);
    // Independents (MIN) come from the main model ONLY - MRPs don't model independents, so blending
    // would just dilute them. 'Other' (OTH) = the main model's OTH blended with each MRP's 'Others'.
    const oO=tv.OTH||0;
    final.MIN = tv.MIN||0;
    final.OTH = cfg.blend.transition*oO + MRPK.reduce((a,k)=>{ const m=MR[k][s.code]; return a+cfg.blend[k]*K[k]*((m&&m.OTH)||0); },0);
    }
    // (no MIN/OTH swap: MIN is the named minor candidate, OTH the combined rest - labels kept as in 2024)
    const tot = sum(CANON.map(p=>final[p]));
    CANON.forEach(p=> final[p] = tot>0?final[p]/tot:0);
    return { s, final };
  });

  applyBlocBumpers(seatShares, inputs, cfg);
  applySpecialSeats(seatShares, inputs, cfg);

  // Stage 7b: MP defectors (BEFORE renorm, so GB renormalisation is the final stage). Stayer ->
  // move personalVote pp old->new in that seat (incumbency shield already reassigned earlier).
  // Movers get no personal vote. Defector seats are then excluded from the renorm so the transfer
  // survives while the rest of England absorbs the national drift.
  const defectorSet = new Set();
  if(cfg.defectors && cfg.defectors.length){
    const dm={}; cfg.defectors.forEach(d=>dm[d.code]=d);
    seatShares.forEach(x=>{ const d=dm[x.s.code]; if(!d) return; defectorSet.add(x.s.code); if(d.moved) return;
      const f=x.final, pv=(d.personalVote||0)/100, mv=Math.min(pv, f[d.from]||0);
      if(mv>0){ f[d.from]-=mv; f[d.to]=(f[d.to]||0)+mv; } });
  }

  // Stage 7: REGIONAL RENORMALISATION — the FINAL stage. Each of the four regions (Scotland, Wales,
  // London, England-excl-London) is fitted so its vote-weighted party shares equal the headline
  // figures IN RATIO: in each region the named parties are split exactly in the ratio of that region's
  // row, while independents/others (MIN+OTH) keep the share the model gives them (not squeezed).
  // England-excl-London is set so the GB-wide ratio of the six mains equals the GB row. Iterative proportional fitting
  // keeps every seat summing to 100%. Special (by-election) and defector seats are excluded from the
  // adjustment so they keep their overrides; the other seats in their region absorb the difference.
  if(cfg.gbRenorm!==false)(function regionalRenorm(){
    const V=x=>x.s.electorate*x.s.turnout;
    const fixed=x=>(cfg.specialSeats&&cfg.specialSeats[x.s.code])||defectorSet.has(x.s.code);
    const OTHERS=['MIN','OTH','WPB'];
    const regIn={ London:inputs.london, Scotland:inputs.scotland, Wales:inputs.wales };
    const byReg={}; seatShares.forEach(x=>{ (byReg[x.s.engine]=byReg[x.s.engine]||[]).push(x); });
    // share of the vote the model currently gives the named parties in a region (independents/others keep the rest)
    const mainTotal=(rows,keys)=>{ let v=0,m=0; rows.forEach(x=>{ const w=V(x); v+=w; m+=w*keys.reduce((a,p)=>a+(x.final[p]||0),0); }); return v>0?m/v:0; };
    const regionTargets={};
    ['London','Scotland','Wales'].forEach(R=>{ const inp=regIn[R]||{}; const keys=CANON.filter(p=>!OTHERS.includes(p)&&(inp[p]||0)>0);
      const inSum=keys.reduce((a,p)=>a+inp[p],0), mt=mainTotal(byReg[R]||[],keys); const t={};
      CANON.forEach(p=>{ if(!OTHERS.includes(p)) t[p]=inSum>0?(inp[p]||0)/inSum*mt:0; }); regionTargets[R]=t; });
    // England-excl-London: set so GB-wide the six mains are in exactly the GB row's ratio,
    // at the mains' current GB total (independents/others not squeezed).
    const gbIn=inputs.gb||{}, M6=['LAB','CON','RFM','LDM','GRN','RES'], gbInSum=M6.reduce((a,p)=>a+(gbIn[p]||0),0);
    const Vtot=seatShares.reduce((a,x)=>a+V(x),0), VE=(byReg.EngExLondon||[]).reduce((a,x)=>a+V(x),0);
    let otherMain=0; ['London','Scotland','Wales'].forEach(R=>{ (byReg[R]||[]).forEach(x=>{ otherMain+=V(x)*M6.reduce((a,p)=>a+regionTargets[R][p],0); }); });
    const gbMainTot=(otherMain+VE*mainTotal(byReg.EngExLondon||[],M6))/Vtot;
    const tE={}; M6.forEach(p=>{ let other=0; ['London','Scotland','Wales'].forEach(R=>{ (byReg[R]||[]).forEach(x=>{ other+=regionTargets[R][p]*V(x); }); });
      tE[p]=Math.max(0,((gbIn[p]||0)/gbInSum*gbMainTot*Vtot-other)/VE); });
    tE.SNP=0; tE.PLC=0; regionTargets.EngExLondon=tE;
    Object.keys(regionTargets).forEach(R=>{
      const rows=byReg[R]||[]; if(!rows.length) return; const t=regionTargets[R];
      const mains=Object.keys(t), tOther=Math.max(0,1-mains.reduce((a,p)=>a+t[p],0));
      const Vr=rows.reduce((a,x)=>a+V(x),0);
      for(let it=0; it<(cfg.renormIters||6); it++){
        // party step: scale adjustable seats so the region total hits the target
        const scaleTo=(keys,target)=>{ let cur=0,curA=0; rows.forEach(x=>{ const v=V(x); const s_=keys.reduce((a,p)=>a+(x.final[p]||0),0); cur+=s_*v; if(!fixed(x)) curA+=s_*v; });
          const need=target*Vr-(cur-curA); const k=curA>1e-12?Math.max(0,need)/curA:1;
          rows.forEach(x=>{ if(!fixed(x)) keys.forEach(p=>{ if(x.final[p]) x.final[p]*=k; }); }); };
        mains.forEach(p=>scaleTo([p],t[p])); scaleTo(OTHERS,tOther);
        // seat step: each seat back to 100%
        rows.forEach(x=>{ if(fixed(x)) return; const f=x.final, tot=sum(CANON.map(p=>f[p]||0)); if(tot>0) CANON.forEach(p=>f[p]=(f[p]||0)/tot); });
      }
    });
  })();

  const results = seatShares.map(({s, final})=>{
    let winner = CANON.reduce((a,b)=> final[b]>final[a]?b:a, CANON[0]);  // plurality wins: the declared winner always matches the top bar (incl. MIN/WPB)
    if (s.incumbent2024==='SPKR') winner = 'SPKR';
    return { seatName:s.name, code:s.code, winner, minType:(s.minType||'MIN'),
             winner2024:s.w24||s.incumbent2024, winner2019:s.w19||null, mp:s.mp||null,
             shares:final, incumbent:s.incumbent2024 };
  });

  const order=['LAB','CON','RFM','LDM','GRN','SNP','PLC','MIN'];
  const counts={}; order.forEach(p=>counts[p]=0);
  results.forEach(r=>{ if(counts[r.winner]!=null) counts[r.winner]++; });
  return { aggregateSeats: order.map(p=>counts[p]), individualSeatResults: results,
           winnerByCode: Object.fromEntries(results.map(r=>[r.code,r.winner])) };
}

/* CANON shared from tactical */
function withMRPMinor(mainTarget, baseline, cfg){
  // Only count parties that actually stand in this nation's target. The MRP baseline stores
  // SNP/Plaid at their WITHIN-NATION share (~29%/20%); including those in England's ratio
  // (where SNP=PLC=0) collapses the denominator and the ^exp blows the OTH target past 100%.
  const mainKeys=['LAB','CON','RFM','LDM','GRN','RES','SNP','PLC'].filter(p=>(mainTarget[p]||0)>0 && (baseline[p]||0)>0);
  const den = sum(mainKeys.map(p=>baseline[p]||0));
  const ratio = den>0 ? sum(mainKeys.map(p=>mainTarget[p]||0)) / den : 1;
  // Clamp to >=1 so a regional<national mains gap can't inflate the MRP 'other' target.
  const rr = Math.max(1, ratio);
  const t=Object.assign({}, mainTarget);
  t.OTH = (baseline.OTH||0)/Math.pow(rr, cfg.othersExponent.mrp);
  return t;
}



window.NowcastEngine = { runNowcast: runNowcast, CONFIG: CONFIG, regionalTargets: regionalTargets, expandInputs: expandInputs };
})();
