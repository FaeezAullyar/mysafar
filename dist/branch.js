import {dateOf,dayKey,schoolDate,shiftSession,validSchoolDate} from './school.js';
import {rankCohorts} from './branch-model.js';

export function mountBranch({root,icon,escape,format,today,load,toast,preferences}){
 const $=s=>root.querySelector(s);
 let report=null,generation=0,disposed=false,presenting=false,refreshTimer;
 const number=n=>Number(n).toLocaleString('en-GB');
 const average=n=>n===null?'—':n.toFixed(2);
 const heading=()=>preferences.view==='daily'?'Daily memorisation':preferences.view==='quran'?'Qur’an averages':'Monthly passes';
 root.innerHTML=`<section class="branch-board" aria-label="Enfield branch dashboard"><header class="board-header"><div><div class="board-brand"><img src="/safar-logo.png" alt="Safar"><span>Enfield branch</span></div><h1 id="board-title"></h1></div><div class="board-actions"><button class="icon-button" id="board-refresh" aria-label="Refresh branch data">${icon('refresh')}</button><button class="secondary" id="board-fullscreen" aria-pressed="false">${icon('fullscreen')}<span>Full screen</span></button></div></header><div class="board-controls"><div class="segmented board-views" role="tablist" aria-label="Dashboard view">${[['daily','Memorisation'],['quran','Qur’an podium'],['passes','Passes podium']].map(([view,label])=>`<button role="tab" data-board-view="${view}">${label}</button>`).join('')}</div><div class="board-date"><button class="icon-button" id="board-previous" aria-label="Previous session">${icon('left')}</button><input id="board-date" type="date" aria-label="Dashboard session date" min="1900-01-01" max="2199-12-31" value="${preferences.date}"><button class="icon-button" id="board-next" aria-label="Next session">${icon('right')}</button><button class="text-button" id="board-today">${[0,6].includes(today().getDay())?'Today':'Latest session'}</button></div></div><div class="board-subline"><span id="board-period"></span><span id="board-status" role="status"></span></div><p id="board-error" class="form-error" role="alert"></p><div id="board-content" aria-busy="true"><div class="board-empty">Loading branch records…</div></div></section>`;
 function paint(){
  const standingsOpen=$('.branch-standings')?.open||false;
  $('#board-title').textContent=heading();
  root.querySelectorAll('[data-board-view]').forEach(button=>{const selected=button.dataset.boardView===preferences.view;button.classList.toggle('selected',selected);button.setAttribute('aria-selected',selected);});
  $('#board-date').value=preferences.date;
  $('#board-period').textContent=preferences.view==='daily'?format(dateOf(preferences.date),{weekday:'long',day:'numeric',month:'long',year:'numeric'}):`1–${dateOf(preferences.date).getDate()} ${format(dateOf(preferences.date),{month:'long',year:'numeric'})}`;
  if(!report)return;
  const groups=preferences.group==='houses'?report.houses:report.classes;
  if(preferences.view==='daily'){
   const metric=report.totals.daily;
   $('#board-content').innerHTML=`<div class="board-summary"><div><span>Passes today</span><strong>${number(metric.passes)}</strong></div><div><span>Classes recording passes</span><strong>${report.classes.filter(c=>c.daily.passes>0).length}<small> / ${report.classes.length}</small></strong></div><div><span>Passes this month</span><strong>${number(report.totals.monthly.passes)}</strong></div></div><div class="branch-classes">${report.classes.map((group,i)=>{
    const percent=group.students?Math.min(100,group.daily.passes/group.students*100):0;
    return `<button class="branch-class" data-branch-class="${i}" aria-label="${escape(group.name)}, ${escape(group.teacher)}, ${group.daily.passes} passes today. View passed targets."><div class="class-card-head"><h2>${escape(group.name)}</h2><span>${escape(group.teacher)}</span></div><div class="class-card-result"><div class="pass-ring"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26"/><circle class="ring-fill" style="opacity:${percent?1:0}" cx="32" cy="32" r="26" pathLength="100" stroke-dasharray="${percent} 100"/></svg><strong>${group.daily.passes}</strong></div><div><b>${group.daily.passes===1?'Pass':'Passes'}</b><span>${group.students} students</span></div></div><div class="class-levels" aria-hidden="true">${group.daily.levels.map(n=>`<i style="flex:${Math.max(n,.25)}" class="${n?'recorded':''}"></i>`).join('')}</div><div class="class-card-foot"><span>${group.daily.passes?group.daily.levels.map((n,l)=>n?'L'+(l+1):'').filter(Boolean).join(' · '):'No passes recorded'}</span>${icon('right')}</div></button>`;
   }).join('')||'<div class="board-empty">Classes appear here when teachers set up their class lists.</div>'}</div>`;
   root.querySelectorAll('[data-branch-class]').forEach(button=>button.onclick=()=>showClass(report.classes[Number(button.dataset.branchClass)]));
  }else{
   const ranked=rankCohorts(groups,preferences.view),quran=preferences.view==='quran';
   const value=g=>quran?average(g.value):number(g.value);
   $('#board-content').innerHTML=`<div class="podium-controls"><div class="segmented" role="tablist" aria-label="Rank by"><button role="tab" data-rank-group="classes" aria-selected="${preferences.group==='classes'}" class="${preferences.group==='classes'?'selected':''}">Classes</button><button role="tab" data-rank-group="houses" aria-selected="${preferences.group==='houses'}" class="${preferences.group==='houses'?'selected':''}">Houses</button></div><span>${quran?'Average score · out of 5':'Recorded target passes'}</span></div>${ranked.length?`<ol class="podium" aria-label="Leading ${preferences.group}">${ranked.slice(0,3).map((g,i)=>`<li class="podium-place place-${i+1} rank-${Math.min(3,g.rank)}"><div class="podium-person"><span class="podium-rank">${g.tied?'Joint ':''}${g.rank}</span><h2>${escape(g.name)}</h2>${g.teacher?`<span>${escape(g.teacher)}</span>`:''}</div><div class="podium-block"><strong>${value(g)}${quran?'<small> / 5</small>':''}</strong><span>${quran?`${number(g.monthly.scoreCount)} scores`:`${g.value===1?'pass':'passes'}`}</span>${icon(i===0?'trophy':'spark')}</div></li>`).join('')}</ol><details class="branch-standings" ${standingsOpen?'open':''}><summary>All ${groups.length} ${preferences.group} ${icon('down')}</summary><div class="standings-scroll"><table><thead><tr><th scope="col">Rank</th><th scope="col">${preferences.group==='houses'?'House':'Class'}</th><th scope="col">${quran?'Average':'Passes'}</th>${quran?'<th scope="col">Scores</th>':''}</tr></thead><tbody>${[...ranked,...groups.filter(g=>!ranked.some(r=>r.id===g.id)).map(g=>({...g,rank:null,value:null}))].map(g=>`<tr><td>${g.rank?`${g.tied?'=':''}${g.rank}`:'—'}</td><th scope="row">${escape(g.name)}${g.teacher?`<span>${escape(g.teacher)}</span>`:''}</th><td>${g.value===null?'—':value(g)}</td>${quran?`<td>${g.monthly.scoreCount}</td>`:''}</tr>`).join('')}</tbody></table></div></details>`:'<div class="board-empty">No results recorded for this month yet.</div>'}`;
   root.querySelectorAll('[data-rank-group]').forEach(button=>button.onclick=()=>{preferences.group=button.dataset.rankGroup;paint();});
  }
 }
 function showClass(group){
  const dialog=document.querySelector('#branch-class-dialog');
  dialog.innerHTML=`<div class="sheet-handle"></div><div class="dialog-top"><div><h2 id="branch-class-title">${escape(group.name)}</h2><p>${escape(group.teacher)} · ${format(dateOf(report.date),{day:'numeric',month:'short'})}</p></div><button class="icon-button" data-close aria-label="Close class results">${icon('close')}</button></div><div class="class-detail-totals"><strong>${group.daily.passes}<span> passes</span></strong><span>${group.students} students</span></div>${group.daily.targets.length?`<div class="target-results">${group.daily.targets.map(t=>`<div><b>L${t.level}T${t.target}</b><span>${t.count} ${t.count===1?'pass':'passes'}</span></div>`).join('')}</div>`:'<p class="board-empty">No passes recorded.</p>'}`;
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.showModal();
 }
 async function refresh(changed=false){
  const request=++generation,date=preferences.date;
  $('#board-refresh').disabled=true;$('#board-content').setAttribute('aria-busy','true');$('#board-error').textContent='';
  if(changed){report=null;$('#board-content').innerHTML='<div class="board-empty">Loading branch records…</div>';$('#board-status').textContent='';paint();}
  try{const result=await load(date);if(disposed||request!==generation)return;report=result;paint();$('#board-status').textContent='Updated '+format(new Date(),{hour:'2-digit',minute:'2-digit'});}
  catch(error){if(disposed||request!==generation)return;$('#board-error').textContent=(report?'Showing the last update. ':'')+error.message;if(!report)$('#board-content').innerHTML='<div class="board-empty">Use refresh to try again.</div>';}
  finally{if(!disposed&&request===generation){$('#board-refresh').disabled=false;$('#board-content').setAttribute('aria-busy','false');}}
 }
 function selectDate(date){if(!validSchoolDate(date)||date<'1900-01-01'||date>'2199-12-31'){toast('Choose a Saturday or Sunday.');$('#board-date').value=preferences.date;return;}if(date===preferences.date)return;preferences.date=date;refresh(true);}
 function setPresentation(on){presenting=on;document.body.classList.toggle('board-mode',on);$('#board-fullscreen').setAttribute('aria-pressed',String(on));$('#board-fullscreen').innerHTML=icon(on?'shrink':'fullscreen')+`<span>${on?'Exit full screen':'Full screen'}</span>`;}
 async function exitPresentation(){setPresentation(false);if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});}
 $('#board-fullscreen').onclick=async()=>{
  if(presenting)return exitPresentation();setPresentation(true);
  try{if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();}catch{toast('Presentation view is open. Browser fullscreen is unavailable.');}
 };
 const onFullscreen=()=>{if(!document.fullscreenElement&&presenting)setPresentation(false);};
 const onKey=e=>{if(e.key==='Escape'&&presenting&&!document.querySelector('dialog[open]'))exitPresentation();};
 document.addEventListener('fullscreenchange',onFullscreen);document.addEventListener('keydown',onKey);
 $('#board-refresh').onclick=()=>refresh();$('#board-date').onchange=e=>selectDate(e.target.value);
 $('#board-previous').onclick=()=>selectDate(dayKey(shiftSession(dateOf(preferences.date),-1)));
 $('#board-next').onclick=()=>selectDate(dayKey(shiftSession(dateOf(preferences.date),1)));
 $('#board-today').onclick=()=>selectDate(dayKey(schoolDate(today(),-1)));
 root.querySelectorAll('[data-board-view]').forEach(button=>button.onclick=()=>{preferences.view=button.dataset.boardView;paint();});
 const onVisible=()=>{if(!document.hidden)refresh();};document.addEventListener('visibilitychange',onVisible);
 refreshTimer=setInterval(()=>{if(!document.hidden&&!document.querySelector('dialog[open]'))refresh();},30000);
 paint();refresh();
 return ()=>{disposed=true;generation++;clearInterval(refreshTimer);document.removeEventListener('visibilitychange',onVisible);document.removeEventListener('fullscreenchange',onFullscreen);document.removeEventListener('keydown',onKey);document.body.classList.remove('board-mode');if(presenting&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});document.querySelector('#branch-class-dialog').close();};
}
