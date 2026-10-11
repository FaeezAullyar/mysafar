export const dayKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const dateOf = s => new Date(`${s}T12:00:00`);
export const addDays = (d,n) => new Date(d.getFullYear(),d.getMonth(),d.getDate()+n,12);
export const isSchoolDay = d => d.getDay()===6 || d.getDay()===0;
export function schoolDate(d,direction=1){let date=addDays(d,0);while(!isSchoolDay(date))date=addDays(date,direction);return date;}
export function shiftSession(d,count){let date=schoolDate(d,Math.sign(count)||1);for(let i=0;i<Math.abs(count);i++){date=schoolDate(addDays(date,Math.sign(count)),Math.sign(count));}return date;}
export function validSchoolDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value&&[0,6].includes(d.getUTCDay());}
export function sessionWindow(end,weeks){const last=schoolDate(dateOf(end),-1),saturday=addDays(last,last.getDay()===0?-1:0),start=addDays(saturday,-7*(weeks-1));const dates=[];for(let d=start;d<=last;d=shiftSession(d,1))dates.push(dayKey(d));return dates;}
