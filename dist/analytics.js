import {sessionWindow} from './school.js';

export function buildAnalytics(data,filter,limits){
 const dates=sessionWindow(filter.end,filter.weeks),includedDates=new Set(dates);
 const students=data.students.filter(s=>(!filter.house||s.house===filter.house)&&(!filter.student||s.id===filter.student));
 const byId=new Map(students.map(s=>[s.id,s])),entries=[];
 for(const [key,value] of Object.entries(data.scores)){
  const [id,date,kind]=key.split('|');if(kind!==filter.kind||!byId.has(id)||!includedDates.has(date))continue;
  if(kind==='quran'&&(!Number.isInteger(value)||value<1||value>5))continue;
  if(kind==='memorisation'&&(!value||!Number.isInteger(value.level)||!Number.isInteger(value.target)||!limits[value.level]||value.target<1||value.target>limits[value.level]))continue;
  entries.push({student:byId.get(id),date,value});
 }
 entries.sort((a,b)=>a.date.localeCompare(b.date)||a.student.name.localeCompare(b.student.name));
 const groups=new Map(dates.map(date=>[date,[]]));for(const entry of entries)groups.get(entry.date).push(entry);
 const series=dates.map(date=>{const records=groups.get(date);return {date,count:records.length,value:records.length?(filter.kind==='quran'?records.reduce((sum,e)=>sum+e.value,0)/records.length:records.length):null};});
 const categories=filter.kind==='quran'?[1,2,3,4,5]:Object.keys(limits).map(Number);
 const distribution=categories.map(category=>({category,count:entries.filter(e=>(filter.kind==='quran'?e.value:e.value.level)===category).length}));
 const average=filter.kind==='quran'&&entries.length?entries.reduce((sum,e)=>sum+e.value,0)/entries.length:null;
 return {dates,students,entries,series,distribution,average};
}

export function targetPosition(value,limits){return Object.keys(limits).map(Number).filter(level=>level<value.level).reduce((sum,level)=>sum+limits[level],0)+value.target;}
