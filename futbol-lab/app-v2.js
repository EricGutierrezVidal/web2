"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>Number(n).toLocaleString("ca-ES",{style:"currency",currency:"EUR"});
const pct=n=>(n*100).toFixed(1)+"%";
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const SOURCE="https://site.api.espn.com/apis/site/v2/sports/soccer/";
let upcoming=[],past=[],allMatches=[],selected=null,probs=[0,0,0],leagueId="uefa.champions";
let dataMode="real",modelType="manual",leagueLabel="Champions League",loadedAt=null,loadingId=0;
let records=[];try{records=JSON.parse(localStorage.getItem("futbollab_records")||"[]");if(!Array.isArray(records))records=[]}catch{records=[]}
function persist(){try{localStorage.setItem("futbollab_records",JSON.stringify(records))}catch(e){console.warn("LocalStorage no disponible",e)}ledger()}
function scoreNum(raw){if(raw==null||raw==="")return null;const v=typeof raw==="object"?(raw.value??raw.displayValue):raw;return v===""||v==null||!Number.isFinite(Number(v))?null:Number(v)}
function normalizeESPN(e){
 const comp=e.competitions?.[0],cs=comp?.competitors;
 if(!Array.isArray(cs))return null;
 const home=cs.find(c=>c.homeAway==="home"),away=cs.find(c=>c.homeAway==="away");
 if(!home||!away||!e.date)return null;
 const state=e.status?.type?.state??comp.status?.type?.state??"pre";
 const hs=scoreNum(home.score),as=scoreNum(away.score);
 return {idEvent:String(e.id),idHomeTeam:String(home.id??home.team?.id??home.team?.displayName),idAwayTeam:String(away.id??away.team?.id??away.team?.displayName),
 strHomeTeam:String(home.team?.displayName??home.team?.name??"Local"),strAwayTeam:String(away.team?.displayName??away.team?.name??"Visitant"),
 dateISO:e.date,intHomeScore:hs,intAwayScore:as,played:state==="post"&&hs!==null&&as!==null,live:state==="in",status:String(e.status?.type?.shortDetail||""),source:"ESPN"};
}
function normalizeImported(e,i){
 if(!e||typeof e.strHomeTeam!=="string"||typeof e.strAwayTeam!=="string")return null;
 const iso=e.dateISO||(e.dateEvent?e.dateEvent+"T"+(e.strTime||"12:00:00")+"Z":null);
 if(!iso||!Number.isFinite(new Date(iso).getTime()))return null;
 const hs=scoreNum(e.intHomeScore),as=scoreNum(e.intAwayScore);
 return {idEvent:String(e.idEvent??"import-"+i),idHomeTeam:String(e.idHomeTeam??e.strHomeTeam),idAwayTeam:String(e.idAwayTeam??e.strAwayTeam),strHomeTeam:e.strHomeTeam,strAwayTeam:e.strAwayTeam,
 dateISO:iso,intHomeScore:hs,intAwayScore:as,played:hs!==null&&as!==null,live:false,status:"",source:"JSON importat"};
}
const ms=e=>new Date(e.dateISO).getTime();
const when=e=>new Intl.DateTimeFormat("ca-ES",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(e.dateISO));
const dateOnly=e=>new Intl.DateTimeFormat("ca-ES",{day:"2-digit",month:"short"}).format(new Date(e.dateISO));
function seasonBounds(){
 const now=new Date();const y=now.getUTCFullYear()-(now.getUTCMonth()<6?1:0);
 return [String(y)+"0801",String(y+1)+"0630"];
}
function plusDay(yyyymmdd,delta){
 const d=new Date(Date.UTC(Number(yyyymmdd.slice(0,4)),Number(yyyymmdd.slice(4,6))-1,Number(yyyymmdd.slice(6,8))));
 d.setUTCDate(d.getUTCDate()+delta);return d.toISOString().slice(0,10).replace(/-/g,"");
}
async function fetchRange(id,from,to){
 const path=SOURCE+encodeURIComponent(id)+"/scoreboard?dates="+from+"-"+to+"&limit=500";
 const response=await fetch(path,{signal:AbortSignal.timeout(16000),cache:"no-store"});
 if(!response.ok)throw Error("ESPN HTTP "+response.status);
 const json=await response.json();
 if(!Array.isArray(json.events))throw Error("Resposta ESPN sense esdeveniments");
 return json.events.map(normalizeESPN).filter(Boolean);
}
async function fetchLeague(id){
 const bounds=seasonBounds();
 let events=[],reasons=[];
 try{events=await fetchRange(id,bounds[0],bounds[1])}catch(e){reasons.push(e.message)}
 // Si la resposta és curta, fem consultes més petites per superar límits de paginació.
 if(events.length<20){
  const spans=[];let cur=bounds[0];
  while(cur<=bounds[1]){const next=plusDay(cur,30);spans.push([cur,next>bounds[1]?bounds[1]:next]);cur=plusDay(next,1)}
  const portions=await Promise.allSettled(spans.map(s=>fetchRange(id,s[0],s[1])));
  for(const part of portions){if(part.status==="fulfilled")events.push(...part.value);else reasons.push(part.reason?.message??"Error de xarxa")}
 }
 const unique=new Map();
 for(const e of events)unique.set(e.idEvent,e);
 const merged=[...unique.values()].sort((a,b)=>ms(a)-ms(b));
 if(!merged.length)throw Error(reasons[0]||"No hi ha partits disponibles");
 return merged;
}
function saveCache(id,events){try{localStorage.setItem("futbollab_cache_"+id,JSON.stringify({saved:Date.now(),events}))}catch(e){}}
function cached(id){try{const c=JSON.parse(localStorage.getItem("futbollab_cache_"+id)||"null");return c&&Array.isArray(c.events)?c:null}catch{return null}}
function adopt(events,origin){
 allMatches=events.filter(e=>Number.isFinite(ms(e))).sort((a,b)=>ms(a)-ms(b));
 const now=Date.now();
 past=allMatches.filter(e=>e.played&&ms(e)<=now+2*86400000).sort((a,b)=>ms(b)-ms(a));
 upcoming=allMatches.filter(e=>!e.played&&ms(e)>now-86400000).sort((a,b)=>ms(a)-ms(b));
 selected=null;modelType="manual";
 $("pick").textContent="Selecciona un partit per comparar els equips.";
 $("source").textContent=origin;
 $("nMatches").textContent=upcoming.length;
 $("nResults").textContent=past.length;
 $("teamCompare").innerHTML='<div class="empty">Selecciona un partit per veure la forma dels equips.</div>';
 $("modelNote").textContent="Selecciona un partit. El model automàtic només s'activa amb un historial suficient; els seus càlculs són experimentals.";
 $("autoBtn").disabled=true;
 renderMatches();renderHistory();calculate();
}
async function load(force=false){
 const id=$("league").value,token=++loadingId,btn=$("refresh");
 leagueId=id;leagueLabel=id==="esp.1"?"LaLiga":"Champions League";
 btn.disabled=true;$("message").textContent="Carregant calendari i resultats de "+leagueLabel+"...";
 let cache=cached(id);
 if(!force&&cache&&Date.now()-cache.saved<15*60000){
  adopt(cache.events,"ESPN · memòria cau");
  $("message").textContent="Dades desades a les "+new Date(cache.saved).toLocaleString("ca-ES")+". Prem Actualitzar per renovar-les.";
  btn.disabled=false;return;
 }
 try{
  const data=await fetchLeague(id);
  if(token!==loadingId)return;
  adopt(data,"ESPN · dades consultades");
  saveCache(id,data);loadedAt=new Date();
  $("message").textContent=data.length+" partits trobats de "+leagueLabel+" (temporada "+seasonBounds()[0].slice(0,4)+"/"+seasonBounds()[1].slice(0,4)+") · actualitzat "+loadedAt.toLocaleString("ca-ES")+".";
 }catch(e){
  if(token!==loadingId)return;
  if(cache&&cache.events.length){
   adopt(cache.events,"ESPN · còpia local");
   $("message").textContent="No s'ha pogut actualitzar ("+e.message+"). Mostrant la còpia guardada del "+new Date(cache.saved).toLocaleString("ca-ES")+".";
  }else{
   adopt([],"ESPN · no disponible");
   $("message").textContent="No s'han pogut recuperar dades: "+e.message+". Torna-ho a provar o importa un JSON.";
  }
 }
 btn.disabled=false;
}
function filteredUpcoming(){
 const q=$("search").value.trim().toLocaleLowerCase("ca");
 return upcoming.filter(e=>(e.strHomeTeam+" "+e.strAwayTeam).toLocaleLowerCase("ca").includes(q));
}
let expanded=false;
function renderMatches(){
 const filtered=filteredUpcoming(),max=expanded?filtered.length:32;
 $("matches").innerHTML=filtered.length?filtered.slice(0,max).map(x=>
 '<button class="match '+(selected?.idEvent===x.idEvent?"selected":"")+'" data-id="'+esc(x.idEvent)+'"><div class="match-line"><strong>'+esc(x.strHomeTeam)+' <span style="color:var(--muted)">vs</span> '+esc(x.strAwayTeam)+'</strong><span class="status"><span class="dot"></span>'+esc(x.live?"En joc":"Programat")+'</span></div><span class="date">'+when(x)+'</span></button>'
 ).join("")+(filtered.length>max?'<button class="btn secondary" id="moreMatches" style="width:100%">Mostrar els '+(filtered.length-max)+' partits restants</button>':"")
 :'<div class="empty">No hi ha partits programats amb aquest filtre dins del calendari rebut.</div>';
 document.querySelectorAll(".match[data-id]").forEach(b=>b.addEventListener("click",()=>{selected=upcoming.find(x=>x.idEvent===b.dataset.id);selectMatch();renderMatches()}));
 const more=$("moreMatches");if(more)more.onclick=()=>{expanded=true;renderMatches()};
}
function renderHistory(){
 const done=past.filter(e=>e.played).slice(0,12);
 $("recent").innerHTML=done.length?'<table class="history"><thead><tr><th>Dia</th><th>Partit</th><th>Resultat</th></tr></thead><tbody>'+done.map(x=>
 '<tr><td>'+dateOnly(x)+'</td><td>'+esc(x.strHomeTeam)+' – '+esc(x.strAwayTeam)+'</td><td><b>'+x.intHomeScore+'–'+x.intAwayScore+'</b></td></tr>').join("")+'</tbody></table>'
 :'<div class="empty">Encara no hi ha resultats complets a la mostra.</div>';
 const recent=done.slice(0,10).reverse(),ceiling=Math.max(5,...recent.map(x=>x.intHomeScore+x.intAwayScore));
 $("goalsChart").innerHTML=recent.length?recent.map(x=>'<div class="barbox" title="'+esc(x.strHomeTeam+" – "+x.strAwayTeam+": "+x.intHomeScore+"-"+x.intAwayScore)+'"><strong style="font-size:11px">'+(x.intHomeScore+x.intAwayScore)+'</strong><div class="bar" style="height:'+Math.round((x.intHomeScore+x.intAwayScore)/ceiling*100)+'%"></div><small>'+dateOnly(x)+'</small></div>').join("")
 :'<div class="empty" style="width:100%">Sense dades de gols.</div>';
}
function gamesFor(id,limit=10){return past.filter(e=>e.idHomeTeam===id||e.idAwayTeam===id).slice(0,limit)}
function teamStats(id,limit=10){
 const matches=gamesFor(id,limit),home=matches.filter(e=>e.idHomeTeam===id);
 let w=0,d=0,l=0,gf=0,ga=0;
 for(const e of matches){
  const h=e.idHomeTeam===id,f=h?e.intHomeScore:e.intAwayScore,a=h?e.intAwayScore:e.intHomeScore;
  gf+=f;ga+=a;if(f>a)w++;else if(f<a)l++;else d++;
 }
 return {n:matches.length,w,d,l,gf,ga,home,away:matches.filter(e=>e.idAwayTeam===id),matches};
}
function recentForm(t,id){
 return t.matches.slice(0,8).map(e=>{
  const local=e.idHomeTeam===id,gf=local?e.intHomeScore:e.intAwayScore,ga=local?e.intAwayScore:e.intHomeScore;
  const cls=gf>ga?"win":gf===ga?"draw":"loss",letter=gf>ga?"V":gf===ga?"E":"D";
  return '<span class="formbadge '+cls+'" title="'+esc(e.strHomeTeam+" "+e.intHomeScore+"-"+e.intAwayScore+" "+e.strAwayTeam)+'">'+letter+'</span>';
 }).join("");
}
function renderCompare(){
 if(!selected){$("teamCompare").innerHTML='<div class="empty">Selecciona un partit per veure la forma dels equips.</div>';return}
 const names=[selected.strHomeTeam,selected.strAwayTeam];
 const ids=[selected.idHomeTeam,selected.idAwayTeam];
 $("teamCompare").innerHTML='<div class="vsrow">'+ids.map((id,i)=>{
  const t=teamStats(id),games=t.n;
  return '<div class="teamcol"><b>'+esc(names[i])+'</b><small>Últims '+games+' partits · '+leagueLabel+'</small><div class="formrow">'+(recentForm(t,id)||'<span class="muted">Sense resultats</span>')+'</div><div class="teamnums"><span><b>'+t.w+'</b> victòries</span><span><b>'+t.d+'</b> empats</span><span><b>'+t.l+'</b> derrotes</span></div><div class="teamnums"><span>GF <b>'+t.gf+'</b></span><span>GC <b>'+t.ga+'</b></span><span>Mitjana GF <b>'+(games?(t.gf/games).toFixed(2):"—")+'</b></span></div></div>';
 }).join('<span class="vstext">VS</span>')+'</div>';
}
function autoEstimate(){
 if(!selected||selected.played)return null;
 const home=teamStats(selected.idHomeTeam,10),away=teamStats(selected.idAwayTeam,10);
 if(home.n<5||away.n<5||past.length<20)return {reason:"Mostra insuficient: "+home.n+" partits del local, "+away.n+" del visitant i "+past.length+" resultats de la competició (mínim 5, 5 i 20)."};
 const pool=past.filter(e=>e.played);
 const avgH=pool.reduce((s,e)=>s+e.intHomeScore,0)/pool.length;
 const avgA=pool.reduce((s,e)=>s+e.intAwayScore,0)/pool.length;
 if(!(avgH>0&&avgA>0))return {reason:"No es pot calcular una mitjana de gols vàlida."};
 const avg=(avgH+avgA)/2;
 const shrink=(value,n,baseline)=>(value*n+baseline*5)/(n+5);
 const aggregate=(games,id,side,field,baseline)=>{
  const n=games.length;
  const score=games.reduce((s,e)=>{
   const home=e.idHomeTeam===id;
   const teamGoals=home?e.intHomeScore:e.intAwayScore;
   const oppGoals=home?e.intAwayScore:e.intHomeScore;
   return s+(field==="for"?teamGoals:oppGoals);
  },0);
  return shrink(n?score/n:baseline,n,baseline);
 };
 const homeScored=aggregate(home.home,selected.idHomeTeam,"home","for",avgH);
 const awayConceded=aggregate(away.away,selected.idAwayTeam,"away","against",avgH);
 const awayScored=aggregate(away.away,selected.idAwayTeam,"away","for",avgA);
 const homeConceded=aggregate(home.home,selected.idHomeTeam,"home","against",avgA);
 // Ajusta el component local/visitant amb la mitjana global dels últims 10 partits.
 const ha=aggregate(home.matches,selected.idHomeTeam,"all","for",avg);
 const aa=aggregate(away.matches,selected.idAwayTeam,"all","for",avg);
 const homeLambda=clamp(.75*(homeScored*awayConceded/avgH)+.25*(ha*awayConceded/avgH),.25,4.5);
 const awayLambda=clamp(.75*(awayScored*homeConceded/avgA)+.25*(aa*homeConceded/avgA),.25,4.5);
 return {a:homeLambda,b:awayLambda,nH:home.n,nA:away.n,pool:pool.length};
}
function selectMatch(){
 if(!selected)return;
 $("pick").textContent=selected.strHomeTeam+" — "+selected.strAwayTeam+" · "+when(selected);
 renderCompare();
 const estimate=autoEstimate();
 if(estimate&&!estimate.reason){
  $("homeGoals").value=estimate.a.toFixed(2);$("awayGoals").value=estimate.b.toFixed(2);
  modelType="automatic";
  $("autoBtn").disabled=false;
  $("modelNote").textContent="Estimació automàtica experimental: últims "+estimate.nH+" i "+estimate.nA+" partits, "+estimate.pool+" resultats de "+leagueLabel+". Usa gols reals (no xG) amb suavitzat, sense lesions, ni validació predictiva. No és una garantia.";
 }else{
  modelType="manual";$("autoBtn").disabled=true;
  $("homeGoals").value="1.50";$("awayGoals").value="1.10";
  $("modelNote").textContent=(estimate?.reason||"Sense prou dades per estimar el partit.")+" Els valors següents són un exemple manual, NO una predicció.";
 }
 $("modelTag").textContent=modelType==="automatic"?"Dades històriques · experimental":"Escenari manual";
 calculate();
}
function poisson(k,l){let p=Math.exp(-l);for(let i=1;i<=k;i++)p*=l/i;return p}
function calculate(){
 const a=Number($("homeGoals").value),b=Number($("awayGoals").value);
 if(!(a>0&&a<=8&&b>0&&b<=8)){ $("probs").innerHTML='<div class="note" style="grid-column:span 3">Introdueix valors entre 0,1 i 8.</div>';$("fair").textContent="—";$("ev").textContent="—";return}
 let pr=[0,0,0];
 for(let i=0;i<=30;i++)for(let j=0;j<=30;j++){const v=poisson(i,a)*poisson(j,b);pr[i>j?0:i===j?1:2]+=v}
 const total=pr.reduce((x,y)=>x+y,0);probs=pr.map(p=>p/total);
 $("probs").innerHTML=probs.map((p,i)=>'<div class="prob"><span>'+["Local","Empat","Visitant"][i]+'</span><strong>'+pct(p)+'</strong></div>').join("");
 $("probbar").innerHTML=probs.map(p=>'<div style="width:'+pct(p)+'" title="'+pct(p)+'"></div>').join("");
 const idx=Number($("market").value),odd=Number($("odd").value),p=probs[idx];
 $("fair").textContent=(1/p).toFixed(2);
 const ev=odd>1?(p*odd-1)*100:NaN;
 $("ev").textContent=isFinite(ev)?(ev>=0?"+":"")+ev.toFixed(1)+"%":"—";
 $("ev").className="value "+(ev>=0?"positive":"negative");
 $("breakEven").textContent=odd>1?"Quota: probabilitat d'equilibri "+pct(1/odd)+". "+(modelType==="manual"?"AVÍS: probabilitats basades en un escenari manual.":"AVÍS: el model és experimental i pot errar."):"Cal una quota major que 1.";
}
function ledger(){
 $("nBets").textContent=records.length;
 const balance=records.reduce((sum,r)=>sum+(r.result==="win"?r.stake*(r.odd-1):r.result==="lose"?-r.stake:0),0);
 $("balance").textContent=money(balance);$("balance").className=balance>=0?"positive":"negative";
 $("ledger").innerHTML=records.length?records.slice().reverse().map((r,idx)=>{
  const i=records.length-idx-1;
  return '<tr><td>'+esc(r.match)+'</td><td>'+esc(r.market)+'</td><td>'+Number(r.odd).toFixed(2)+'</td><td>'+money(r.stake)+'</td><td>'+esc(({pending:"Pendent",win:"Encert",lose:"Fallada"})[r.result]??"Pendent")+'</td><td><select class="input resolution" data-index="'+i+'" aria-label="Resoldre simulació"><option value="pending" '+(r.result==="pending"?"selected":"")+'>Pendent</option><option value="win" '+(r.result==="win"?"selected":"")+'>Encert</option><option value="lose" '+(r.result==="lose"?"selected":"")+'>Fallada</option></select></td></tr>';
 }).join(""):'<tr><td colspan="6" class="muted">Encara no hi ha simulacions.</td></tr>';
 document.querySelectorAll(".resolution").forEach(s=>s.addEventListener("change",()=>{records[Number(s.dataset.index)].result=s.value;persist()}));
}
$("save").onclick=()=>{
 const stake=Number($("stake").value),bank=Number($("bankroll").value),odd=Number($("odd").value);
 if(!selected)return alert("Selecciona un partit abans.");
 if(!(stake>0&&bank>0&&stake<=bank&&stake<=20&&odd>1))return alert("Revisa import, límit i quota. Import virtual màxim: 20 €.");
 const open=records.filter(x=>x.result==="pending").reduce((s,x)=>s+x.stake,0);
 if(open+stake>bank)return alert("Superaries el límit de simulacions pendents.");
 records.push({match:selected.strHomeTeam+" - "+selected.strAwayTeam,market:$("market").selectedOptions[0].textContent,stake,odd,result:"pending",date:new Date().toISOString(),model:modelType});persist();
};
$("clear").onclick=()=>{if(confirm("Vols esborrar totes les simulacions locals?")){records=[];persist()}};
$("export").onclick=()=>{
 const blob=new Blob([JSON.stringify(records,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="futbollab-simulacions.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$("file").onchange=async ev=>{
 try{
  const file=ev.target.files?.[0];if(!file)return;
  const json=JSON.parse(await file.text());
  if(!Array.isArray(json)||!json.length)throw Error("Cal un array JSON de partits.");
  const games=json.map(normalizeImported).filter(Boolean);
  if(games.length!==json.length)throw Error("Alguns partits no tenen equips o data vàlida.");
  dataMode="importat";adopt(games,"JSON importat · font no verificada");
  $("message").textContent="S'han importat "+games.length+" partits. La qualitat de les estimacions depèn de la font del fitxer.";
 }catch(e){alert("No s'ha pogut importar: "+e.message)}
};
$("league").onchange=()=>{expanded=false;dataMode="real";load()};
$("refresh").onclick=()=>{expanded=false;dataMode="real";load(true)};
$("search").oninput=()=>{expanded=false;renderMatches()};
$("autoBtn").onclick=()=>{const e=autoEstimate();if(!e||e.reason)return;modelType="automatic";$("homeGoals").value=e.a.toFixed(2);$("awayGoals").value=e.b.toFixed(2);$("modelTag").textContent="Dades històriques · experimental";$("modelNote").textContent="Estimació automàtica experimental, basada en gols reals: "+e.nH+" i "+e.nA+" partits dels equips, "+e.pool+" de la competició. No inclou xG ni baixes.";calculate()};
["homeGoals","awayGoals"].forEach(id=>$(id).addEventListener("input",()=>{modelType="manual";$("modelTag").textContent="Escenari manual";calculate()}));
["market","odd"].forEach(id=>$(id).addEventListener("input",calculate));
ledger();calculate();load();
