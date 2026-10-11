import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { digest,safeEqual,hashPassword,verifyPassword,validDate,validId,validText } from './security.js';
import sharp from 'sharp';
import {validSchoolDate} from '../dist/school.js';
import {HOUSES,TARGET_LIMITS,validPass} from './settings.js';
const publicDir=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new HttpError(status,message);};
const userView=u=>({id:u.id,email:u.email,name:u.name,bio:u.bio||'',theme:u.theme||'system',avatarVersion:u.avatar_version||0,onboardingCompleted:!!u.onboarding_completed});
async function body(req){
 if(!req.headers['content-type']?.toLowerCase().startsWith('application/json'))fail(415,'Send a JSON request.');
 let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>600000)fail(413,'This request is too large.');chunks.push(chunk);}
 try{const value=JSON.parse(Buffer.concat(chunks).toString());if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{fail(400,'The request could not be read.');}
}
export async function createApp(db,env=process.env){
 const production=env.NODE_ENV==='production';
 const demo=!production&&env.DEMO_MODE==='true';
 if(production&&(!env.APP_ORIGIN||!env.APP_ORIGIN.startsWith('https://')))throw new Error('APP_ORIGIN must be the HTTPS origin of your Railway app.');
 if(production&&!env.TEACHER_INVITE_CODE)throw new Error('TEACHER_INVITE_CODE is required to restrict registration to invited teachers.');
 const cookieName=production?'__Host-mysafar':'mysafar_session';
 const dummyHash=await hashPassword(randomBytes(32).toString('hex'));
 const sessionCookie=(token,maxAge=43200)=>`${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${production?'; Secure':''}`;
 async function rate(key,limit,minutes){
  const expiry=new Date(Date.now()+minutes*60000).toISOString();
  const result=await db.query('INSERT INTO auth_limits (key,attempts,expires_at) VALUES ($1,1,$2) ON CONFLICT (key) DO UPDATE SET attempts=CASE WHEN auth_limits.expires_at<NOW() THEN 1 ELSE auth_limits.attempts+1 END, expires_at=CASE WHEN auth_limits.expires_at<NOW() THEN $2 ELSE auth_limits.expires_at END RETURNING attempts',[digest(key),expiry]);
  if(result.rows[0].attempts>limit)fail(429,'Too many attempts. Please try again in 15 minutes.');
 }
 async function getSession(req){
  const match=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='));
  const token=match?.slice(cookieName.length+1);if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  const result=await db.query('SELECT t.id,t.name,t.email,t.bio,t.theme,t.avatar_version,t.onboarding_completed,s.token_hash FROM sessions s JOIN teachers t ON t.id=s.teacher_id WHERE s.token_hash=$1 AND s.expires_at>NOW()',[digest(token)]);return result.rows[0]||null;
 }
 async function login(res,user,req){
  const previous=await getSession(req);if(previous)await db.query('DELETE FROM sessions WHERE token_hash=$1',[previous.token_hash]);
  const token=randomBytes(32).toString('hex');await db.query('INSERT INTO sessions (token_hash,teacher_id,expires_at) VALUES ($1,$2,$3)',[digest(token),user.id,new Date(Date.now()+43200000).toISOString()]);res.setHeader('Set-Cookie',sessionCookie(token));return {user:userView(user)};
 }
 return async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  if(production)res.setHeader('Strict-Transport-Security','max-age=31536000');
  const respond=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
   const pathname=new URL(req.url,'http://localhost').pathname;
   if(!pathname.startsWith('/api/')){
    if(!['GET','HEAD'].includes(req.method))fail(405,'Method not allowed.');
    const file=pathname==='/'?'index.html':decodeURIComponent(pathname).replace(/^\//,'');
    const absolute=path.resolve(publicDir,file);
    if(!absolute.startsWith(publicDir+path.sep)&&absolute!==path.join(publicDir,'index.html'))fail(404,'Page not found.');
    const ext=path.extname(absolute);if(!types[ext])fail(404,'Page not found.');
    let content;try{content=await readFile(absolute);}catch{fail(404,'Page not found.');}
    res.writeHead(200,{'Content-Type':types[ext],'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:content);return;
   }
   if(!['GET','POST','PUT','DELETE'].includes(req.method))fail(405,'Method not allowed.');
   if(req.method!=='GET'){
    const expected=env.APP_ORIGIN||`http://${req.headers.host}`;
    if(req.headers.origin!==expected)fail(403,'This request is not allowed from another website.');
    if(req.headers['sec-fetch-site']&& !['same-origin','none'].includes(req.headers['sec-fetch-site']))fail(403,'This request is not allowed from another website.');
   }
   if(pathname==='/api/health'&&req.method==='GET'){await db.query('SELECT 1');return respond(200,{ok:true});}
   if(pathname==='/api/config'&&req.method==='GET')return respond(200,{demo,authReady:true,schoolDays:[6,0],houses:HOUSES,targetLimits:TARGET_LIMITS});
   if(pathname==='/api/auth/signup'&&req.method==='POST'){
    await rate('signup-network:'+req.socket.remoteAddress,30,15);
    const data=await body(req);const {name,password,invite}=data;const email=typeof data.email==='string'?data.email.trim().toLowerCase():'';
    if(!validText(name,80)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)fail(400,'Enter your name and a valid email address.');
    if(typeof password!=='string'||password.length<12||password.length>128)fail(400,'Use a password between 12 and 128 characters.');
    if(typeof invite!=='string'||!env.TEACHER_INVITE_CODE||!safeEqual(invite,env.TEACHER_INVITE_CODE))fail(403,'The teacher access code is not valid.');
    const hash=await hashPassword(password);let user;
    try{const result=await db.query('INSERT INTO teachers (id,email,name,password_hash) VALUES ($1,$2,$3,$4) RETURNING id,email,name',[randomUUID(),email,name.trim(),hash]);user=result.rows[0];}catch(e){if(e.code==='23505')fail(409,'An account cannot be created with these details. Try logging in or contact your administrator.');throw e;}
    return respond(201,await login(res,user,req));
   }
   if(pathname==='/api/auth/login'&&req.method==='POST'){
    await rate('login-network:'+req.socket.remoteAddress,100,15);
    const data=await body(req);const email=typeof data.email==='string'?data.email.trim().toLowerCase():'';
    if(!email||email.length>254||typeof data.password!=='string'||data.password.length>128)fail(400,'Enter your email address and password.');
    await rate('login-account:'+email,15,15);
    const result=await db.query('SELECT id,email,name,password_hash,bio,theme,avatar_version,onboarding_completed FROM teachers WHERE email=$1',[email]);const user=result.rows[0];
    const valid=await verifyPassword(data.password,user?.password_hash||dummyHash);
    if(!user||!valid)fail(401,'The email address or password is incorrect.');
    await db.query('DELETE FROM auth_limits WHERE key=$1',[digest('login-account:'+email)]);
    return respond(200,await login(res,user,req));
   }
   const user=await getSession(req);
   if(pathname==='/api/session'&&req.method==='GET')return respond(200,{user:user?userView(user):null});
   if(!user)fail(401,'Your session has ended. Please log in again.');
   if(pathname==='/api/profile'&&req.method==='PUT'){
    const data=await body(req);
    if(Object.hasOwn(data,'name')&&!validText(data.name,80))fail(400,'Enter a name up to 80 characters.');
    if(Object.hasOwn(data,'bio')&&(typeof data.bio!=='string'||data.bio.length>280||/[\x00-\x08\x0B-\x1F]/.test(data.bio)))fail(400,'Use a profile description up to 280 characters.');
    if(Object.hasOwn(data,'theme')&&!['system','light','dark'].includes(data.theme))fail(400,'Choose a valid appearance.');
    if(Object.hasOwn(data,'onboardingCompleted')&&typeof data.onboardingCompleted!=='boolean')fail(400,'Invalid tutorial setting.');
    const result=await db.query('UPDATE teachers SET name=COALESCE($1,name),bio=COALESCE($2,bio),theme=COALESCE($3,theme),onboarding_completed=COALESCE($4,onboarding_completed) WHERE id=$5 RETURNING id,email,name,bio,theme,avatar_version,onboarding_completed',[data.name?.trim()??null,data.bio?.trim()??null,data.theme??null,data.onboardingCompleted??null,user.id]);
    return respond(200,{user:userView(result.rows[0])});
   }
   if(pathname==='/api/profile/photo'&&req.method==='PUT'){
    const data=await body(req);
    if(typeof data.image!=='string'||data.image.length>550000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(data.image))fail(400,'Choose a JPG, PNG or WebP photo.');
    let photo;
    try{photo=await sharp(Buffer.from(data.image.split(',')[1],'base64'),{limitInputPixels:16000000}).rotate().resize(256,256,{fit:'cover'}).jpeg({quality:85}).toBuffer();}catch{fail(400,'This photo could not be opened. Choose another image.');}
    const result=await db.query('UPDATE teachers SET avatar=$1,avatar_version=avatar_version+1 WHERE id=$2 RETURNING avatar_version',[photo,user.id]);
    return respond(200,{avatarVersion:result.rows[0].avatar_version});
   }
   if(pathname==='/api/profile/photo'&&req.method==='DELETE'){
    await db.query('UPDATE teachers SET avatar=NULL,avatar_version=0 WHERE id=$1',[user.id]);return respond(200,{avatarVersion:0});
   }
   const photoMatch=pathname.match(/^\/api\/teachers\/([a-f0-9-]+)\/photo$/);
   if(photoMatch&&req.method==='GET'){
    if(!validId(photoMatch[1]))fail(404,'Photo not found.');
    const result=await db.query('SELECT avatar FROM teachers WHERE id=$1',[photoMatch[1]]);
    if(!result.rows[0]?.avatar)fail(404,'Photo not found.');
    res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','Vary':'Cookie'});return res.end(Buffer.from(result.rows[0].avatar));
   }
   if(pathname==='/api/teachers'&&req.method==='GET'){
    const url=new URL(req.url,'http://localhost');const q=(url.searchParams.get('q')||'').slice(0,80);const offset=Number(url.searchParams.get('offset')||0);
    if(!Number.isInteger(offset)||offset<0||offset>100000)fail(400,'Invalid page.');
    const result=await db.query("SELECT id,name,bio,avatar_version FROM teachers WHERE name ILIKE $1 ORDER BY LOWER(name),id LIMIT 51 OFFSET $2",['%'+q.replace(/[\\%_]/g,'\\$&')+'%',offset]);
    return respond(200,{teachers:result.rows.slice(0,50).map(t=>({id:t.id,name:t.name,bio:t.bio,avatarVersion:t.avatar_version,branch:'Enfield'})),hasMore:result.rows.length>50});
   }
   if(pathname==='/api/auth/logout'&&req.method==='POST'){await db.query('DELETE FROM sessions WHERE token_hash=$1',[user.token_hash]);res.setHeader('Set-Cookie',sessionCookie('',0));return respond(200,{ok:true});}
   if(pathname==='/api/data'&&req.method==='GET'){
    const [teacher,students,scores,passes]=await Promise.all([db.query('SELECT class_name FROM teachers WHERE id=$1',[user.id]),db.query('SELECT id,name,house FROM students WHERE teacher_id=$1 ORDER BY position,id',[user.id]),db.query("SELECT student_id,TO_CHAR(day,'YYYY-MM-DD') AS day,value FROM scores WHERE teacher_id=$1 AND kind='quran'",[user.id]),db.query("SELECT student_id,TO_CHAR(day,'YYYY-MM-DD') AS day,level,target FROM memorisation_passes WHERE teacher_id=$1",[user.id])]);
    return respond(200,{className:teacher.rows[0].class_name,students:students.rows,scores:Object.fromEntries([...scores.rows.map(r=>[`${r.student_id}|${r.day}|quran`,r.value]),...passes.rows.map(r=>[`${r.student_id}|${r.day}|memorisation`,{level:r.level,target:r.target}])])});
   }
   if(pathname==='/api/class'&&req.method==='PUT'){
    const data=await body(req);
    if(!validText(data.className,80)||!Array.isArray(data.students)||data.students.length<1||data.students.length>200)fail(400,'Add a class name and between 1 and 200 students.');
    if(data.students.some(s=>!s||!validId(s.id)||!validText(s.name,80)||!HOUSES.includes(s.house))||new Set(data.students.map(s=>s.id)).size!==data.students.length)fail(400,'Every student needs a name and a house: Makkah, Al-Aqsa or Madinah.');
    await db.transaction(async tx=>{
     await tx.query('SELECT id FROM teachers WHERE id=$1 FOR UPDATE',[user.id]);
     await tx.query('UPDATE teachers SET class_name=$1 WHERE id=$2',[data.className.trim(),user.id]);
     await tx.query('DELETE FROM students WHERE teacher_id=$1 AND NOT (id=ANY($2::uuid[]))',[user.id,data.students.map(s=>s.id)]);
     for(let i=0;i<data.students.length;i++){const s=data.students[i];await tx.query('INSERT INTO students (id,teacher_id,name,house,position) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (teacher_id,id) DO UPDATE SET name=EXCLUDED.name,house=EXCLUDED.house,position=EXCLUDED.position',[s.id,user.id,s.name.trim(),s.house.trim(),i]);}
    });return respond(200,{ok:true});
   }
   if(pathname==='/api/scores'&&req.method==='PUT'){
    const data=await body(req);
    if(!validId(data.studentId)||!validDate(data.date)||!['quran','memorisation'].includes(data.kind))fail(400,'Choose a valid student, date and tracker.');
    if(!validSchoolDate(data.date))fail(400,'Classes run on Saturdays and Sundays. Choose a weekend date.');
    if(data.value!==null&&(data.kind==='quran'?!(Number.isInteger(data.value)&&data.value>=1&&data.value<=5):!validPass(data.value)))fail(400,data.kind==='quran'?'Choose a score from 1 to 5.':'Choose a valid level and target.');
    await db.transaction(async tx=>{
     await tx.query('SELECT id FROM teachers WHERE id=$1 FOR UPDATE',[user.id]);
     const owner=await tx.query('SELECT id FROM students WHERE id=$1 AND teacher_id=$2',[data.studentId,user.id]);if(!owner.rows.length)fail(404,'This student is not in your class.');
     if(data.kind==='memorisation'){
      if(data.value===null)await tx.query('DELETE FROM memorisation_passes WHERE teacher_id=$1 AND student_id=$2 AND day=$3',[user.id,data.studentId,data.date]);
      else await tx.query('INSERT INTO memorisation_passes (teacher_id,student_id,day,level,target) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (teacher_id,student_id,day) DO UPDATE SET level=EXCLUDED.level,target=EXCLUDED.target,updated_at=NOW()',[user.id,data.studentId,data.date,data.value.level,data.value.target]);
     }else if(data.value===null)await tx.query('DELETE FROM scores WHERE teacher_id=$1 AND student_id=$2 AND day=$3 AND kind=$4',[user.id,data.studentId,data.date,data.kind]);
     else await tx.query('INSERT INTO scores (teacher_id,student_id,day,kind,value) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (teacher_id,student_id,day,kind) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()',[user.id,data.studentId,data.date,data.kind,data.value]);
    });return respond(200,{ok:true});
   }
   fail(404,'Page not found.');
  }catch(error){if(!error.status)console.error('Request failed:',error.code||error.name);if(!res.headersSent)respond(error.status||500,{error:error.status?error.message:'We could not save this change. Please try again.'});else res.end();}
 };
}
