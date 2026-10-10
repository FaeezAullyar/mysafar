import { readFile } from 'node:fs/promises';
export async function openDatabase(env = process.env) {
 let db;
 if(env.PREVIEW_DB_PATH && env.NODE_ENV !== 'production') {
  const { PGlite } = await import('@electric-sql/pglite');
  const local = new PGlite(env.PREVIEW_DB_PATH);
  await local.waitReady;
  db={query:(...args)=>local.query(...args),transaction:fn=>local.transaction(tx=>fn(tx)),close:()=>local.close(),exec:sql=>local.exec(sql)};
 } else {
  if(!env.DATABASE_URL) throw new Error('DATABASE_URL is required. For a local preview, set PREVIEW_DB_PATH outside the source directory.');
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({connectionString:env.DATABASE_URL,max:10,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});
  db={query:(...args)=>pool.query(...args),exec:sql=>pool.query(sql),close:()=>pool.end(),transaction:async fn=>{const c=await pool.connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}};
 }
 await db.exec(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
 return db;
}
