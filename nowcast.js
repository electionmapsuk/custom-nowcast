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
  othersExponent: { transition: 10, mrp: 8 },
  blocs: { left:['LAB','GRN','LDM'], right:['CON','RFM','RES'], nationalist:['SNP','PLC'], neutral:['MIN','OTH','WPB'] },
  blocProtection: { strength: 0.4, deadband: 0.03 },   // soft bumpers (B2)
  cleanNormalise: true,                                // single clean normalisation (B2)
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
  gbV.OTH = P.gb - sum(main.map(p=>gbV[p]));

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
const TV = require('./tactical.js');   // F_/S_ matrices + clarity, extracted from the sheet

// ---------- top level ----------
function runNowcast(inputs, data, cfgOverride) {
  const cfg = Object.assign({}, CONFIG, cfgOverride||{});
  const seats = data.seats;
  const cd = data.config_data;

  // Stage 1
  const targets = regionalTargets(inputs, cfg);

  // Stage 2-3: transition model per engine -> calibrated shares per seat
  const transShare = {};   // code -> {party:share} (10-party canon)
  ['EngExLondon','London','Scotland','Wales'].forEach(engine=>{
    const parties = ENGINE_PARTIES[engine];
    const tgt = withMinorTargets(targets[engine], cd.region_ge2024[engine], engine, cfg.othersExponent.transition);
    const seatsR = seats.filter(s=>s.engine===engine);
    const rows = swingEngine(seatsR, tgt, parties, cfg, {greenPenalty:true});
    rows.forEach(r=>{ const o={}; CANON.forEach(p=>o[p]=r.calib[p]||0); transShare[r.s.code]=o; });
  });

  // Stage 4: tactical voting on the transition shares
  const tvShare = TV.apply(seats, transShare, cfg);

  // Stage 5: MRP swings toward inputs — main parties = GB inputs; SNP/PLC per nation
  const mrpTarget = (baseline) => (nation) => {
    const t = { LAB:inputs.gb.LAB, CON:inputs.gb.CON, RFM:inputs.gb.RFM, LDM:inputs.gb.LDM, GRN:inputs.gb.GRN,
                SNP: nation==='Scotland' ? (inputs.scotland.SNP||0) : 0,
                PLC: nation==='Wales'    ? (inputs.wales.PLC||0)    : 0 };
    return withMRPMinor(t, baseline, cfg);
  };
  const yg  = mrpSwing(seats, 'yougov', mrpTarget(cd.mrp_baseline.yougov), cfg);
  const mic = mrpSwing(seats, 'mic',    mrpTarget(cd.mrp_baseline.mic),    cfg);

  // Stage 6: blend -> per-seat final shares
  const seatShares = seats.map(s=>{
    const tv = tvShare[s.code] || transShare[s.code];
    const y = yg[s.code], m = mic[s.code];
    const res = tv.RES||0, k=cfg.scaleMRPbyRestore?(1-res):1;
    const final = {};
    CANON.forEach(p=>{
      let v = cfg.blend.transition*(tv[p]||0);
      if (p!=='RES' && p!=='MIN' && p!=='OTH') {
        v += cfg.blend.yougov*k*((y&&y[p])||0) + cfg.blend.mic*k*((m&&m[p])||0);
      }
      final[p]=v;
    });
    const tot = sum(CANON.map(p=>final[p]));
    CANON.forEach(p=> final[p] = tot>0?final[p]/tot:0);
    return { s, final };
  });

  applyBlocBumpers(seatShares, inputs, cfg);

  const results = seatShares.map(({s, final})=>{
    let winner = CANON.reduce((a,b)=> final[b]>final[a]?b:a, CANON[0]);
    if (s.incumbent2024==='SPKR') winner = 'SPKR';
    else if (winner==='MIN' && s.incumbent2024==='MIN') winner = 'WPB';
    return { seatName:s.name, code:s.code, winner, winner2024:s.incumbent2024,
             shares:final, incumbent:s.incumbent2024 };
  });

  const order=['LAB','CON','RFM','LDM','GRN','SNP','PLC','MIN'];
  const counts={}; order.forEach(p=>counts[p]=0);
  results.forEach(r=>{ if(counts[r.winner]!=null) counts[r.winner]++; });
  return { aggregateSeats: order.map(p=>counts[p]), individualSeatResults: results,
           winnerByCode: Object.fromEntries(results.map(r=>[r.code,r.winner])) };
}

const CANON = ['LAB','CON','RFM','LDM','GRN','RES','SNP','PLC','MIN','OTH'];
function withMRPMinor(mainTarget, baseline, cfg){
  const mainKeys=['LAB','CON','RFM','LDM','GRN','SNP','PLC'];
  const ratio = sum(mainKeys.map(p=>mainTarget[p]||0)) / sum(mainKeys.map(p=>baseline[p]||0));
  const t=Object.assign({}, mainTarget);
  t.OTH = (baseline.OTH||0)/Math.pow(ratio, cfg.othersExponent.mrp);
  return t;
}
module.exports = { runNowcast, CONFIG, regionalTargets };

