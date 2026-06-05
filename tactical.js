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
  // pass 1: tactical raw shares per seat + national pre/post vote sums
  const pre={}, post={}, tac={};
  CANON.forEach(p=>{pre[p]=0;post[p]=0;});
  seats.forEach(s=>{
    const base = transShare[s.code]; if(!base) return;
    const t = seatTactical(base, s.incumbent2024);
    tac[s.code]=t;
    const votes = s.electorate*s.turnout;
    CANON.forEach(p=>{ pre[p]+=(base[p]||0)*votes; post[p]+=(t[p]||0)*votes; });
  });
  const ratio={}; CANON.forEach(p=> ratio[p]= post[p]>0?pre[p]/post[p]:1);
  // pass 2: conserve national totals, renormalise per seat
  const out={};
  seats.forEach(s=>{
    const t=tac[s.code]; if(!t) return;
    const raw={}; CANON.forEach(p=> raw[p]=(t[p]||0)*ratio[p]);
    const tot=CANON.reduce((a,p)=>a+raw[p],0);
    const sh={}; CANON.forEach(p=> sh[p]= tot>0?raw[p]/tot:0);
    out[s.code]=sh;
  });
  return out;
}

module.exports = { apply, seatTactical, F, S };
