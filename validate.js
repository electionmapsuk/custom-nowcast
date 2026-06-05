const fs=require('fs');
const {runNowcast}=require('./nowcast.js');
const D=p=>JSON.parse(fs.readFileSync('./data/'+p));
const data={seats:D('seats.json'), config_data:D('config_data.json')};
const central=D('central.json');
const val=D('validation.json');

const out=runNowcast(central, data);
const order=['LAB','CON','RFM','LDM','GRN','SNP','PLC','MIN'];
console.log('engine totals :', order.map((p,i)=>p+' '+out.aggregateSeats[i]).join('  '));
const ct=val.totals;
console.log('cached totals :', order.map(p=>p+' '+(ct[p]||0)).join('  '));

// per-seat winner agreement
let agree=0, tot=0;
const conf={};
data.seats.forEach(s=>{
  const w=out.winnerByCode[s.code], c=val.winners[s.code];
  if(!c) return; tot++;
  if(w===c) agree++; else { const k=c+'->'+w; conf[k]=(conf[k]||0)+1; }
});
console.log(`\nseat-winner agreement: ${agree}/${tot} = ${(100*agree/tot).toFixed(1)}%`);
const top=Object.entries(conf).sort((a,b)=>b[1]-a[1]).slice(0,12);
console.log('top mismatches (cached->engine):');
top.forEach(([k,v])=>console.log('  ',k,v));
