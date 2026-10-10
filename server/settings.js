import {readFile} from 'node:fs/promises';
export const HOUSES = ['Makkah', 'Al-Aqsa', 'Madinah'];
export const TARGET_LIMITS = JSON.parse(await readFile(new URL('./curriculum.json',import.meta.url),'utf8'));
export function validPass(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const {level,target}=value;
 if(!Number.isInteger(level)||!Number.isInteger(target)||level<1||target<1||level>32767||target>32767)return false;
 if(Object.keys(TARGET_LIMITS).length)return Object.hasOwn(TARGET_LIMITS,String(level))&&target<=TARGET_LIMITS[level];
 return true;
}
