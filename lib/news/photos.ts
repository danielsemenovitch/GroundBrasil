import { creditedImage, plainText } from './core.ts';
import { boundedText, USER_AGENT } from './ingestion.ts';
import { sourceById } from './sources.ts';
import type { Article, NewsImage, Source } from './types.ts';

function attribute(tag:string,name:string):string {
 const value=tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,'i'))?.[2]||'';
 return plainText(value);
}

/** Pair the photograph and its credit in the same figure, never unrelated page metadata. */
export function extractArticlePhoto(html:string,source:Source,articleUrl:string):NewsImage|null{
 if(!source.imagesAllowed||html.length>1_500_000)return null;
 if(source.id==='agencia-brasil'){
  const figure=(html.match(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi)||[]).find(f=>/<figcaption\b[^>]*class=["'][^"']*credito-foto/i.test(f));
  if(!figure)return null;
  const img=figure.match(/<img\b[^>]*>/i)?.[0]||'';
  const credit=figure.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1]||'';
  return creditedImage(source,articleUrl,attribute(img,'data-echo')||attribute(img,'src'),credit);
 }
 if(source.id==='senado'){
  const img=(html.match(/<img\b[^>]*>/gi)||[]).find(t=>/\bcredito\s*=/i.test(t)&&/fonteslide/i.test(attribute(t,'class')));
  return img?creditedImage(source,articleUrl,attribute(img,'src'),attribute(img,'credito')):null;
 }
 return null;
}

/** Bounded metadata-only enrichment. No article text is stored or rendered. */
export async function enrichArticlePhotos(articles:Article[],now:string,fetcher:typeof fetch=fetch):Promise<Article[]>{
 const updated=new Map<string,Article>(),deadline=Date.now()+32_000;
 await Promise.all(['agencia-brasil','senado'].map(async id=>{
  const source=sourceById(id)!;
  const candidates=articles.filter(a=>a.sourceId===id&&!a.image&&(!a.imageCheckedAt||Date.parse(now)-Date.parse(a.imageCheckedAt)>48*3600000)&&new URL(a.url).hostname===new URL(source.url).hostname&&(id==='agencia-brasil'?new URL(a.url).pathname.includes('/noticia/'):new URL(a.url).pathname.startsWith('/noticias/materias/'))).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
  // EBC requests, including its RSS, are separated by its ten-second crawl delay.
  let nextAt=Date.now()+(id==='agencia-brasil'?10_000:0);
  for(const article of candidates.slice(0,id==='agencia-brasil'?2:3)){
   const pause=Math.max(0,nextAt-Date.now());if(Date.now()+pause+4000>deadline)break;
   if(pause)await new Promise(resolve=>setTimeout(resolve,pause));
   nextAt=Date.now()+(id==='agencia-brasil'?10_000:0);
   try{
    const response=await fetcher(article.url,{headers:{'User-Agent':USER_AGENT,Accept:'text/html'},redirect:'manual',signal:AbortSignal.timeout(4000)});
    if(!response.ok)continue;
    const image=extractArticlePhoto(await boundedText(response,1_500_000),source,article.url);
    updated.set(article.url,{...article,image,imageCheckedAt:now});
   }catch{/* A missing photo never prevents publication of the news edition. */}
  }
 }));
 return articles.map(a=>updated.get(a.url)||a);
}
