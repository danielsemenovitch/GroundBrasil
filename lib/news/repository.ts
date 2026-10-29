import { env } from 'cloudflare:workers';
import bootstrap from '../../data/bootstrap.json';
import { SOURCES } from './sources';
import { makeEdition } from './core';
import { collectSourceFeeds } from './ingestion';
import { enrichArticlePhotos } from './photos';
import type { Edition, EditionResponse } from './types';

const bootstrapEdition=bootstrap as Edition;
const staleAfter=6*3600000;
export async function readEdition():Promise<EditionResponse> {
 if(!env.DB)throw new Error('Banco de dados indisponível');
 const row=await env.DB.prepare('SELECT data FROM editions WHERE id = ?').bind('latest').first<{data:string}>();
 const edition=row?JSON.parse(row.data) as Edition:bootstrapEdition;
 return {...edition,storage:row?'database':'snapshot',stale:Date.now()-Date.parse(edition.generatedAt)>staleAfter};
}
export async function refreshNews():Promise<{updated:boolean;edition:EditionResponse;message:string}> {
 const db=env.DB;if(!db)throw new Error('Banco de dados indisponível');
 const now=new Date().toISOString(),runId=crypto.randomUUID();
 // Atomic lease and cooldown protect publishers and concurrent refreshes.
 const lock=await db.prepare(`INSERT INTO pipeline_state(id,value) VALUES('refresh-lock',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value WHERE CAST(pipeline_state.value AS INTEGER) < ? RETURNING value`).bind(String(Date.now()+15*60000),Date.now()).first();
 if(!lock)return {updated:false,edition:await readEdition(),message:'A coleta já está em execução ou foi realizada há menos de 15 minutos.'};
 await db.prepare('INSERT INTO ingestion_runs(id,started_at,status) VALUES(?,?,?)').bind(runId,now,'running').run();
 try {
  const previous=await readEdition();
  const results=await Promise.all(SOURCES.map(source=>collectSourceFeeds(source,previous.feeds.find(f=>f.sourceId===source.id),now)));
  const healthy=results.filter(r=>r.status.ok).length;
  if(!healthy){
   const retained={...previous,feeds:results.map(r=>r.status)};
   await db.batch([
    db.prepare('UPDATE ingestion_runs SET finished_at=?,status=?,detail=? WHERE id=?').bind(new Date().toISOString(),'failed',JSON.stringify(retained.feeds),runId),
    db.prepare('INSERT INTO editions(id,generated_at,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind('latest',retained.generatedAt,JSON.stringify(retained))
   ]);
   return {updated:false,edition:{...retained,storage:'database'},message:'As fontes não responderam. A última edição foi preservada.'};
  }
  const draft=makeEdition([...previous.articles,...results.flatMap(r=>r.articles)],results.map(r=>r.status),now,previous.stories);
  const enriched=await enrichArticlePhotos(draft.articles,now);
  const byUrl=new Map(enriched.map(a=>[a.url,a]));
  const edition:Edition={...draft,articles:enriched,stories:draft.stories.map(story=>{
   const articles=story.articles.map(a=>byUrl.get(a.url)||a);
   return {...story,articles,image:articles.find(a=>a.image)?.image||null};
  })};
  // Bounded multirow upserts keep each statement under D1's 100 bound parameter limit.
  const statements:D1PreparedStatement[]=[];
  for(let i=0;i<edition.articles.length;i+=18){const group=edition.articles.slice(i,i+18);const sql=`INSERT INTO articles(id,source_id,url,published_at,data) VALUES ${group.map(()=>'(?,?,?,?,?)').join(',')} ON CONFLICT(id) DO UPDATE SET data=excluded.data,published_at=excluded.published_at`;statements.push(db.prepare(sql).bind(...group.flatMap(a=>[a.id,a.sourceId,a.url,a.publishedAt,JSON.stringify(a)])));}
  statements.push(db.prepare('DELETE FROM articles WHERE published_at < ?').bind(new Date(Date.now()-14*86400000).toISOString()));
  statements.push(db.prepare('INSERT INTO editions(id,generated_at,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET generated_at=excluded.generated_at,data=excluded.data').bind('latest',now,JSON.stringify(edition)));
  statements.push(db.prepare('UPDATE ingestion_runs SET finished_at=?,status=?,article_count=?,detail=? WHERE id=?').bind(new Date().toISOString(),healthy===SOURCES.length&&!edition.feeds.some(f=>f.partial)?'success':'partial',edition.articles.length,JSON.stringify(edition.feeds),runId));
  statements.push(db.prepare('DELETE FROM ingestion_runs WHERE started_at < ?').bind(new Date(Date.now()-30*86400000).toISOString()));
  await db.batch(statements);
  return {updated:true,edition:{...edition,storage:'database',stale:false},message:`Coleta concluída: ${healthy} de ${SOURCES.length} fontes disponíveis.`};
 }catch(error){await db.prepare('UPDATE ingestion_runs SET finished_at=?,status=?,detail=? WHERE id=?').bind(new Date().toISOString(),'failed',error instanceof Error?error.message:'Erro interno',runId).run();throw error;}
}
export async function authorizedUpdater(request:Request):Promise<boolean>{
 const token=env.INGEST_TOKEN;
 if(!token)return import.meta.env.DEV && ['localhost','terminal.local'].includes(new URL(request.url).hostname);
 const incoming=request.headers.get('authorization')||'';
 const encoder=new TextEncoder();const expected=await crypto.subtle.digest('SHA-256',encoder.encode(`Bearer ${token}`));const actual=await crypto.subtle.digest('SHA-256',encoder.encode(incoming));
 const a=new Uint8Array(expected),b=new Uint8Array(actual);let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;
}
