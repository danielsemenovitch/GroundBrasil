import { env } from 'cloudflare:workers';
import bootstrap from '../../data/bootstrap.json';
import { SOURCES } from './sources';
import { makeEdition, parseFeed } from './core';
import type { Article, Edition, EditionResponse, FeedStatus } from './types';

const bootstrapEdition=bootstrap as Edition;
const staleAfter=6*3600000;
export async function readEdition():Promise<EditionResponse> {
 if(!env.DB)throw new Error('Banco de dados indisponível');
 const row=await env.DB.prepare('SELECT data FROM editions WHERE id = ?').bind('latest').first<{data:string}>();
 const edition=row?JSON.parse(row.data) as Edition:bootstrapEdition;
 return {...edition,storage:row?'database':'snapshot',stale:Date.now()-Date.parse(edition.generatedAt)>staleAfter};
}
async function boundedText(response:Response):Promise<string>{
 if(Number(response.headers.get('content-length'))>3_000_000)throw new Error('Feed acima do limite');
 const reader=response.body?.getReader();if(!reader)throw new Error('Feed vazio');
 let length=0;const chunks:Uint8Array[]=[];
 for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>3_000_000){await reader.cancel();throw new Error('Feed acima do limite');}chunks.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return new TextDecoder().decode(bytes);
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
  const results=await Promise.all(SOURCES.map(async source=>{
   const last=previous.feeds.find(f=>f.sourceId===source.id);const headers:Record<string,string>={'User-Agent':'GroundNewsBrasil/0.1 (RSS; +https://ground-news-brasil.classyglade18.chatgpt.site/metodologia)','Accept':'application/rss+xml, application/xml, text/xml'};
   if(last?.etag)headers['If-None-Match']=last.etag;if(last?.lastModified)headers['If-Modified-Since']=last.lastModified;
   try {
    const response=await fetch(source.feedUrl,{headers,redirect:'manual',signal:AbortSignal.timeout(18000)});
    if(response.status===304)return {articles:[] as Article[],status:{...last!,ok:true,fetchedAt:now,error:null}};
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const articles=parseFeed(await boundedText(response),source,now);
    if(!articles.length)throw new Error('Nenhum item válido');
    return {articles,status:{sourceId:source.id,ok:true,count:articles.length,fetchedAt:now,error:null,etag:response.headers.get('etag')||undefined,lastModified:response.headers.get('last-modified')||undefined} as FeedStatus};
   }catch(e){return {articles:[] as Article[],status:{sourceId:source.id,ok:false,count:0,fetchedAt:now,error:e instanceof Error?e.message:'Falha na coleta'} as FeedStatus};}
  }));
  const healthy=results.filter(r=>r.status.ok).length;
  if(!healthy){
   const retained={...previous,feeds:results.map(r=>r.status)};
   await db.batch([
    db.prepare('UPDATE ingestion_runs SET finished_at=?,status=?,detail=? WHERE id=?').bind(new Date().toISOString(),'failed',JSON.stringify(retained.feeds),runId),
    db.prepare('INSERT INTO editions(id,generated_at,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind('latest',retained.generatedAt,JSON.stringify(retained))
   ]);
   return {updated:false,edition:{...retained,storage:'database'},message:'As fontes não responderam. A última edição foi preservada.'};
  }
  const edition=makeEdition([...previous.articles,...results.flatMap(r=>r.articles)],results.map(r=>r.status),now,previous.stories);
  // Bounded multirow upserts keep each statement under D1's 100 bound parameter limit.
  const statements:D1PreparedStatement[]=[];
  for(let i=0;i<edition.articles.length;i+=18){const group=edition.articles.slice(i,i+18);const sql=`INSERT INTO articles(id,source_id,url,published_at,data) VALUES ${group.map(()=>'(?,?,?,?,?)').join(',')} ON CONFLICT(id) DO UPDATE SET data=excluded.data,published_at=excluded.published_at`;statements.push(db.prepare(sql).bind(...group.flatMap(a=>[a.id,a.sourceId,a.url,a.publishedAt,JSON.stringify(a)])));}
  statements.push(db.prepare('DELETE FROM articles WHERE published_at < ?').bind(new Date(Date.now()-14*86400000).toISOString()));
  statements.push(db.prepare('INSERT INTO editions(id,generated_at,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET generated_at=excluded.generated_at,data=excluded.data').bind('latest',now,JSON.stringify(edition)));
  statements.push(db.prepare('UPDATE ingestion_runs SET finished_at=?,status=?,article_count=?,detail=? WHERE id=?').bind(new Date().toISOString(),healthy===SOURCES.length?'success':'partial',edition.articles.length,JSON.stringify(edition.feeds),runId));
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
