import {resolve} from 'node:path';
import {mkdir} from 'node:fs/promises';
if(process.env.NODE_ENV==='production')throw new Error('Use npm start for production. The preview is for local testing only.');
process.env.DEMO_MODE='true';
process.env.PREVIEW_DB_PATH ||= resolve('.local-preview/db');
process.env.TEACHER_INVITE_CODE ||= 'SAFAR-PREVIEW';
await mkdir(process.env.PREVIEW_DB_PATH,{recursive:true});
await import('./index.js');
