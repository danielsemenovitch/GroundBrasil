import { parseFeed } from './core.ts';
import type { Article, FeedEndpointStatus, FeedStatus, Source, SourceFeed } from './types.ts';

export const USER_AGENT = 'GroundNewsBrasil/0.1 (RSS; +https://ground-news-brasil.classyglade18.chatgpt.site/metodologia)';

export async function boundedText(response:Response, maxBytes=3_000_000):Promise<string>{
 if(Number(response.headers.get('content-length'))>maxBytes)throw new Error('Resposta acima do limite');
 const reader=response.body?.getReader();if(!reader)throw new Error('Resposta vazia');
 let length=0;const chunks:Uint8Array[]=[];
 for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>maxBytes){await reader.cancel();throw new Error('Resposta acima do limite');}chunks.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return new TextDecoder().decode(bytes);
}

/** Topic feeds belong to a publisher; they never count as additional sources. */
export async function collectSourceFeeds(source:Source,last:FeedStatus|undefined,now:string,fetcher:typeof fetch=fetch){
 const feeds:SourceFeed[]=[{url:source.feedUrl},...(source.additionalFeeds||[])];
 const results:{articles:Article[];status:FeedEndpointStatus}[]=[];
 // Three concurrent RSS requests at most per publisher, eight-second endpoint timeout.
 for(let i=0;i<feeds.length;i+=3){
  results.push(...await Promise.all(feeds.slice(i,i+3).map(async feed=>{
   const prior=last?.endpoints?.find(e=>e.url===feed.url)||(feed.url===source.feedUrl?last:undefined);
   const headers:Record<string,string>={'User-Agent':USER_AGENT,Accept:'application/rss+xml, application/xml, text/xml'};
   if(prior?.etag)headers['If-None-Match']=prior.etag;
   if(prior?.lastModified)headers['If-Modified-Since']=prior.lastModified;
   const status:FeedEndpointStatus={...feed,ok:false,count:0,fetchedAt:now,error:null};
   try{
    const response=await fetcher(feed.url,{headers,redirect:'manual',signal:AbortSignal.timeout(8000)});
    if(response.status===304){
     if(!prior?.ok)throw new Error('Resposta 304 sem edição anterior válida');
     return {articles:[],status:{...status,ok:true,count:prior.count,etag:prior.etag,lastModified:prior.lastModified}};
    }
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const articles=parseFeed(await boundedText(response),source,now,feed.category);
    if(!articles.length)throw new Error('Nenhum item válido');
    return {articles,status:{...status,ok:true,count:articles.length,etag:response.headers.get('etag')||undefined,lastModified:response.headers.get('last-modified')||undefined}};
   }catch(e){return {articles:[],status:{...status,error:e instanceof Error?e.message:'Falha na coleta'}};}
  })));
 }
 const articles=[...new Map(results.flatMap(r=>r.articles).map(a=>[a.url,a])).values()];
 const endpoints=results.map(r=>r.status),ok=endpoints.some(e=>e.ok),partial=ok&&endpoints.some(e=>!e.ok);
 const status:FeedStatus={sourceId:source.id,ok,partial,count:articles.length|| (ok?last?.count||0:0),fetchedAt:now,error:endpoints.filter(e=>!e.ok).map(e=>`${e.category||'RSS'}: ${e.error}`).join('; ')||null,endpoints};
 return {articles,status};
}
