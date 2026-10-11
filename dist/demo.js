import {dayKey,schoolDate,shiftSession} from './school.js';
import {buildBranchReport} from './branch-model.js';

const sampleTeachers=[['Amina Rahman','Al-Ikhlas'],['Yusuf Ahmed','Al-Falaq'],['Maryam Hassan','An-Nas'],['Ibrahim Khan','Al-Kawthar'],['Fatima Ali','Al-Asr'],['Omar Patel','Al-Qadr'],['Zainab Noor','Al-Fil'],['Hamza Malik','Quraysh'],['Khadija Hussein','Al-Ma’un'],['Bilal Mahmood','At-Tin'],['Hafsa Siddiq','Ad-Duha'],['Ismail Akhtar','Ash-Sharh'],['Sumayya Osman','Al-A’la'],['Adam Farooq','Al-Ghashiyah']];
export function demoTeachers(user,data){
 return [{...user,className:data.className,branch:'Enfield'},...sampleTeachers.map(([name,title],i)=>({id:'sample-'+i,name,className:`Class ${i<3?i+1:i+2} · ${title}`,bio:'Qur’an and memorisation teacher',branch:'Enfield',avatarVersion:0}))];
}

export function demoBranchReport(user,data,date,today,config){
 const roster=[],quran=[],passes=[],teachers=demoTeachers(user,data),anchor=schoolDate(today,-1);
 for(const house of config.houses)roster.push({teacherId:user.id,teacherName:user.name,className:data.className,house,studentCount:data.students.filter(s=>s.house===house).length});
 const byId=new Map(data.students.map(s=>[s.id,s]));
 for(const [key,value] of Object.entries(data.scores)){
  const [id,day,kind]=key.split('|'),student=byId.get(id);if(!student)continue;
  const row={teacherId:user.id,house:student.house,day,count:1};
  if(kind==='quran')quran.push({...row,total:value});else if(kind==='memorisation'&&value&&typeof value==='object')passes.push({...row,...value});
 }
 for(let i=1;i<teachers.length;i++){
  const teacher=teachers[i],size=9+i%7;
  for(let h=0;h<3;h++)roster.push({teacherId:teacher.id,teacherName:teacher.name,className:teacher.className,house:config.houses[h],studentCount:Array.from({length:size},(_,s)=>s).filter(s=>s%3===h).length});
  for(let offset=-15;offset<=0;offset++){
   const day=dayKey(shiftSession(anchor,offset));
   for(let s=0;s<size;s++){
    if((s+i-offset)%9===0)continue;
    const row={teacherId:teacher.id,house:config.houses[s%3],day,count:1};
    quran.push({...row,total:Math.max(1,Math.min(5,2+(i%3)+((s*7+i-offset)%3)-1))});
    if((s*3+i-offset)%(3+i%3)<2){const level=1+(s+i)%8;passes.push({...row,level,target:1+(s+i-offset)%config.targetLimits[level]});}
   }
  }
 }
 return buildBranchReport({roster,quran,passes},date,config.houses,config.targetLimits);
}
