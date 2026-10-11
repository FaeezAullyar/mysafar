import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dateOf,dayKey,schoolDate,shiftSession,sessionWindow,validSchoolDate} from '../dist/school.js';
import {buildAnalytics,targetPosition} from '../dist/analytics.js';
const limits={1:9,2:9,3:9,4:9,5:10,6:8,7:10,8:12};
const students=[{id:'a',name:'A',house:'Makkah'},{id:'b',name:'B',house:'Al-Aqsa'}];
const filter={kind:'quran',weeks:4,end:'2026-10-11',house:'',student:''};
test('session navigation skips weekdays in both directions across year and DST changes',()=>{
 for(const [start,step,end] of [['2026-10-11',1,'2026-10-17'],['2026-10-17',-1,'2026-10-11'],['2026-10-10',1,'2026-10-11'],['2026-12-27',1,'2027-01-02'],['2026-10-25',1,'2026-10-31']])assert.equal(dayKey(shiftSession(dateOf(start),step)),end);
 assert.equal(dayKey(schoolDate(dateOf('2026-10-14'))),'2026-10-17');
 assert.equal(dayKey(schoolDate(dateOf('2026-10-14'),-1)),'2026-10-11');
 assert.ok(validSchoolDate('2026-10-11'));assert.ok(!validSchoolDate('2026-10-12'));assert.ok(!validSchoolDate('2026-02-30'));
});
test('periods contain complete weekend sessions through the selected date only',()=>{
 const dates=sessionWindow('2026-10-11',4);assert.equal(dates.length,8);assert.equal(dates[0],'2026-09-19');assert.equal(dates.at(-1),'2026-10-11');assert.ok(dates.every(validSchoolDate));
 const saturday=sessionWindow('2026-10-10',4);assert.equal(saturday.length,7);assert.ok(!saturday.includes('2026-10-11'));
});
test('score averages use recorded entries and leave missing sessions as gaps',()=>{
 const data={students,scores:{'a|2026-10-10|quran':1,'b|2026-10-10|quran':5,'a|2026-10-11|quran':5}};
 const result=buildAnalytics(data,filter,limits);assert.equal(result.average,11/3);assert.equal(result.series.find(s=>s.date==='2026-10-10').value,3);assert.equal(result.series[0].value,null);assert.deepEqual(result.distribution.map(d=>d.count),[1,0,0,0,2]);
});
test('filters exclude weekdays, out-of-period entries, invalid scores and removed students',()=>{
 const data={students,scores:{'a|2026-10-10|quran':4,'b|2026-10-10|quran':2,'a|2026-10-09|quran':1,'a|2025-10-11|quran':1,'removed|2026-10-11|quran':5,'a|2026-10-11|quran':0}};
 assert.equal(buildAnalytics(data,filter,limits).entries.length,2);
 assert.equal(buildAnalytics(data,{...filter,house:'Makkah'},limits).average,4);
 assert.equal(buildAnalytics(data,{...filter,student:'b'},limits).average,2);
 assert.equal(buildAnalytics(data,{...filter,student:'b',house:'Makkah'},limits).entries.length,0);
});
test('memorisation charts count actual passes and preserve level/target positions',()=>{
 const data={students,scores:{'a|2026-10-10|memorisation':{level:8,target:12},'b|2026-10-10|memorisation':{level:1,target:4},'a|2026-10-11|memorisation':3,'b|2026-10-11|memorisation':{level:6,target:9}}};
 const result=buildAnalytics(data,{...filter,kind:'memorisation'},limits);assert.equal(result.entries.length,2);assert.equal(result.series.find(s=>s.date==='2026-10-10').value,2);assert.equal(result.series.at(-1).value,null);assert.equal(result.distribution[7].count,1);assert.equal(targetPosition({level:8,target:12},limits),76);assert.equal(targetPosition({level:2,target:1},limits),10);
});
