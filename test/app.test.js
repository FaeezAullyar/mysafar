import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {TARGET_LIMITS} from '../server/settings.js';
import {openDatabase} from '../server/db.js';
import {createApp} from '../server/app.js';
import {hashPassword,verifyPassword,validDate} from '../server/security.js';
let db,server,origin,alice,bob;
const studentId=randomUUID();
async function request(route,{method='GET',data,cookie,foreign=false}={}){
 const res=await fetch(origin+'/api'+route,{method,headers:{'Content-Type':'application/json',Origin:foreign?'https://malicious.example':origin,...(cookie?{Cookie:cookie}:{})},...(data!==undefined?{body:JSON.stringify(data)}:{})});
 return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')};
}
before(async()=>{db=await openDatabase({PREVIEW_DB_PATH:'memory://'});const app=await createApp(db,{TEACHER_INVITE_CODE:'test-invitation',DEMO_MODE:'true'});server=createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();});
test('passwords use different salted hashes and verify correctly',async()=>{const a=await hashPassword('a proper test password');const b=await hashPassword('a proper test password');assert.notEqual(a,b);assert.ok(await verifyPassword('a proper test password',a));assert.equal(await verifyPassword('wrong password',a),false);assert.ok(!a.includes('a proper test password'));});
test('date validation rejects overflow and accepts leap day',()=>{assert.ok(validDate('2028-02-29'));assert.equal(validDate('2026-02-29'),false);assert.equal(validDate('2026-13-01'),false);});
test('static resources are served and sensitive source files are unavailable',async()=>{for(const resource of ['/','/styles.css','/app.js','/safar-logo.png'])assert.equal((await fetch(origin+resource)).status,200);assert.equal((await fetch(origin+'/server/schema.sql')).status,404);assert.equal((await fetch(origin+'/.env')).status,404);});
test('unauthenticated access and cross-origin mutations are rejected',async()=>{assert.equal((await request('/data')).status,401);assert.equal((await request('/auth/signup',{method:'POST',foreign:true,data:{}})).status,403);});
test('invitation-only signup creates isolated accounts with HttpOnly sessions',async()=>{
 const data={name:'Alice Teacher',email:'alice@example.test',password:'secure test password 123',invite:'wrong'};
 assert.equal((await request('/auth/signup',{method:'POST',data})).status,403);
 const a=await request('/auth/signup',{method:'POST',data:{...data,invite:'test-invitation'}});assert.equal(a.status,201);assert.ok(a.cookie.includes('HttpOnly'));assert.ok(a.cookie.includes('SameSite=Strict'));alice=a.cookie.split(';')[0];
 const b=await request('/auth/signup',{method:'POST',data:{...data,name:'Bob Teacher',email:'bob@example.test',invite:'test-invitation'}});assert.equal(b.status,201);bob=b.cookie.split(';')[0];
 const rows=await db.query('SELECT password_hash FROM teachers');assert.ok(rows.rows.every(r=>r.password_hash.startsWith('scrypt$')));
 const tokens=await db.query('SELECT token_hash FROM sessions');assert.ok(tokens.rows.every(r=>!alice.includes(r.token_hash)));
 assert.deepEqual((await request('/data',{cookie:alice})).body.students,[]);
});
test('class data belongs to the authenticated account and validates all entries',async()=>{
 const data={className:'Morning class',students:[{id:studentId,name:'Test Student',house:'Makkah'}]};
 assert.equal((await request('/class',{method:'PUT',cookie:alice,data:{...data,students:[{...data.students[0],name:''}]}})).status,400);
 assert.equal((await request('/class',{method:'PUT',cookie:alice,data})).status,200);
 assert.equal((await request('/data',{cookie:alice})).body.students[0].name,'Test Student');
 assert.deepEqual((await request('/data',{cookie:bob})).body.students,[]);
});
test('scores persist, validate range, separate subjects and reject another teacher',async()=>{
 const data={studentId,date:'2026-10-10',kind:'quran',value:5};
 assert.equal((await request('/scores',{method:'PUT',cookie:bob,data})).status,404);
 for(const value of [0,6,'5',1.5])assert.equal((await request('/scores',{method:'PUT',cookie:alice,data:{...data,value}})).status,400);
 assert.equal((await request('/scores',{method:'PUT',cookie:alice,data:{...data,date:'2026-02-30'}})).status,400);
 assert.equal((await request('/scores',{method:'PUT',cookie:alice,data})).status,200);
 assert.equal((await request('/scores',{method:'PUT',cookie:alice,data:{...data,kind:'memorisation',value:{level:1,target:4}}})).status,200);
 const saved=(await request('/data',{cookie:alice})).body.scores;
 assert.equal(saved[`${studentId}|2026-10-10|quran`],5);assert.deepEqual(saved[`${studentId}|2026-10-10|memorisation`],{level:1,target:4});
 assert.deepEqual((await request('/data',{cookie:bob})).body.scores,{});
 assert.equal((await request('/scores',{method:'PUT',cookie:alice,data:{...data,value:null}})).status,200);
 assert.equal((await request('/data',{cookie:alice})).body.scores[`${studentId}|2026-10-10|quran`],undefined);
});

test('weekend-only tracking rejects weekday entries for both subjects',async()=>{
 assert.deepEqual((await request('/config')).body.schoolDays,[6,0]);
 for(const date of ['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16']){
  for(const kind of ['quran','memorisation']){
   const response=await request('/scores',{method:'PUT',cookie:alice,data:{studentId,date,kind,value:kind==='quran'?4:{level:1,target:4}}});
   assert.equal(response.status,400);assert.match(response.body.error,/Saturdays and Sundays/);
  }
 }
 assert.equal((await request('/scores',{method:'PUT',cookie:alice,data:{studentId,date:'2026-10-11',kind:'quran',value:4}})).status,200);
});
test('memorisation enforces the exact level and target boundaries',async()=>{
 assert.deepEqual(TARGET_LIMITS,{'1':9,'2':9,'3':9,'4':9,'5':10,'6':8,'7':10,'8':12});
 const data={studentId,date:'2026-10-11',kind:'memorisation'};
 for(const [level,max] of Object.entries(TARGET_LIMITS)){
  assert.equal((await request('/scores',{method:'PUT',cookie:alice,data:{...data,value:{level:Number(level),target:max}}})).status,200);
  assert.equal((await request('/scores',{method:'PUT',cookie:alice,data:{...data,value:{level:Number(level),target:max+1}}})).status,400);
 }
 for(const value of [3,{}, {level:9,target:1},{level:1,target:0},{level:1,target:1.5},{level:'1',target:1}])assert.equal((await request('/scores',{method:'PUT',cookie:alice,data:{...data,value}})).status,400);
 assert.equal((await request('/scores',{method:'PUT',cookie:alice,data:{...data,value:null}})).status,200);
 assert.equal((await request('/data',{cookie:alice})).body.scores[`${studentId}|2026-10-11|memorisation`],undefined);
});
test('old numeric memorisation values are retained but never interpreted as passes',async()=>{
 const id=(await request('/session',{cookie:alice})).body.user.id;
 await db.query("INSERT INTO scores (teacher_id,student_id,day,kind,value) VALUES ($1,$2,'2026-10-01','memorisation',3)",[id,studentId]);
 assert.equal((await request('/data',{cookie:alice})).body.scores[`${studentId}|2026-10-01|memorisation`],undefined);
 assert.equal((await db.query("SELECT value FROM scores WHERE teacher_id=$1 AND kind='memorisation'",[id])).rows[0].value,3);
});

test('editing students preserves scores; removal cascades only their own records',async()=>{
 assert.equal((await request('/class',{method:'PUT',cookie:alice,data:{className:'Updated class',students:[{id:studentId,name:'New Name',house:'Al-Aqsa'}]}})).status,200);
 assert.deepEqual((await request('/data',{cookie:alice})).body.scores[`${studentId}|2026-10-10|memorisation`],{level:1,target:4});
 const replacement=randomUUID();await request('/class',{method:'PUT',cookie:alice,data:{className:'Updated class',students:[{id:replacement,name:'Another Student',house:'Madinah'}]}});
 assert.deepEqual((await request('/data',{cookie:alice})).body.scores,{});
});
test('logout invalidates server sessions and login restores saved class',async()=>{
 assert.equal((await request('/auth/logout',{method:'POST',cookie:alice,data:{}})).status,200);
 assert.equal((await request('/data',{cookie:alice})).status,401);
 assert.equal((await request('/auth/login',{method:'POST',data:{email:'alice@example.test',password:'wrong'}})).status,401);
 const login=await request('/auth/login',{method:'POST',data:{email:'ALICE@example.test',password:'secure test password 123'}});assert.equal(login.status,200);
 alice=login.cookie.split(';')[0];assert.equal((await request('/data',{cookie:alice})).body.className,'Updated class');
});
test('repeated failed logins are rate limited',async()=>{for(let i=0;i<15;i++)assert.equal((await request('/auth/login',{method:'POST',data:{email:'absent@example.test',password:'wrong'}})).status,401);assert.equal((await request('/auth/login',{method:'POST',data:{email:'absent@example.test',password:'wrong'}})).status,429);});

test('profiles persist theme and tutorial settings without modifying other teachers',async()=>{
 const bobBefore=(await request('/session',{cookie:bob})).body.user;
 const result=await request('/profile',{method:'PUT',cookie:alice,data:{name:'Alice Updated',bio:'Qur’an teacher',theme:'dark',onboardingCompleted:true,id:bobBefore.id}});
 assert.equal(result.status,200);assert.equal(result.body.user.name,'Alice Updated');
 const saved=(await request('/session',{cookie:alice})).body.user;assert.equal(saved.theme,'dark');assert.equal(saved.onboardingCompleted,true);
 assert.equal((await request('/session',{cookie:bob})).body.user.name,bobBefore.name);
 assert.equal((await request('/profile',{method:'PUT',cookie:alice,data:{theme:'invalid'}})).status,400);
 assert.equal((await request('/profile',{method:'PUT',cookie:alice,data:{bio:'x'.repeat(281)}})).status,400);
 assert.equal((await request('/profile',{method:'PUT',foreign:true,cookie:alice,data:{name:'Hacked'}})).status,403);
});
test('directory is authenticated, searchable and excludes credentials and class records',async()=>{
 assert.equal((await request('/teachers')).status,401);
 const directory=(await request('/teachers',{cookie:alice})).body;
 assert.equal(directory.teachers.length,2);assert.ok(directory.teachers.some(t=>t.name==='Bob Teacher'));
 for(const teacher of directory.teachers){assert.equal(teacher.email,undefined);assert.equal(teacher.password_hash,undefined);assert.equal(teacher.class_name,undefined);assert.equal(teacher.students,undefined);}
 assert.equal((await request('/teachers?q=Bob',{cookie:alice})).body.teachers.length,1);
 assert.equal((await request('/teachers?offset=-1',{cookie:alice})).status,400);
});
test('profile photos are normalised, access-controlled and removable',async()=>{
 const image=await sharp({create:{width:100,height:200,channels:3,background:'#2288cc'}}).png().toBuffer();
 const response=await request('/profile/photo',{method:'PUT',cookie:alice,data:{image:'data:image/png;base64,'+image.toString('base64')}});
 assert.equal(response.status,200);
 const id=(await request('/session',{cookie:alice})).body.user.id;
 assert.equal((await request(`/teachers/${id}/photo`)).status,401);
 const photo=await fetch(origin+`/api/teachers/${id}/photo`,{headers:{Cookie:bob}});assert.equal(photo.status,200);assert.equal(photo.headers.get('content-type'),'image/jpeg');
 const metadata=await sharp(Buffer.from(await photo.arrayBuffer())).metadata();assert.equal(metadata.width,256);assert.equal(metadata.height,256);assert.equal(metadata.exif,undefined);
 assert.equal((await request('/profile/photo',{method:'PUT',cookie:alice,data:{image:'data:image/svg+xml;base64,PHN2Zz4='}})).status,400);
 assert.equal((await request('/profile/photo',{method:'PUT',cookie:alice,data:{image:'data:image/png;base64,YmFk'}})).status,400);
 assert.equal((await request('/profile/photo',{method:'DELETE',cookie:alice,data:{}})).status,200);
 assert.equal((await request(`/teachers/${id}/photo`,{cookie:bob})).status,404);
});

test('expired sessions no longer authenticate',async()=>{await db.query('UPDATE sessions SET expires_at=$1',[new Date(0).toISOString()]);assert.equal((await request('/data',{cookie:alice})).status,401);assert.equal((await request('/data',{cookie:bob})).status,401);});
