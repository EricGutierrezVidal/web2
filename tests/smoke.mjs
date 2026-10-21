import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const file=p=>readFileSync(new URL(p,root),'utf8');
const html=file('index.html'),js=file('app-v2.js');
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const selectors=new Set([...js.matchAll(/\$\("([A-Za-z0-9_-]+)"\)/g)].map(m=>m[1]));
const dynamicIDs=new Set(['moreMatches']);
for(const id of selectors)assert(ids.has(id)||dynamicIDs.has(id),'Missing UI element: '+id);
assert(html.includes('id="virtualBook"'),'virtual ticket');
assert(html.includes('id="pricePanel"'),'manual prices panel');
assert(html.includes('value="esp.1"')&&html.includes('value="uefa.champions"'),'only target leagues');
assert(!html.includes('value="4328"'),'no Premier League');
for(const [f,id,minResults,minFixtures] of [['data/laliga.json','esp.1',20,100],['data/champions.json','uefa.champions',20,30]]){
 const d=JSON.parse(file(f));assert(d.league===id,'league value');assert(d.events.length>=minResults+minFixtures,'total matches');
 assert(d.events.filter(x=>x.played).length>=minResults,'missing results');
 assert(d.events.filter(x=>!x.played).length>=minFixtures,'missing fixtures');
 const keys=new Set();
 for(const e of d.events){
  assert(!keys.has(e.idEvent),'Duplicate id '+e.idEvent);keys.add(e.idEvent);
  assert(Number.isFinite(Date.parse(e.dateISO)),'invalid date');
  assert(e.strHomeTeam&&e.strAwayTeam,'missing teams');
  if(e.played)assert(Number.isFinite(e.intHomeScore)&&Number.isFinite(e.intAwayScore),'bad score');
 }
 console.log(f, d.events.length,'matches,',d.events.filter(x=>x.played).length,'completed, source',d.source_generated_utc);
}
console.log('FutbolLab browser references and real snapshot schema: OK');
