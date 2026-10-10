import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive=promisify(scrypt);
export const digest=value=>createHash('sha256').update(value).digest('hex');
export function safeEqual(a,b){const ah=Buffer.from(digest(a),'hex'),bh=Buffer.from(digest(b),'hex');return timingSafeEqual(ah,bh);}
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');const key=await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return `scrypt$32768$8$1$${salt}$${key.toString('hex')}`;}
export async function verifyPassword(password,stored){try{const [type,n,r,p,salt,hash]=stored.split('$');if(type!=='scrypt')return false;const key=await derive(password,salt,64,{N:Number(n),r:Number(r),p:Number(p),maxmem:64*1024*1024});const known=Buffer.from(hash,'hex');return key.length===known.length&&timingSafeEqual(key,known);}catch{return false;}}
export function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value&&value>='1900-01-01'&&value<='2199-12-31';}
export const validId = value => typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function validText(value,max){return typeof value==='string'&&value.trim().length>0&&value.trim().length<=max&&!/[\x00-\x1F]/.test(value);}
