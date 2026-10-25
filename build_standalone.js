const fs=require('fs');
const html=fs.readFileSync('electionmaps_nowcast.html','utf8');
const bundle=fs.readFileSync('build/nowcast.browser.js','utf8');
const seats=fs.readFileSync('build/data/seats.json','utf8');
const config=fs.readFileSync('build/data/config_data.json','utf8');
const central=fs.readFileSync('build/data/central.json','utf8');
const fixed=fs.readFileSync('build/data/fixed_seats.json','utf8');
let geo=''; try{ geo=fs.readFileSync('build/data/boundaries.geojson','utf8'); }catch(e){ console.log('(no local boundaries.geojson - map will load from URL)'); }
let hex=''; try{ hex=fs.readFileSync('build/data/hex.geojson','utf8'); }catch(e){ /* hex loads from URL */ }
let cmc=''; try{ cmc=fs.readFileSync('build/data/central_mc.json','utf8'); }catch(e){ console.log('(no central_mc.json - run build_central_mc.js)'); }

let logoTag='';
const path=require('path');
['logo.png','logo.jpg','logo.jpeg','logo.svg','logo.webp'].forEach(function(fn){
  if(logoTag) return;
  for(const dir of ['..','.', 'data']){
    const fp=path.join(dir,fn);
    try{ const b=fs.readFileSync(fp);
      const mime=fn.endsWith('.svg')?'image/svg+xml':fn.endsWith('.webp')?'image/webp':fn.endsWith('.png')?'image/png':'image/jpeg';
      logoTag='<script>window.__LOGO__="data:'+mime+';base64,'+b.toString('base64')+'";</script>';
      console.log('inlined logo from '+fp+' ('+(b.length/1024).toFixed(0)+'KB)'); break;
    }catch(e){}
  }
});
const dataScript=`<script>window.__NOWCAST_DATA__={seats:${seats},config_data:${config},central:${central},fixed:${fixed}};</script>`;
const geoScript = geo ? `<script>window.__GEO__=${geo};</script>` : '';
const hexScript = hex ? `<script>window.__HEX__=${hex};</script>` : '';
const cmcScript = cmc ? `<script>window.__CENTRAL_MC__=${cmc};</script>` : '';
const inlineBundle=`<script id="nowcast-engine-src">\n${bundle}\n</script>`;
const out=html.replace('<script src="build/nowcast.browser.js"></script>', dataScript+'\n'+logoTag+'\n'+geoScript+'\n'+hexScript+'\n'+cmcScript+'\n'+inlineBundle);
fs.writeFileSync('electionmaps_nowcast.standalone.html', out);
console.log('standalone written:', (out.length/1024).toFixed(0)+'KB');
