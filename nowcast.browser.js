/* ElectionMapsUK nowcast engine — browser bundle (auto-generated). Do not edit; edit nowcast.js/tactical.js and re-run build_bundle.js */
(function(){
"use strict";
/* Tactical-voting model, transcribed from the 'Tactical Vote' sheet.
   Per-matchup transfer matrices (F = to 1st place, S = to 2nd place),
   logistic bloc clarity, incumbent shields, cross-bloc "hijack", and
   national vote conservation. Matchup keys are the two parties in
   alphabetical order joined by "_". All numbers are editable here.       */

const LEFT  = new Set(['LAB','LDM','GRN','SNP','PLC']);
const RIGHT = new Set(['CON','RFM']);
const RANK_PARTIES = ['LAB','CON','RFM','LDM','GRN','RES','SNP','PLC','MIN'];

// transfer-out fractions per donor party, keyed by alphabetical matchup
const F = {
  LAB:{CON_GRN:.08,CON_LDM:.06,CON_RFM:.3,GRN_LDM:.3,GRN_RFM:.76,LDM_RFM:.77,CON_SNP:.2,LDM_SNP:.2,GRN_SNP:.15,CON_PLC:.1,LDM_PLC:.1,GRN_PLC:.05},
  LDM:{CON_GRN:.13,CON_LAB:.19,CON_RFM:.45,GRN_LAB:.42,GRN_RFM:.73,LAB_RFM:.58,CON_SNP:.2,LAB_SNP:.2,GRN_SNP:.1,CON_PLC:.1,LAB_PLC:.1,GRN_PLC:.05},
  GRN:{CON_LAB:.05,CON_LDM:.05,CON_RFM:.25,LAB_LDM:.22,LAB_RFM:.57,LDM_RFM:.67,CON_SNP:.02,LAB_SNP:.05,LDM_SNP:.05,CON_PLC:.02,LAB_PLC:.05,LDM_PLC:.05},
  CON:{GRN_LAB:.22,GRN_LDM:.11,GRN_RFM:.17,LAB_LDM:.05,LAB_RFM:.09,LDM_RFM:.24,LAB_SNP:.2,LDM_SNP:.2,GRN_SNP:.1,LAB_PLC:.15,LDM_PLC:.15,GRN_PLC:.1},
  RFM:{CON_GRN:.43,CON_LAB:.44,CON_LDM:.45,GRN_LAB:.16,GRN_LDM:.06,LAB_LDM:.04,CON_SNP:.1,LAB_SNP:.1,LDM_SNP:.1,CON_PLC:.05,LAB_PLC:.05,LDM_PLC:.05},
  SNP:{__const:.02}, PLC:{__const:.03},
};
const S = {
  LAB:{CON_GRN:.69,CON_LDM:.63,CON_RFM:.04,GRN_LDM:.42,GRN_RFM:.03,LDM_RFM:.04,CON_SNP:.02,LDM_SNP:.02,GRN_SNP:.02,CON_PLC:.1,LDM_PLC:.1,GRN_PLC:.05},
  LDM:{CON_GRN:.6,CON_LAB:.43,CON_RFM:.04,GRN_LAB:.29,GRN_RFM:.08,LAB_RFM:.1,CON_SNP:.05,LAB_SNP:.05,GRN_SNP:.05,CON_PLC:.05,LAB_PLC:.05,GRN_PLC:.05},
  GRN:{CON_LAB:.44,CON_LDM:.57,CON_RFM:.02,LAB_LDM:.36,LAB_RFM:.03,LDM_RFM:.03,CON_SNP:.3,LAB_SNP:.3,LDM_SNP:.3,CON_PLC:.15,LAB_PLC:.15,LDM_PLC:.15},
  CON:{GRN_LAB:.12,GRN_LDM:.26,GRN_RFM:.32,LAB_LDM:.35,LAB_RFM:.41,LDM_RFM:.37,LAB_SNP:.01,LDM_SNP:.01,GRN_SNP:.01,LAB_PLC:.02,LDM_PLC:.02,GRN_PLC:.02},
  RFM:{CON_GRN:.06,CON_LAB:.03,CON_LDM:.07,GRN_LAB:.07,GRN_LDM:.13,LAB_LDM:.2,CON_SNP:0,LAB_SNP:0,LDM_SNP:0,CON_PLC:0,LAB_PLC:0,LDM_PLC:0},
  SNP:{__const:.02}, PLC:{__const:.03},
};
const DONORS = ['LAB','LDM','GRN','CON','RFM','SNP','PLC'];
const CANON = ['LAB','CON','RFM','LDM','GRN','RES','SNP','PLC','MIN','OTH'];

const logistic=(k,mid,x)=>1/(1+Math.exp(-k*(x-mid)));
function frac(tbl, party, matchup){ const t=tbl[party]; if(!t) return 0; return ('__const'in t)?t.__const:(t[matchup]||0); }

function rank3(base){
  const arr = RANK_PARTIES.map(p=>[p, base[p]||0]).sort((a,b)=>b[1]-a[1]);
  return { p1:arr[0][0],p2:arr[1][0],p3:arr[2][0], v1:arr[0][1],v2:arr[1][1],v3:arr[2][1] };
}
function bloc2(base, members){
  const vals = members.map(p=>base[p]||0).sort((a,b)=>b-a);
  return (vals[0]||0)-(vals[1]||0);
}

function seatTactical(base, incumbent){
  const r = rank3(base);
  const AI = logistic(30,0.08, bloc2(base,['LAB','LDM','GRN','SNP','PLC']));         // left clarity
  const AJ = logistic(30,0.08, Math.abs((base.CON||0)-(base.RFM||0)));               // right clarity
  const shield = p => (p===incumbent ? 0.1 : 1);

  function scenario(eff2nd, valEff2nd){
    const firstP = r.p1 < eff2nd ? r.p1 : eff2nd;
    const secondP = r.p1 < eff2nd ? eff2nd : r.p1;
    const matchup = firstP+'_'+secondP;
    const bothRight = RIGHT.has(firstP)&&RIGHT.has(secondP);
    const bothLeft  = LEFT.has(firstP)&&LEFT.has(secondP);
    const clarFor = p => LEFT.has(p) ? (bothRight?AJ:AI) : (RIGHT.has(p) ? (bothLeft?AI:AJ) : AI);
    const comp = Math.max(0, 1-((r.v1-valEff2nd)/0.3));
    const lost={}, gainedFirst={}, gainedSecond={};
    DONORS.forEach(p=>{
      const cl=clarFor(p);
      lost[p] = (base[p]||0)*cl*(frac(F,p,matchup)+frac(S,p,matchup));
      gainedFirst[p]  = (base[p]||0)*cl*frac(F,p,matchup)*shield(p);
      gainedSecond[p] = (base[p]||0)*cl*frac(S,p,matchup)*shield(p);
    });
    const out={};
    CANON.forEach(party=>{
      const isTop2 = party===firstP||party===secondP;
      let vLost=0, vGained=0;
      if(!isTop2 && DONORS.includes(party)) vLost = lost[party]*comp*shield(party);
      if(isTop2){
        const g = (party===firstP)?gainedFirst:gainedSecond;
        vGained = DONORS.reduce((a,p)=>a+g[p],0)*comp;
      }
      out[party]=[vLost,vGained];
    });
    return out;
  }

  const A = scenario(r.p2, r.v2), B = scenario(r.p3, r.v3);
  const is = p=>({R:RIGHT.has(p),L:LEFT.has(p)});
  const sameBlocTop2 = (is(r.p1).R&&is(r.p2).R)||(is(r.p1).L&&is(r.p2).L);
  const crossBloc3rd = (is(r.p1).R&&is(r.p3).L)||(is(r.p1).L&&is(r.p3).R);
  const HW = (sameBlocTop2&&crossBloc3rd) ? 1/(1+Math.exp(40*((r.v2-r.v3)-0.06))) : 0;

  const out={};
  CANON.forEach(p=>{
    const lost = A[p][0]*(1-HW)+B[p][0]*HW;
    const gained = A[p][1]*(1-HW)+B[p][1]*HW;
    out[p]=Math.max(0,(base[p]||0)-lost+gained);
  });
  return out;
}

function apply(seats, transShare, cfg){
  // pass 1: tactical raw shares per seat + PER-ENGINE pre/post vote sums
  // (conserve each nation/engine's vote independently, so tactical voting can't move a
  //  party's vote between Scotland / Wales / London / England-ex-London).
  const pre={}, post={}, tac={};
  seats.forEach(s=>{
    const base = transShare[s.code]; if(!base) return;
    const t = seatTactical(base, s.incumbent2024);
    tac[s.code]=t;
    const eng = s.engine || 'EngExLondon';
    if(!pre[eng]){ pre[eng]={}; post[eng]={}; CANON.forEach(p=>{pre[eng][p]=0;post[eng][p]=0;}); }
    const votes = s.electorate*s.turnout;
    CANON.forEach(p=>{ pre[eng][p]+=(base[p]||0)*votes; post[eng][p]+=(t[p]||0)*votes; });
  });
  const ratio={};
  for(const eng in pre){ ratio[eng]={}; CANON.forEach(p=> ratio[eng][p]= post[eng][p]>0?pre[eng][p]/post[eng][p]:1); }
  // pass 2: conserve each engine's totals, renormalise per seat
  const out={};
  seats.forEach(s=>{
    const t=tac[s.code]; if(!t) return;
    const r = ratio[s.engine || 'EngExLondon'] || {};
    const raw={}; CANON.forEach(p=> raw[p]=(t[p]||0)*(r[p]!=null?r[p]:1));
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
  jcurve: { pivot: 0.40, baseMult: 0.30, leftSlope: 1.2, rightSlope: 0.1, floor: 0.10, ceiling: 0.90 },
  greenPenalty: { floor: 0.05, conWeight: 0.9, refWeight: 0.15, satWeight: 0.45 },
  blend: { transition: 0.67, yougov: 0.165, mic: 0.165 },
  scaleMRPbyRestore: true,
  pools: { gb: 28028812, scotland: 2414810, wales: 1319076, london: 3333200 },
  resRegionalScale: { Scotland: 0.39, Wales: 0.5, London: 0.56 },
  othersExponent: { transition: 15, mrp: 11 },

  // ---- Regional anchoring (EDIT HERE) ----------------------------------
  // For each nation: the regional poll baseline, and the GB-wide ("UK at time")
  // shares when that regional poll was taken. When a visitor changes a GB share,
  // the regional share moves from its baseline by a blend of additive (uniform)
  // and proportional swing. Numbers are shares 0-1 (e.g. 0.181 = 18.1%).
  regionalAnchor: {
    // national = GB-wide at the central projection; regional = that nation at the central projection.
    // Auto-generated by update_central.py from central_inputs.json.
    Scotland: { national:{LAB:0.261,CON:0.197,RFM:0.244,LDM:0.103,GRN:0.108,RES:0.036},
                regional:{LAB:0.192,CON:0.1067,RFM:0.1721,LDM:0.0937,GRN:0.0748,RES:0.027} },
    Wales:    { national:{LAB:0.261,CON:0.197,RFM:0.244,LDM:0.103,GRN:0.108,RES:0.036},
                regional:{LAB:0.1934,CON:0.1338,RFM:0.2322,LDM:0.0474,GRN:0.0856,RES:0.0396} },
    London:   { national:{LAB:0.261,CON:0.197,RFM:0.244,LDM:0.103,GRN:0.108,RES:0.036},
                regional:{LAB:0.3159,CON:0.2061,RFM:0.1737,LDM:0.1106,GRN:0.1644,RES:0.0187} },
  },
  regionalSwingMix: 0.5,   // 0 = pure proportional, 1 = pure additive/uniform
  // When SNP/Plaid fall below their central level the freed vote is re-spread to the main
  // parties (mostly LAB/GRN) instead of leaking to MIN/OTH. natBaseline = central nationalist
  // shares (kept in sync by update_central.py). Set a weight to 0 to exclude a party.
  natBaseline: { SNP: 0.3196, PLC: 0.261 },
  natRealloc: {   // where SNP/Plaid losses go, per nation (must each sum to ~1, MIN included)
    Scotland: { LAB: 0.35, GRN: 0.30, LDM: 0.15, CON: 0.05, RFM: 0.00, MIN: 0.15 },
    Wales:    { LAB: 0.40, GRN: 0.25, LDM: 0.10, CON: 0.05, RFM: 0.05, MIN: 0.15 },
  },
  natReallocRamp: 0.03,    // recipient eligibility fades in 0->full as its share goes 0->3% (smooth, no cliff)
  minElasticity: 0.4,      // how much independents/MIN shares move with the swing (display dynamics)
  minWinFloor: 0.28,       // MIN wins only in genuine 2024 strongholds (base>=this) ...
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
function weakVote(base, opts, cfg) {
  const j = cfg.jcurve;
  let raw = base < j.pivot ? j.baseMult + (j.pivot - base)*j.leftSlope
                           : j.baseMult + (base - j.pivot)*j.rightSlope;
  let floor = j.floor;
  if (opts && opts.greenPenalty) {
    const g = cfg.greenPenalty;
    raw = raw - (opts.con*g.conWeight + opts.ref*g.refWeight) - base*g.satWeight;
    floor = g.floor;
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
  const lonRES = (inp.london.RES!=null)? inp.london.RES : (inp.gb.RES||0)*cfg.resRegionalScale.London;
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
  const a = cfg.regionalAnchor[region], mix = cfg.regionalSwingMix, out = {};
  ['LAB','CON','RFM','LDM','GRN','RES'].forEach(p=>{
    const nb=a.national[p]||0, rb=a.regional[p]||0, g=gb[p]||0;
    const additive   = rb + (g - nb);
    const proportional = nb>0 ? rb*(g/nb) : rb;
    // Lean toward proportional as the national share falls below baseline, so a party on ~0%
    // nationally collapses to ~0 regionally too (uniform swing still applies when it grows).
    const effMix = mix * (nb>0 ? Math.min(1, g/nb) : 1);
    out[p] = Math.max(0, effMix*additive + (1-effMix)*proportional);
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
      weak[p] = weakVote(base, o, cfg);
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
      fin[p] = t >= rs ? st + wk*mult[p] : (rs>0 ? st*(t/rs) : 0);
      fin[p] = Math.max(0, fin[p]);
    });
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
    r.calib = out;
  });
  return rows;
}

// ---------- Stage 5: MRP swing — run PER NATION (SNP/PLC are nation-specific) ----------
const MRP_PARTIES = ['LAB','CON','RFM','LDM','GRN','SNP','PLC','OTH'];
function mrpSwing(seats, mrpKey, targetForNation, cfg) {
  const out={};
  ['England','Scotland','Wales'].forEach(nation=>{
    const target = targetForNation(nation);
    const rows = seats.filter(s=>s[mrpKey] && s.nation===nation).map(s=>{
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
  const seats = data.seats;
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
    const rows = swingEngine(seatsR, tgt, parties, cfg, {greenPenalty:true});
    rows.forEach(r=>{ const o={}; CANON.forEach(p=>o[p]=r.calib[p]||0); transShare[r.s.code]=o; });
  });

  // Stage 4: tactical voting on the transition shares
  const tvShare = TV.apply(seats, transShare, cfg);

  // Stage 5: MRP swings toward inputs — main parties = GB inputs; SNP/PLC per nation
  const mrpTarget = (baseline) => (nation) => {
    // use each nation's own regional vote-share targets for the mains (not GB), so e.g. Welsh
    // Conservatives swing toward the Welsh level rather than the GB level.
    const m = nation==='Scotland' ? inputs.scotland : nation==='Wales' ? inputs.wales : inputs.gb;
    const t = { LAB:m.LAB, CON:m.CON, RFM:m.RFM, LDM:m.LDM, GRN:m.GRN,
                SNP: nation==='Scotland' ? (inputs.scotland.SNP||0) : 0,
                PLC: nation==='Wales'    ? (inputs.wales.PLC||0)    : 0 };
    return withMRPMinor(t, baseline, cfg);
  };
  const yg  = mrpSwing(seats, 'yougov', mrpTarget(cd.mrp_baseline.yougov), cfg);
  const mic = mrpSwing(seats, 'mic',    mrpTarget(cd.mrp_baseline.mic),    cfg);

  // Stage 6: blend -> per-seat final shares
  const MAINP=['LAB','CON','RFM','LDM','GRN','SNP','PLC'];
  const seatShares = seats.map(s=>{
    const tv = tvShare[s.code] || transShare[s.code];
    const y = yg[s.code], m = mic[s.code];
    const res = tv.RES||0, k=cfg.scaleMRPbyRestore?(1-res):1;
    const final = {};
    // mains: STM blended with the MRPs
    MAINP.forEach(p=>{ final[p] = cfg.blend.transition*(tv[p]||0) + cfg.blend.yougov*k*((y&&y[p])||0) + cfg.blend.mic*k*((m&&m[p])||0); });
    final.RES = tv.RES||0;   // Restore: STM only
    // 'Other' pool: blended exactly like the 'Add MRP Data' cell. Each MRP reports a SINGLE
    // 'Others' value per seat; we blend 0.67 STM + 0.165 YouGov + 0.165 MiC to get one combined
    // 'Other' total, then split it MIN (largest) / OTH (rest) using the STM's own MIN:OTH ratio
    // (e.g. STM 15/5 -> 75% MIN, 25% OTH). The MRP 'Other' targets are now correctly scaled
    // (withMRPMinor), so this no longer balloons in independent-strong seats - and no caps.
    const oM=tv.MIN||0, oO=tv.OTH||0, oSum=oM+oO;
    // Split the combined 'Other' total MIN/OTH using the seat's NOTIONAL 2024 ratio, so the
    // proportion of MIN to OTH stays fixed at its 2024 level (fall back to STM, then 50/50).
    const bM=s.base.MIN||0, bO=s.base.OTH||0, bSum=bM+bO;
    const rMIN = bSum>0 ? bM/bSum : (oSum>0 ? oM/oSum : 0.5), rOTH = 1-rMIN;
    const otherTotal = cfg.blend.transition*oSum
                     + cfg.blend.yougov*k*((y&&y.OTH)||0)
                     + cfg.blend.mic*k*((m&&m.OTH)||0);
    final.MIN = otherTotal*rMIN;
    final.OTH = otherTotal*rOTH;
    if(final.OTH>final.MIN){ const tmp=final.MIN; final.MIN=final.OTH; final.OTH=tmp; }  // MIN >= OTH always
    const tot = sum(CANON.map(p=>final[p]));
    CANON.forEach(p=> final[p] = tot>0?final[p]/tot:0);
    return { s, final };
  });

  applyBlocBumpers(seatShares, inputs, cfg);
  applySpecialSeats(seatShares, inputs, cfg);

  // Stage 7: GB renormalisation (England-ex-London only). Nudge the unanchored residual engine
  // so the GB aggregate of the six main parties matches the entered GB row's proportions, while
  // London / Scotland / Wales stay pinned to their regional anchors. Special (by-election) seats
  // are excluded so they keep their local-poll blend.
  if(cfg.gbRenorm!==false)(function gbRenorm(){
    const M=['LAB','CON','RFM','LDM','GRN','RES'];
    const gbIn=inputs.gb||{}, inSum=M.reduce((a,p)=>a+(gbIn[p]||0),0);
    if(!(inSum>0)) return;
    const adj=x=> x.s.engine==='EngExLondon' && !(cfg.specialSeats&&cfg.specialSeats[x.s.code]);
    let Vall=0,Vadj=0; const aAll={},aAdj={};
    seatShares.forEach(x=>{ const v=x.s.electorate*x.s.turnout; Vall+=v;
      M.forEach(p=>aAll[p]=(aAll[p]||0)+(x.final[p]||0)*v);
      if(adj(x)){ Vadj+=v; M.forEach(p=>aAdj[p]=(aAdj[p]||0)+(x.final[p]||0)*v); } });
    if(!(Vadj>0)) return;
    const we=Vadj/Vall, curMain=M.reduce((a,p)=>a+aAll[p]/Vall,0), ratio={};
    M.forEach(p=>{ const cur=aAll[p]/Vall, curE=aAdj[p]/Vadj, tgt=(gbIn[p]/inSum)*curMain;
      const needE=curE+(tgt-cur)/we; ratio[p]=(curE>1e-9&&needE>0)?Math.max(0.5,Math.min(2,needE/curE)):1; });
    seatShares.forEach(x=>{ if(!adj(x)) return; const f=x.final;
      M.forEach(p=>{ if(f[p]) f[p]*=ratio[p]; });
      const tot=sum(CANON.map(p=>f[p])); if(tot>0) CANON.forEach(p=>f[p]/=tot); });
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
  const mainKeys=['LAB','CON','RFM','LDM','GRN','SNP','PLC'].filter(p=>(mainTarget[p]||0)>0);
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
