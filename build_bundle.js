const fs=require('fs');
let tac=fs.readFileSync('tactical.js','utf8').replace(/module\.exports\s*=\s*\{[^}]*\};?/,'');
let eng=fs.readFileSync('nowcast.js','utf8')
  .replace(/const TV = require\('\.\/tactical\.js'\);.*$/m,'')
  .replace(/module\.exports\s*=\s*\{[^}]*\};?/,'')
  .replace(/^const CANON = \[[^\]]*\];\s*$/m,'/* CANON shared from tactical */');
const out=`/* ElectionMapsUK nowcast engine — browser bundle (auto-generated). Do not edit; edit nowcast.js/tactical.js and re-run build_bundle.js */
(function(){
"use strict";
${tac}
const TV = { apply, seatTactical, F, S };
${eng}
window.NowcastEngine = { runNowcast: runNowcast, CONFIG: CONFIG, regionalTargets: regionalTargets };
})();
`;
fs.writeFileSync('nowcast.browser.js', out);
console.log('wrote nowcast.browser.js', out.length, 'bytes');
