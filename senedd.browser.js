/* Senedd Nowcast engine — browser bundle (auto-generated). Do not edit; edit senedd.js and re-run build_bundle.js */
(function(){
"use strict";
/* Senedd Nowcast engine — client-side, no server round-trip.
   Same J-curve strong/weak transition method as the GB nowcast (nowcast.js),
   applied to the 16 six-member Senedd constituencies (closed-list PR, D'Hondt).

   Differences from the GB engine, because Senedd 2026 is proportional:
   - No regional allocation stage: Wales *is* the region, so the national input
     IS the target — no England/Scotland/London split needed.
   - No tactical voting stage. Tactical squeeze is a FPTP vote-efficiency effect;
     under D'Hondt list PR, a vote for your preferred party is never "wasted" in
     the FPTP sense, so there is nothing for a tactical-transfer matrix to model.
   - No MRP blend stage: no per-seat Senedd MRP exists (unlike GB's YouGov/MiC).
   - New final stage: D'Hondt allocation of 6 seats per constituency from the
     swung vote shares (replaces "highest share wins the seat").

   Pure functions; no DOM, no globals. Works in browser and Node.            */

const CONFIG = {
  // Same J-curve weak/strong split parameters as the GB engine's CONFIG.jcurve.
  jcurve: { pivot: 0.32, baseMult: 0.30, leftSlope: 1.2, rightSlope: 0.5, floor: 0.10, ceiling: 0.90 },
  // NOTE: the GB engine's Green-only penalty (soft Green vote suppressed where Con+Reform are
  // strong) is deliberately NOT carried over. It models FPTP tactical squeeze, which is the one
  // thing this engine drops on principle — under D'Hondt a vote is never wasted — and the 2026
  // Senedd election was fought after the Polanski-era shift in the Green voter base, so the
  // premise that Green support is soft and defects to block the right no longer holds.
  // Every party now runs the same J-curve with the same parameters.
  // "Others" suppression exponent — same mechanism as the GB engine's othersExponent.transition,
  // but 3 rather than 10. The exponent sets how hard OTH reacts to the entered mains total moving
  // away from the 2026 total: at 10 the reaction is violent and unbounded, and because it is
  // divided by ratio^k it overshoots — an entered total of 60% sent OTH to 83% and left Plaid on
  // 2 seats. Worse, the sign of the error flipped at ~72%, inside the range a visitor can reach
  // (the total line only warns below 80%). At 3 the response stays monotonic down to ~30%, and a
  // 60% total gives OTH 14% and Plaid 39 seats. Nothing visible at realistic inputs changes: the
  // central projection returns identical seats at every exponent from 1 to 10.
  othersExponent: 3,
  seatsPerConstituency: 6,
};

const PARTIES = ['LAB','CON','RFM','LDM','GRN','PLC','OTH'];
const MAIN = ['LAB','CON','RFM','LDM','GRN','PLC'];   // the 6 parties visitors can enter

// ---------- helpers ----------
const sum = a => a.reduce((x,y)=>x+y,0);
const clamp = (x,lo,hi) => Math.max(lo, Math.min(hi, x));

// J-curve weak-vote portion of a party's base share — identical formula to the GB engine,
// and now applied identically to every party (see the note on greenPenalty in CONFIG).
function weakVote(base, cfg) {
  const j = cfg.jcurve;
  const raw = base < j.pivot ? j.baseMult + (j.pivot - base)*j.leftSlope
                             : j.baseMult + (base - j.pivot)*j.rightSlope;
  return base * clamp(raw, j.floor, j.ceiling);
}

// national "others" target, suppressed/relaxed the same way withMinorTargets() does in nowcast.js:
// as the mains' combined share moves away from its 2026 baseline level, OTH shrinks/grows by ratio^exp.
function withOthersTarget(mainTarget, baselineNat, cfg) {
  const ratio = sum(MAIN.map(p => mainTarget[p]||0)) / sum(MAIN.map(p => baselineNat[p]||0));
  const t = Object.assign({}, mainTarget);
  t.OTH = (baselineNat.OTH||0) / Math.pow(ratio, cfg.othersExponent);
  return t;
}

// ---------- Stages 2-3: per-constituency J-curve split + swing + calibration ----------
// (directly ported from swingEngine() in nowcast.js — one "region" here: the whole of Wales)
function swingEngine(seats, target, cfg) {
  const rows = seats.map(s => {
    const weak={}, strong={};
    PARTIES.forEach(p => {
      const base = s.base[p]||0;
      weak[p] = weakVote(base, cfg);
      strong[p] = base - weak[p];
    });
    return {s, weak, strong};
  });
  const n = rows.length;
  const RStrong={}, RWeak={}, mult={};
  PARTIES.forEach(p => {
    RStrong[p] = sum(rows.map(r=>r.strong[p]))/n;
    RWeak[p]   = sum(rows.map(r=>r.weak[p]))/n;
    mult[p]    = RWeak[p]>0 ? Math.max(0, (target[p]||0) - RStrong[p]) / RWeak[p] : 0;
  });
  rows.forEach(r => {
    const fin={};
    PARTIES.forEach(p => {
      const t=target[p]||0, st=r.strong[p], wk=r.weak[p], rs=RStrong[p];
      fin[p] = t >= rs ? st + wk*mult[p] : (rs>0 ? st*(t/rs) : 0);
      fin[p] = Math.max(0, fin[p]);
    });
    const tot = sum(PARTIES.map(p=>fin[p]));
    r.share = {}; PARTIES.forEach(p => r.share[p] = tot>0 ? fin[p]/tot : 0);
  });
  // calibrate: weight by each constituency's 2026 votes cast (fixed size proxy — Senedd
  // constituencies are drawn to near-equal electorates, so this stands in for electorate*turnout).
  const aggShare = {};
  const totW = sum(rows.map(r => r.s.votes2026));
  PARTIES.forEach(p => {
    const v = sum(rows.map(r => r.share[p]*r.s.votes2026));
    aggShare[p] = totW>0 ? v/totW : 0;
  });
  rows.forEach(r => {
    const out={};
    PARTIES.forEach(p => {
      const t=target[p]||0;
      out[p] = aggShare[p]>0 ? r.share[p]*(t/aggShare[p]) : r.share[p];
    });
    const tot = sum(PARTIES.map(p=>out[p]));
    r.calib = {}; PARTIES.forEach(p => r.calib[p] = tot>0 ? out[p]/tot : 0);
  });
  return rows;
}

// ---------- Stage 6: D'Hondt allocation, 6 seats per constituency ----------
// Returns both the final counts and `order`: the sequence in which each of the `seats`
// seats was actually awarded (e.g. ['PLC','RFM','PLC','LAB','RFM','PLC']) — the real
// D'Hondt allocation order, not grouped by party. Used to order elected-member displays
// (hex map cluster + constituency table dots) the way the count itself is actually decided.
function dhondt(shares, seats) {
  const counts = {}; PARTIES.forEach(p => counts[p]=0);
  const order = [];
  for (let i=0; i<seats; i++) {
    let bestP=null, bestQ=-1;
    PARTIES.forEach(p => {
      const v = shares[p]||0; if (v<=0) return;
      const q = v/(counts[p]+1);
      if (q>bestQ) { bestQ=q; bestP=p; }
    });
    if (bestP) { counts[bestP]++; order.push(bestP); }
  }
  return { counts, order };
}

// ---------- top level ----------
// inputs: { LAB, CON, RFM, LDM, GRN, PLC }  (shares 0-1; OTH is derived, not entered)
function runSeneddNowcast(inputs, data, cfgOverride) {
  const cfg = Object.assign({}, CONFIG, cfgOverride||{});
  const seats = data.seats;
  const baselineNat = data.national_base_2026;

  const target = withOthersTarget(inputs, baselineNat, cfg);
  const rows = swingEngine(seats, target, cfg);

  // cfg.localNoise, when supplied, is a zero-mean random-draw function called once per party per
  // constituency to perturb its final vote share before D'Hondt — this is the Monte Carlo hook
  // (see runSimulations() in the page script). Left unset, this is a no-op: shares === r.calib
  // exactly, so the ordinary central/custom render path is untouched byte-for-byte.
  const constituencyResults = rows.map(r => {
    let shares = r.calib;
    if (cfg.localNoise) {
      shares = {}; let tot = 0;
      PARTIES.forEach(p => { shares[p] = Math.max(0, r.calib[p] + cfg.localNoise()); tot += shares[p]; });
      if (tot > 0) PARTIES.forEach(p => shares[p] = shares[p]/tot);
    }
    const dh = dhondt(shares, cfg.seatsPerConstituency);
    const seatCounts = dh.counts;
    // members in D'Hondt allocation order (the order seats were actually awarded),
    // not grouped by party — see dhondt() above.
    const members = dh.order;
    return {
      code: r.s.code, name: r.s.name,
      shares,
      seats: seatCounts,
      members,
    };
  });

  const aggregateSeats = {}; PARTIES.forEach(p => aggregateSeats[p]=0);
  constituencyResults.forEach(c => PARTIES.forEach(p => aggregateSeats[p]+=c.seats[p]));

  // national vote-share aggregate actually delivered (post J-curve, weighted like the calibration)
  const totW = sum(rows.map(r=>r.s.votes2026));
  const nationalShare = {};
  PARTIES.forEach(p => nationalShare[p] = sum(rows.map(r=>r.calib[p]*r.s.votes2026))/totW);

  return { aggregateSeats, constituencyResults, nationalShare, target };
}



window.SeneddEngine = { runSeneddNowcast: runSeneddNowcast, CONFIG: CONFIG, PARTIES: PARTIES, MAIN: MAIN, dhondt: dhondt };
})();
