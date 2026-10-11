import {validSchoolDate} from './school.js';

const measures=()=>({passes:0,scoreCount:0,scoreTotal:0,average:null,levels:Array(8).fill(0),targets:[]});
const cohort=(id,name,extra={})=>({id,name,...extra,students:0,daily:measures(),monthly:measures()});
const count=n=>Number.isInteger(Number(n))&&Number(n)>0?Number(n):0;

// Only aggregate records cross the branch boundary; no pupil names or IDs.
export function buildBranchReport({roster,quran,passes},date,houses,limits){
 const monthStart=date.slice(0,7)+'-01',classes=new Map(),houseMap=new Map(houses.map(h=>[h,cohort(h,h)])),totals=cohort('branch','Enfield');
 for(const row of roster){
  if(!classes.has(row.teacherId))classes.set(row.teacherId,cohort(row.teacherId,row.className,{teacher:row.teacherName}));
  const size=count(row.studentCount);classes.get(row.teacherId).students+=size;totals.students+=size;
  if(houseMap.has(row.house))houseMap.get(row.house).students+=size;
 }
 const eligible=row=>classes.has(row.teacherId)&&houseMap.has(row.house)&&validSchoolDate(row.day)&&row.day>=monthStart&&row.day<=date;
 const destinations=row=>[classes.get(row.teacherId),houseMap.get(row.house),totals];
 for(const row of quran){
  const n=count(row.count),total=Number(row.total);if(!eligible(row)||!n||!Number.isFinite(total)||total<n||total>n*5)continue;
  for(const group of destinations(row))for(const period of row.day===date?['daily','monthly']:['monthly']){group[period].scoreCount+=n;group[period].scoreTotal+=total;}
 }
 for(const row of passes){
  const n=count(row.count),level=Number(row.level),target=Number(row.target);
  if(!eligible(row)||!n||!Number.isInteger(level)||!Number.isInteger(target)||!limits[level]||target<1||target>limits[level])continue;
  for(const group of destinations(row))for(const period of row.day===date?['daily','monthly']:['monthly']){
   const metric=group[period];metric.passes+=n;metric.levels[level-1]+=n;
   let entry=metric.targets.find(t=>t.level===level&&t.target===target);if(!entry){entry={level,target,count:0};metric.targets.push(entry);}entry.count+=n;
  }
 }
 for(const group of [...classes.values(),...houseMap.values(),totals])for(const metric of [group.daily,group.monthly]){
  metric.average=metric.scoreCount?metric.scoreTotal/metric.scoreCount:null;
  metric.targets.sort((a,b)=>a.level-b.level||a.target-b.target);
 }
 return {date,monthStart,classes:[...classes.values()].sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})||a.teacher.localeCompare(b.teacher)),houses:[...houseMap.values()],totals};
}

export function rankCohorts(groups,metric){
 const key=metric==='quran'?'average':'passes';
 const ranked=groups.filter(g=>key==='average'?g.monthly.scoreCount>0:g.monthly.passes>0).map(g=>({...g,value:key==='average'?Number(g.monthly[key].toFixed(2)):g.monthly[key]}));
 ranked.sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,undefined,{numeric:true})||a.id.localeCompare(b.id));
 let rank=0,previous;
 return ranked.map((g,i)=>{if(g.value!==previous)rank=i+1;previous=g.value;return {...g,rank,tied:ranked.filter(other=>other.value===g.value).length>1};});
}
