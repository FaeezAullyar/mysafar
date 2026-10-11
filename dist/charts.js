import {buildAnalytics,targetPosition} from './analytics.js';
import {dateOf,validSchoolDate} from './school.js';

const plural=(n,one,many=one+'s')=>`${n} ${n===1?one:many}`;

export function renderDataView({root,data,config,filter,icon,escape,format,onEdit}){
 const $=s=>root.querySelector(s),mem=filter.kind==='memorisation';
 const model=buildAnalytics(data,filter,config.targetLimits),total=model.entries.length;
 const title=mem?{line:'Passes by session',pie:'Passes by level',scatter:'Passed targets'}:{line:'Score trend',pie:'Score distribution',scatter:'Individual scores'};
 const period=model.dates.length?`${format(dateOf(model.dates[0]),{day:'numeric',month:'short'})} – ${format(dateOf(model.dates.at(-1)),{day:'numeric',month:'short',year:'numeric'})}`:'';
 const selectedStudent=data.students.find(s=>s.id===filter.student),scope=[selectedStudent?.name||'All students',filter.house].filter(Boolean).join(' · ');
 root.innerHTML=`<section class="data-view view-enter"><div class="data-heading"><h1>Data</h1><button class="secondary filter-button" id="data-filters">${icon('filter')} Filters${filter.house||filter.student?'<span class="filter-dot"></span>':''}</button></div><div class="data-controls"><div class="segmented" role="tablist" aria-label="Data subject"><button role="tab" data-data-kind="quran" aria-selected="${!mem}" class="${mem?'':'selected'}">${icon('book')} Qur’an</button><button role="tab" data-data-kind="memorisation" aria-selected="${mem}" class="${mem?'selected':''}">${icon('spark')} Memorisation</button></div><div class="chart-tabs" role="tablist" aria-label="Chart type">${['line','pie','scatter'].map(type=>`<button id="chart-tab-${type}" role="tab" data-chart-type="${type}" aria-controls="chart-panel" aria-selected="${filter.chart===type}" class="${filter.chart===type?'selected':''}">${icon(type)}<span>${{line:'Line',pie:'Pie',scatter:'Scatter'}[type]}</span></button>`).join('')}</div></div><section class="chart-card" id="chart-panel" role="tabpanel" aria-labelledby="chart-tab-${filter.chart}"><div class="chart-heading"><div><h2>${title[filter.chart]}</h2><p>${escape(scope)}</p></div><div class="chart-summary"><strong>${mem?total:model.average===null?'—':model.average.toFixed(1)}${!mem&&model.average!==null?'<small> / 5</small>':''}</strong><span>${mem?(total===1?'recorded pass':'recorded passes'):'average score'}</span></div></div><div class="chart-period"><span>${period}</span><span>${mem?plural(total,'pass','passes'):plural(total,'score')}</span></div>${!data.students.length?`<div class="chart-empty">${icon('chart')}<h3>Add your class to view data</h3><button class="primary" id="data-edit-class">Set up class</button></div>`:!total?`<div class="chart-empty">${icon('chart')}<h3>No entries in this period</h3><button class="secondary" id="empty-filters">Change filters</button></div>`:chartMarkup(model,mem,filter.chart,config,escape,format)}<div class="chart-readout" id="chart-readout" role="status" aria-live="polite">${total?`${plural(new Set(model.entries.map(e=>e.student.id)).size,'student')} · ${plural(model.series.filter(s=>s.count).length,'session')} recorded`:''}</div></section></section>`;
 const redraw=()=>renderDataView({root,data,config,filter,icon,escape,format,onEdit});
 root.querySelectorAll('[data-data-kind]').forEach(button=>button.onclick=()=>{filter.kind=button.dataset.dataKind;redraw();root.querySelector(`[data-data-kind="${filter.kind}"]`).focus({preventScroll:true});});
 root.querySelectorAll('[data-chart-type]').forEach(button=>button.onclick=()=>{filter.chart=button.dataset.chartType;redraw();root.querySelector(`[data-chart-type="${filter.chart}"]`).focus({preventScroll:true});});
 root.querySelectorAll('[data-chart-detail]').forEach(point=>{
  const show=()=>{$('#chart-readout').textContent=point.dataset.chartDetail;};
  point.onpointerenter=show;point.onfocus=show;point.onclick=show;
  point.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}};
 });
 const openFilters=()=>{
  const dialog=document.querySelector('#data-filter-dialog');
  dialog.innerHTML=`<div class="sheet-handle"></div><div class="dialog-top"><h2 id="data-filter-title">Filter data</h2><button class="icon-button" id="close-data-filters" aria-label="Close data filters">${icon('close')}</button></div><form id="data-filter-form"><div class="filter-field-row"><div class="field"><label for="data-weeks">Period</label><select id="data-weeks">${[4,8,12].map(weeks=>`<option value="${weeks}" ${filter.weeks===weeks?'selected':''}>${weeks} weekends</option>`).join('')}</select></div><div class="field"><label for="data-end">Through session</label><input id="data-end" type="date" min="1900-01-06" max="2199-12-29" value="${filter.end}" required></div></div><div class="field"><label for="data-house">House</label><select id="data-house"><option value="">All houses</option>${config.houses.map(house=>`<option value="${escape(house)}" ${filter.house===house?'selected':''}>${escape(house)}</option>`).join('')}</select></div><div class="field"><label for="data-student">Student</label><select id="data-student"></select></div><p class="form-error" id="data-filter-error" role="alert"></p><div class="filter-actions"><button class="secondary" type="button" id="reset-data-filters">Reset filters</button><button class="primary" type="submit">Apply filters</button></div></form>`;
  const query=s=>dialog.querySelector(s);
  const updateStudents=(chosen='')=>{const house=query('#data-house').value;query('#data-student').innerHTML='<option value="">All students</option>'+data.students.filter(s=>!house||s.house===house).map(s=>`<option value="${s.id}" ${s.id===chosen?'selected':''}>${escape(s.name)}</option>`).join('');};
  updateStudents(filter.student);query('#data-house').onchange=()=>updateStudents(query('#data-student').value);
  query('#close-data-filters').onclick=()=>dialog.close();
  query('#reset-data-filters').onclick=()=>{query('#data-house').value='';query('#data-weeks').value='8';query('#data-end').value=filter.defaultEnd;updateStudents();query('#data-filter-error').textContent='';};
  query('#data-filter-form').onsubmit=e=>{e.preventDefault();const end=query('#data-end').value;if(!validSchoolDate(end)){query('#data-filter-error').textContent='Choose a Saturday or Sunday.';return;}Object.assign(filter,{weeks:Number(query('#data-weeks').value),end,house:query('#data-house').value,student:query('#data-student').value});dialog.close();redraw();};
  dialog.showModal();
 };
 $('#data-filters').onclick=openFilters;$('#empty-filters')?.addEventListener('click',openFilters);$('#data-edit-class')?.addEventListener('click',onEdit);
}

function chartMarkup(model,mem,type,config,escape,format){
 const shortDate=date=>format(dateOf(date),{day:'numeric',month:'short'});
 const fullDate=date=>format(dateOf(date),{weekday:'short',day:'numeric',month:'short',year:'numeric'});
 const detail=text=>`tabindex="0" role="button" aria-label="${escape(text)}" data-chart-detail="${escape(text)}"`;
 if(type==='pie'){
  let offset=0;const total=model.entries.length,radius=82,circumference=2*Math.PI*radius;
  const slices=model.distribution.filter(item=>item.count).map(item=>{const share=item.count/total,length=circumference*share,label=`${mem?'Level':'Score'} ${item.category}`,text=`${label} · ${mem?plural(item.count,'pass','passes'):plural(item.count,'score')} · ${(share*100).toFixed(1)}%`,position=offset;offset+=length;return {...item,share,label,text,position,length};});
  return `<div class="pie-layout"><svg class="pie-chart" viewBox="0 0 250 250" role="group" aria-label="${mem?'Passes by level':'Score distribution'}"><circle cx="125" cy="125" r="82" fill="none" stroke="var(--soft)" stroke-width="36"/>${slices.map(s=>`<circle class="pie-slice chart-color-${s.category}" cx="125" cy="125" r="${radius}" fill="none" stroke-width="36" stroke-dasharray="${s.length} ${circumference-s.length}" stroke-dashoffset="${-s.position}" transform="rotate(-90 125 125)" ${detail(s.text)}><title>${escape(s.text)}</title></circle>`).join('')}<text x="125" y="122" class="pie-total" text-anchor="middle">${total}</text><text x="125" y="145" class="pie-caption" text-anchor="middle">${mem?(total===1?'pass':'passes'):(total===1?'score':'scores')}</text></svg><div class="chart-legend">${model.distribution.map(s=>{const label=`${mem?'Level':'Score'} ${s.category}`,text=`${label} · ${mem?plural(s.count,'pass','passes'):plural(s.count,'score')} · ${(s.count/total*100).toFixed(1)}%`;return `<button data-chart-detail="${escape(text)}" aria-label="${escape(text)}"><i class="legend-color chart-color-${s.category}"></i><span>${label}</span><b>${s.count}</b><small>${Math.round(s.count/total*100)}%</small></button>`;}).join('')}</div></div>`;
 }
 const mobile=matchMedia('(max-width:700px)').matches,width=mobile?360:720,height=mobile?290:310,left=mobile?38:54,right=22,top=24,bottom=45,plotW=width-left-right,plotH=height-top-bottom;
 const targetMax=Object.values(config.targetLimits).reduce((sum,n)=>sum+n,0);
 const maxY=mem?(type==='scatter'?targetMax:Math.max(1,...model.series.map(s=>s.count))):5;
 const minY=mem?0:1;
 const x=index=>left+index/Math.max(1,model.dates.length-1)*plotW;
 const y=value=>top+(maxY-value)/(maxY-minY)*plotH;
 const ticks=mem?(type==='scatter'?Object.entries(config.targetLimits).map(([level,target])=>({value:targetPosition({level:Number(level),target},config.targetLimits),label:`L${level}`})):Array.from(new Set([0,Math.ceil(maxY/4),Math.ceil(maxY/2),Math.ceil(maxY*.75),maxY])).map(value=>({value,label:value}))):[1,2,3,4,5].map(value=>({value,label:value}));
 const axis=ticks.map(t=>`<line class="chart-gridline" x1="${left}" x2="${width-right}" y1="${y(t.value)}" y2="${y(t.value)}"/><text class="chart-axis" x="${left-13}" y="${y(t.value)+4}" text-anchor="end">${t.label}</text>`).join('');
 const labelIndices=[0,Math.round((model.dates.length-1)/3),Math.round((model.dates.length-1)*2/3),model.dates.length-1];
 const xAxis=[...new Set(labelIndices)].map(i=>`<text class="chart-axis" x="${x(i)}" y="${height-17}" text-anchor="${i===0?'start':i===model.dates.length-1?'end':'middle'}">${shortDate(model.dates[i])}</text>`).join('');
 let marks;
 if(type==='line'){
  const paths=[];let current=[];for(let i=0;i<model.series.length;i++){const s=model.series[i];if(s.value===null){if(current.length)paths.push(current);current=[];}else current.push(`${x(i)},${y(s.value)}`);}if(current.length)paths.push(current);
  marks=paths.map(points=>`<polyline class="chart-line" points="${points.join(' ')}"/>`).join('')+model.series.map((s,i)=>{if(s.value===null)return '';const text=`${fullDate(s.date)} · ${mem?plural(s.count,'pass','passes'):'Average '+s.value.toFixed(2)+' of 5 · '+plural(s.count,'score')}`;return `<g class="chart-point" ${detail(text)}><circle class="chart-hit" cx="${x(i)}" cy="${y(s.value)}" r="13"/><circle class="line-dot" cx="${x(i)}" cy="${y(s.value)}" r="4.5"/><title>${escape(text)}</title></g>`;}).join('');
 }else{
  const positions=new Map();marks=model.entries.map(e=>{const value=mem?targetPosition(e.value,config.targetLimits):e.value,key=e.date+'|'+value,index=positions.get(key)||0;positions.set(key,index+1);const jitter=index===0?0:((index%2?1:-1)*Math.min(7,Math.ceil(index/2)*2.5));const text=`${e.student.name} · ${fullDate(e.date)} · ${mem?`L${e.value.level}T${e.value.target} passed`:`Score ${e.value} of 5`} · ${e.student.house}`;return `<g class="chart-point" ${detail(text)}><circle class="chart-hit" cx="${x(model.dates.indexOf(e.date))+jitter}" cy="${y(value)}" r="9"/><circle class="scatter-dot house-color-${config.houses.indexOf(e.student.house)}" cx="${x(model.dates.indexOf(e.date))+jitter}" cy="${y(value)}" r="5"/><title>${escape(text)}</title></g>`;}).join('');
 }
 return `<div class="plot-wrap"><div class="axis-title">${mem?(type==='line'?'Recorded passes':'Level / target'):(type==='line'?'Average score':'Score')}</div><svg class="data-plot" viewBox="0 0 ${width} ${height}" role="group" aria-label="${mem?'Memorisation':'Qur’an'} ${type==='line'?'line chart':'scatter plot'}">${axis}${xAxis}${marks}</svg>${type==='scatter'?`<div class="scatter-legend">${config.houses.map((house,i)=>`<span><i class="house-color-${i}"></i>${escape(house)}</span>`).join('')}</div>`:''}</div>`;
}
