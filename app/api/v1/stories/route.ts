import { readEdition } from '@/lib/news/repository';
import { normalize } from '@/lib/news/core';
export async function GET(request:Request){
 try{
  const edition=await readEdition(),url=new URL(request.url),q=normalize((url.searchParams.get('q')||'').slice(0,120)),category=url.searchParams.get('category');
  const offset=Math.max(0,Math.min(800,Number(url.searchParams.get('offset'))||0));const limit=Math.max(1,Math.min(240,Number(url.searchParams.get('limit'))||60));
  let stories=edition.stories.filter(s=>(!category||category==='Todas'||s.category===category)&&(!q||normalize(`${s.title} ${s.summary} ${s.articles.map(a=>a.title).join(' ')}`).includes(q)));
  if(url.searchParams.get('multiple')==='1')stories=stories.filter(s=>s.sourceIds.length>1);
  if(url.searchParams.get('sort')==='coverage')stories.sort((a,b)=>b.sourceIds.length-a.sourceIds.length||b.updatedAt.localeCompare(a.updatedAt));
  return Response.json({version:1,stories:stories.slice(offset,offset+limit),total:stories.length,generatedAt:edition.generatedAt,storage:edition.storage,stale:edition.stale,feeds:edition.feeds,articleCount:edition.articles.length,storyCount:edition.stories.length},{headers:{'Cache-Control':'public, max-age=60, stale-while-revalidate=300'}});
 }catch{return Response.json({error:'Não foi possível carregar as notícias. Tente novamente.'},{status:503,headers:{'Retry-After':'60'}});}
}
