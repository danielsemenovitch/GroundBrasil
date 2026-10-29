import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { ELECTION_REVIEW } from '../../data/editorial.ts';
import { SOURCES } from './sources.ts';
import type { Article, Category, Edition, FeedStatus, Source, Story, Leaning } from './types.ts';
const STOP = new Set('a o as os um uma uns umas de da do das dos em no na nos nas por para com e ou que se ao aos à às é são foi ser mais após sobre nesta neste entre como pelo pela pelos pelas seu sua seus suas diz afirma noticia noticias brasil brasileiro brasileira governo presidente feira terça quarta quinta sexta segunda sabado domingo'.split(' '));
export const normalize = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function plainText(s:string):string {
 return s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(Number(n),0x10ffff))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(Math.min(parseInt(n,16),0x10ffff))).replace(/&(?:nbsp|amp|quot|apos|lt|gt);/g,x=>({'&nbsp;':' ','&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'}[x]!)).replace(/\s+/g,' ').trim();
}
export function canonicalUrl(raw:string,base?:string):string|null {
 try {const u=new URL(raw,base);if(u.protocol!=='https:'&&u.protocol!=='http:')return null;u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid|ref$)/i.test(k))u.searchParams.delete(k);return u.href.replace(/\/$/,'');}catch{return null;}
}
export function hash(s:string):string {let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
export function tokens(s:string):string[] {return [...new Set(normalize(s).match(/[a-z0-9]+/g)?.filter(t=>t.length>2&&!STOP.has(t))||[])];}
export function categorize(title:string,tags:string[],url:string):Category {
 const t=normalize(`${title} ${tags.join(' ')} ${url}`);
 if(/saude|vacina|dengue|cancer|hospital|medicin/.test(t))return 'Saúde';
 if(/ciencia|pesquisa|cientific|tecnologia|inteligencia artificial|universidade/.test(t))return 'Ciência';
 if(/esporte|futebol|copa|flamengo|palmeiras|olimpic/.test(t))return 'Esportes';
 if(/cultura|cinema|musica|festival|livro|literatura/.test(t))return 'Cultura';
 if(/economia|juros|inflacao|banco central|pib|dolar|imposto|emprego|fiscal|renda|orcament|gasto publico|financeir|indeniz|tributari|aliquota|cana-de-acucar/.test(t))return 'Economia';
 if(/internacional|mundo|eua|trump|israel|gaza|ucrania|russia|onu/.test(t))return 'Mundo';
 if(/politica|lula|bolsonaro|eleic|deputad|senad|camara|congresso|projeto de lei|votac|presidente|stf/.test(t))return 'Política';
 return 'Brasil';
}
type XmlValue = string | number | Record<string,unknown> | XmlValue[] | undefined;
const txt=(v:XmlValue):string=> typeof v==='string'?v: typeof v==='number'?String(v):v&& !Array.isArray(v)?txt(v['#text'] as XmlValue):'';
const arr=(v:unknown):unknown[]=>v===undefined?[]:Array.isArray(v)?v:[v];
/** Some Portuguese feeds emit localized RFC month names (e.g. Out). */
export function parseFeedDate(value:string):number {
 const months:Record<string,string>={jan:'Jan',fev:'Feb',mar:'Mar',abr:'Apr',mai:'May',jun:'Jun',jul:'Jul',ago:'Aug',set:'Sep',out:'Oct',nov:'Nov',dez:'Dec'};
 return Date.parse(value.replace(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/gi,m=>months[m.toLowerCase()]));
}
export function parseFeed(xml:string,source:Source,now=new Date().toISOString()):Article[] {
 if(xml.length>3_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Feed inválido ou acima do limite');
 if(XMLValidator.validate(xml)!==true)throw new Error('XML inválido');
 const p=new XMLParser({ignoreAttributes:false,processEntities:true,htmlEntities:true,trimValues:true}).parse(xml);
 const raw=arr(p.rss?.channel?.item||p.feed?.entry);if(!raw.length)throw new Error('Feed sem itens');
 const out:Article[]=[];
 for(const record of raw.slice(0,60)){
  const item=record as Record<string,XmlValue>;
  const title=plainText(txt(item.title));const link=txt(item.link)||txt((item.link as Record<string,XmlValue>)?.['@_href']);
  const url=canonicalUrl(link,source.url);if(!url||!title||title.length<10||!(source.articleHosts||[new URL(source.url).hostname]).includes(new URL(url).hostname))continue;
  const date=txt(item.pubDate||item.published||item.updated||item['dc:date']);const ms=parseFeedDate(date);
  if(!Number.isFinite(ms)||ms>Date.parse(now)+300000)continue;
  const publishedAt=new Date(ms).toISOString();
  const content=txt(item['content:encoded']||item.description||item.summary);
  const description=txt(item.description||item.summary);
  const categories=arr(item.category).map(x=>plainText(txt(x as XmlValue))).filter(Boolean);
  // Keep only a short source-attributed excerpt; never persist the RSS article body.
  let excerpt=source.summaryAllowed?plainText(description).replace(/^Logo Agência Brasil\s*/i,'').split('Notícias relacionadas:')[0].trim():'';
  if(excerpt.length>330)excerpt=excerpt.slice(0,327).replace(/\s+\S*$/,'')+'…';
  let image:Article['image']=null;
  if(source.imagesAllowed){
   const src=txt(item['imagem-destaque'])||content.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1]||'';
   let credit=plainText(content.match(/class=["'][^"']*midia-creditos[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1]||'');
   if(!credit)credit=plainText(content.match(/(?:Foto|Fotografia|Crédito)s?:\s*([^<\n"'>]{4,100})/i)?.[1]||'');
   const imageUrl=canonicalUrl(src,source.url);
   const allowedCredit= source.id==='camara'? /c[aâ]mara dos deputados/i.test(credit):source.id==='senado'?/ag[eê]ncia senado/i.test(credit):/ag[eê]ncia brasil|\bebc\b/i.test(credit);
   if(imageUrl&&credit&&allowedCredit&&new URL(imageUrl).protocol==='https:'&&/^(www\.)?camara\.leg\.br$|^(imagens\.ebc\.com\.br|agenciabrasil\.ebc\.com\.br|www12\.senado\.leg\.br)$/.test(new URL(imageUrl).hostname))image={url:imageUrl,credit,licenseUrl:source.licenseUrl,sourceUrl:url};
  }
  out.push({id:hash(url),sourceId:source.id,title,url,publishedAt,fetchedAt:now,excerpt,author:plainText(txt(item['dc:creator']||item.author)),category:categorize(title,categories,url),image,tags:categories.slice(0,8)});
 }
 return out;
}
// Small, explicit Portuguese equivalences; no model or paid inference service.
const EQUIVALENTS:Record<string,string>={
 aprova:'aprovar',aprovou:'aprovar',aprovado:'aprovar',aprovada:'aprovar',aprovacao:'aprovar',
 rejeita:'rejeitar',rejeitou:'rejeitar',rejeitado:'rejeitar',rejeitada:'rejeitar',rejeicao:'rejeitar',
 sanciona:'sancionar',sancionou:'sancionar',sancionado:'sancionar',sancionada:'sancionar',sancao:'sancionar',
 veta:'vetar',vetou:'vetar',vetado:'vetar',vetada:'vetar',veto:'vetar',
 indicia:'indiciar',indiciou:'indiciar',indiciado:'indiciar',indiciada:'indiciar',indiciamento:'indiciar',
 prende:'prender',prendeu:'prender',preso:'prender',presa:'prender',prisao:'prender',
 anuncia:'anunciar',anunciou:'anunciar',anunciado:'anunciar',anunciada:'anunciar',anuncio:'anunciar',
 eleicoes:'eleicao',reeleito:'reeleger',reeleita:'reeleger',reeleicao:'reeleger',
 americanos:'americano',americanas:'americano',norteamericanos:'americano',estadunidenses:'americano',
};
const ACTIONS=new Set(['aprovar','rejeitar','sancionar','vetar','indiciar','prender']);
function eventTokens(title:string):string[]{
 const text=normalize(title).replace(/policia federal/g,'pf').replace(/banco central/g,'bc').replace(/supremo tribunal federal/g,'stf').replace(/estados unidos/g,'eua');
 return [...new Set([...tokens(text),...(text.match(/\b(?:pf|bc|pl|mp|sp|rj|mg|rs|es)\b/g)||[])].map(t=>EQUIVALENTS[t]||t))];
}
function eventFeatures(a:Article){
 const title=normalize(a.title),ts=eventTokens(a.title);
 return {ts,set:new Set(ts),published:Date.parse(a.publishedAt),
  ids:[...title.matchAll(/\b(?:pl|pec|mp|concurso)\s*(?:n[ºo.]?\s*)?(\d{2,}(?:[/.]\d{2,4})?)/g)].map(m=>m[1]),
  actions:ts.filter(t=>ACTIONS.has(t)),
  outcomes:['derrota','vitoria','prisao','morte'].map(word=>title.match(new RegExp(`\\b${word}\\s+(?:de|do|da)\\s+([a-z]+)`))?.[1]),
 };
}
export function createSimilarity(articles:Article[]) {
 const features=new Map(articles.map(a=>[a,eventFeatures(a)]));
 const df=new Map<string,number>();for(const f of features.values())for(const t of f.ts)df.set(t,(df.get(t)||0)+1);
 const weights=new Map([...df].map(([t,n])=>[t,(1+Math.log(1+articles.length/(1+n)))**2]));
 const sum=(ts:string[])=>ts.reduce((n,t)=>n+(weights.get(t)||1),0);
 const norms=new Map([...features].map(([a,f])=>[a,sum(f.ts)]));
 return (a:Article,b:Article):number=>{
  const x=features.get(a)||eventFeatures(a),y=features.get(b)||eventFeatures(b);
  if(Math.abs(x.published-y.published)>72*3600000)return 0;
  // Reject distinct bill/draw identifiers, incompatible actions, and outcome subjects.
  if(x.ids.length&&y.ids.length&&!x.ids.some(id=>y.ids.includes(id)))return 0;
  if(x.actions.length&&y.actions.length&&!x.actions.some(t=>y.actions.includes(t)))return 0;
  if(x.outcomes.some((t,i)=>t&&y.outcomes[i]&&t!==y.outcomes[i]))return 0;
  // Approval by two separate chambers is a different legislative step.
  if(x.actions.includes('aprovar')&&y.actions.includes('aprovar')&&((x.set.has('camara')&&y.set.has('senado'))||(x.set.has('senado')&&y.set.has('camara')))&&!(x.set.has('camara')&&x.set.has('senado'))&&!(y.set.has('camara')&&y.set.has('senado')))return 0;
  let common=0,shared=0;for(const t of x.ts)if(y.set.has(t)){common++;shared+=weights.get(t)||1;}
  if(common<3)return 0;
  const av=norms.get(a)||sum(x.ts),bv=norms.get(b)||sum(y.ts);
  return .7*shared/Math.sqrt(av*bv)+.3*shared/Math.min(av,bv);
 };
}
export function similarity(a:Article,b:Article):number {return createSimilarity([a,b])(a,b);}
export function coverageOf(sourceIds:string[],sources:Source[]=SOURCES){
 const counts:Record<Leaning,number>={left:0,center:0,right:0,unrated:0};
 for(const id of new Set(sourceIds)) {const s=sources.find(x=>x.id===id);const valid=s?.ratingEvidence.length&&s.ratingDate;counts[valid?s!.leaning:'unrated']++;}return counts;
}
export function blindspot(coverage:Record<Leaning,number>){
 const {left,center,right,unrated}=coverage,n=left+center+right,total=n+unrated;
 if(n<5)return {eligible:false,score:null,reason:'Mínimo de 5 fontes com avaliação política documentada.'};
 if(n/total<.8)return {eligible:false,score:null,reason:'Pelo menos 80% das fontes precisam ter avaliação documentada.'};
 const score=Math.round(100*Math.abs(left-right)/n);
 if(Math.max(left,right)/n<.8||Math.min(left,right)/n>.1)return {eligible:false,score,reason:'A cobertura não atinge o limiar de assimetria.'};
 return {eligible:true,score,reason:'Ao menos 80% de um lado e no máximo 10% do outro, na amostra monitorada.'};
}
export function clusterArticles(input:Article[],prior:Story[]=[]):Story[]{
 const dedup=new Map<string,Article>();for(const a of input)dedup.set(a.url,a);
 const articles=[...dedup.values()].sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt)||a.id.localeCompare(b.id));
 const groups:Article[][]=[];const compare=createSimilarity(articles);
 for(const a of articles){
  let best:Article[]|null=null,score=.54;
  for(const g of groups){
   if(Date.parse(a.publishedAt)-Date.parse(g[0].publishedAt)>72*3600000)continue;
   const scores=g.map(b=>compare(a,b));
   // Require support from the first report and the majority, preventing topic chains.
   if(scores[0]<.42||scores.some(s=>s===0)||scores.filter(s=>s>=.42).length<Math.ceil(g.length*.6))continue;
   const s=Math.max(...scores);if(s>score){score=s;best=g;}
  }
  if(best)best.push(a);else groups.push([a]);
 }
 const priorMap=new Map<string,string>();for(const s of prior)for(const a of s.articles)priorMap.set(a.id,s.id);
 const usedIds=new Set<string>();
 // This reviewed merge references exact URLs, never a political-name keyword.
 const reviewedArticles:Article[]=[];
 for(let i=groups.length-1;i>=0;i--){
  const matched=groups[i].filter(a=>ELECTION_REVIEW.urls.includes(a.url));
  if(matched.length){reviewedArticles.push(...matched);groups[i]=groups[i].filter(a=>!ELECTION_REVIEW.urls.includes(a.url));if(!groups[i].length)groups.splice(i,1);}
 }
 if(reviewedArticles.length)groups.push(reviewedArticles.sort((a,b)=>a.publishedAt.localeCompare(b.publishedAt)));
 return groups.map(g=>{
  const firstPublished=g[0].publishedAt;const ids=[...new Set(g.map(a=>a.sourceId))];const lead=g.find(a=>a.excerpt)||g[0];
  let id=g.map(a=>priorMap.get(a.id)).find(x=>x&&!usedIds.has(x))||'n-'+g[0].id;if(usedIds.has(id))id='n-'+g[0].id;usedIds.add(id);
  const reviewed=g.length>=2&&g.every(a=>ELECTION_REVIEW.urls.includes(a.url));
  if(reviewed)id=ELECTION_REVIEW.id;
  const counts=coverageOf(ids);const termCounts=new Map<string,Set<string>>();
  for(const a of g)for(const t of tokens(a.title)){if(!termCounts.has(t))termCounts.set(t,new Set());termCounts.get(t)!.add(a.sourceId);}
  return {id,title:reviewed?ELECTION_REVIEW.title:lead.title,summary:reviewed?ELECTION_REVIEW.summary:lead.excerpt,summarySourceId:reviewed?null:lead.excerpt?lead.sourceId:null,category:lead.category,articles:g.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)),sourceIds:ids,publishedAt:firstPublished,updatedAt:g.reduce((max,a)=>a.publishedAt>max?a.publishedAt:max,g[0].publishedAt),image:g.find(a=>a.image)?.image||null,grouping:reviewed?'reviewed' as const:'automatic' as const,commonTerms:[...termCounts].filter(([,v])=>v.size>=2).sort((a,b)=>b[1].size-a[1].size).slice(0,6).map(([k])=>k),coverage:counts,blindspot:blindspot(counts)};
 }).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
export function makeEdition(articles:Article[],feeds:FeedStatus[],now=new Date().toISOString(),prior:Story[]=[]):Edition {
 const cutoff=Date.parse(now)-14*86400000;
 const m=new Map<string,Article>();for(const a of articles)if(Date.parse(a.publishedAt)>=cutoff&&Date.parse(a.publishedAt)<=Date.parse(now)+300000)m.set(a.url,a);
 // Per-publisher quotas prevent a high-volume feed from evicting other voices.
 const perSource=new Map<string,number>();
 const retained=[...m.values()].filter(a=>SOURCES.some(s=>s.id===a.sourceId)).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).filter(a=>{const n=perSource.get(a.sourceId)||0;if(n>=80)return false;perSource.set(a.sourceId,n+1);return true;}).slice(0,800);
 return {version:1,generatedAt:now,articles:retained,stories:clusterArticles(retained,prior),feeds};
}
