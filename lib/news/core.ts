import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { ELECTION_REVIEW } from '../../data/editorial.ts';
import { SOURCES } from './sources.ts';
import type { Article, Category, Edition, FeedStatus, Source, Story, Leaning, NewsImage } from './types.ts';
const STOP = new Set('a o as os um uma uns umas de da do das dos em no na nos nas por para com e ou que se ao aos à às é são foi ser mais após sobre nesta neste entre como pelo pela pelos pelas seu sua seus suas diz afirma noticia noticias brasil brasileiro brasileira governo presidente feira terça quarta quinta sexta segunda sabado domingo'.split(' '));
export const normalize = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function plainText(s:string):string {
 return s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(Number(n),0x10ffff))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(Math.min(parseInt(n,16),0x10ffff))).replace(/&(?:nbsp|amp|quot|apos|lt|gt);/g,x=>({'&nbsp;':' ','&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'}[x]!)).replace(/\s+/g,' ').trim();
}
export function canonicalUrl(raw:string,base?:string):string|null {
 try {const u=new URL(raw,base);if(u.protocol!=='https:'&&u.protocol!=='http:')return null;u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid|ref$)/i.test(k))u.searchParams.delete(k);return u.href.replace(/\/$/,'');}catch{return null;}
}
export function creditedImage(source:Source,articleUrl:string,src:string,rawCredit:string):NewsImage|null{
 if(!source.imagesAllowed)return null;
 const credit=plainText(rawCredit).replace(/^[©\s]+|^Foto:\s*/gi,'').trim();
 const owner=source.id==='agencia-brasil'?/ag[eê]ncia brasil|\bebc\b/ig:source.id==='senado'?/ag[eê]ncia senado/ig:source.id==='camara'?/c[aâ]mara dos deputados/ig:null;
 if(!owner||!owner.test(credit))return null;owner.lastIndex=0;
 if(/proibida|reuters|getty|associated press|\bafp\b|\bap photo\b/i.test(credit)||!/[a-z]{3}/i.test(normalize(credit.replace(owner,''))))return null;
 const url=canonicalUrl(src,articleUrl);if(!url)return null;
 const parsed=new URL(url);
 const hosts=source.id==='agencia-brasil'?['imagens.ebc.com.br','agenciabrasil.ebc.com.br']:source.id==='senado'?['www12.senado.leg.br']:['www.camara.leg.br','camara.leg.br'];
 if(parsed.protocol!=='https:'||!hosts.includes(parsed.hostname)||/logo|imagem-padrao|loading/i.test(parsed.pathname)||!/\.(?:jpe?g|png|webp)(?:\/|$)/i.test(parsed.pathname))return null;
 return {url,credit,licenseUrl:source.licenseUrl,sourceUrl:articleUrl};
}


export function hash(s:string):string {let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
export function tokens(s:string):string[] {return [...new Set(normalize(s).match(/[a-z0-9]+/g)?.filter(t=>t.length>2&&!STOP.has(t))||[])];}
export function categorize(title:string,tags:string[],url:string,hint?:Category):Category {
 // Publisher section paths are stronger evidence than a passing word in a headline.
 const path=normalize(new URL(url).pathname);
 const sections:Record<string,Category>={politica:'Política',economia:'Economia',mundo:'Mundo',internacional:'Mundo',educacao:'Educação',ciencia:'Ciência','ciencia-e-tecnologia':'Ciência',tecnologia:'Tecnologia',saude:'Saúde','meio-ambiente':'Meio ambiente',natureza:'Meio ambiente',cultura:'Cultura','pop-arte':'Cultura',esportes:'Esportes'};
 const section=path.split('/').find(p=>sections[p]);
 if(section)return sections[section];
 if(hint)return hint;
 const infer=(t:string):Category|null=>{
 if(/saude|vacina|dengue|cancer|hospital|medicin/.test(t))return 'Saúde';
 if(/educacao|escola|ensino|estudant|professor|enem|vestibular|alfabetiza|universidade/.test(t))return 'Educação';
 if(/meio.ambiente|climat|desmat|biodivers|conservacao|amazonia|floresta|especies|fauna|bioma|manguez|carbono/.test(t))return 'Meio ambiente';
 if(/tecnologia|inteligencia artificial|ciberseguranca|software|aplicativo|internet|\b(?:google|apple|microsoft|openai|nvidia)\b/.test(t))return 'Tecnologia';
 if(/ciencia|cientific|astronom|espacial|astronaut|\bnasa\b|\bplaneta\b/.test(t))return 'Ciência';
 if(/esporte|futebol|copa|flamengo|palmeiras|olimpic/.test(t))return 'Esportes';
 if(/cultura|cinema|musica|festival|livro|literatura/.test(t))return 'Cultura';
 if(/economia|juros|inflacao|banco central|pib|dolar|imposto|emprego|fiscal|renda|orcament|gasto publico|financeir|indeniz|tributari|aliquota|cana-de-acucar/.test(t))return 'Economia';
 if(/internacional|mundo|eua|trump|israel|gaza|ucrania|russia|onu/.test(t))return 'Mundo';
 if(/politica|lula|bolsonaro|eleic|deputad|senad|camara|congresso|projeto de lei|votac|presidente|stf/.test(t))return 'Política';
 return null;
 };
 const headline=infer(normalize(title));if(headline)return headline;
 for(const tag of tags){const direct=sections[normalize(tag).replace(/ /g,'-')];if(direct)return direct;}
 return 'Brasil';
}
type XmlValue = string | number | Record<string,unknown> | XmlValue[] | undefined;
const txt=(v:XmlValue):string=> typeof v==='string'?v: typeof v==='number'?String(v):v&& !Array.isArray(v)?txt(v['#text'] as XmlValue):'';
const arr=(v:unknown):unknown[]=>v===undefined?[]:Array.isArray(v)?v:[v];
/** Some Portuguese feeds emit localized RFC month names (e.g. Out). */
export function parseFeedDate(value:string):number {
 const months:Record<string,string>={jan:'Jan',fev:'Feb',mar:'Mar',abr:'Apr',mai:'May',jun:'Jun',jul:'Jul',ago:'Aug',set:'Sep',out:'Oct',nov:'Nov',dez:'Dec'};
 return Date.parse(value.replace(/^(seg|ter|qua|qui|sex|s[aá]b|dom),?\s*/i,'').replace(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/gi,m=>months[m.toLowerCase()]));
}
export function publisherArticleUrl(raw:string,source:Source):string|null{
 let url=canonicalUrl(raw,source.url);if(!url)return null;
 // Folha explicitly supplies tracking wrappers in its RSS. Unwrap without a request.
 if(source.id==='folha'&&new URL(url).hostname==='redir.folha.com.br'){
  if(!/^\/redir\/online\/[\w/-]+\/\*https?:\/\//.test(new URL(url).pathname))return null;
  url=canonicalUrl(url.slice(url.indexOf('*')+1));if(!url)return null;
 }
 const parsed=new URL(url);
 if(parsed.username||parsed.password||!(source.articleHosts||[new URL(source.url).hostname]).includes(parsed.hostname))return null;
 if(source.id==='folha'&&parsed.protocol==='http:')parsed.protocol='https:';
 return parsed.href;
}
export function parseFeed(xml:string,source:Source,now=new Date().toISOString(),categoryHint?:Category):Article[] {
 if(xml.length>3_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Feed inválido ou acima do limite');
 if(XMLValidator.validate(xml)!==true)throw new Error('XML inválido');
 const p=new XMLParser({ignoreAttributes:false,processEntities:true,htmlEntities:true,trimValues:true}).parse(xml);
 const raw=arr(p.rss?.channel?.item||p.feed?.entry);if(!raw.length)throw new Error('Feed sem itens');
 const out:Article[]=[];
 for(const record of raw.slice(0,60)){
  const item=record as Record<string,XmlValue>;
  const title=plainText(txt(item.title));const link=txt(item.link)||txt((item.link as Record<string,XmlValue>)?.['@_href']);
  const url=publisherArticleUrl(link,source);if(!url||!title||title.length<10)continue;
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
   image=creditedImage(source,url,src,credit);
  }
  out.push({id:hash(url),sourceId:source.id,title,url,publishedAt,fetchedAt:now,excerpt,author:plainText(txt(item['dc:creator']||item.author)),category:categorize(title,categories,url,categoryHint),categoryHint,image,tags:categories.slice(0,8)});
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
 arquiva:'arquivar',arquivou:'arquivar',arquivamento:'arquivar',arquivadas:'arquivar',arquivados:'arquivar',
 processa:'processar',processou:'processar',processado:'processar',processada:'processar',
 convoca:'convocar',convocou:'convocar',convocacao:'convocar',amistosos:'amistoso',
 calculo:'calcular',calcula:'calcular',calculou:'calcular',calculada:'calcular',
 investigacoes:'investigacao',investigados:'investigado',condenados:'condenado',mulheres:'mulher',
 familias:'familia',
 repercute:'repercutir',repercutem:'repercutir',repercussao:'repercutir',
 discute:'discutir',discutem:'discutir',discussao:'discutir',debate:'debater',debatem:'debater',
};
const ACTIONS=new Set(['aprovar','rejeitar','sancionar','vetar','indiciar','prender']);
function eventTokens(title:string):string[]{
 let text=normalize(title).replace(/^(audio|video|ao vivo):?\s*/,'').replace(/policia federal/g,'pf').replace(/banco central europeu/g,'bce').replace(/banco central/g,'bc').replace(/uniao europeia/g,'ue').replace(/supremo tribunal federal/g,'stf').replace(/estados unidos/g,'eua').replace(/dividas\s+(?:de|das)\s+familias\s+em\s+atraso/g,'inadimplencia familias');
 if(/\bcuba\b/.test(text))text=text.replace(/\bembargo\b/g,'bloqueio');
 return [...new Set([...tokens(text),...(text.match(/\b(?:pf|bc|ue|pl|mp|sp|rj|mg|rs|es)\b/g)||[])].map(t=>EQUIVALENTS[t]||t))];
}
function eventFeatures(a:Article){
 const title=normalize(a.title),ts=eventTokens(a.title);
 return {ts,set:new Set(ts),published:Date.parse(a.publishedAt),
  chamber:/\bcamara\b/.test(title)?'camara':/\bsenado\b/.test(title)?'senado':['camara','senado'].includes(a.sourceId)?a.sourceId:null,
  percentages:[...title.matchAll(/\b(\d+(?:[.,]\d+)?)\s*%/g)].map(m=>m[1].replace(',','.')),
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
  // Different fiscal aggregates and daily market closings can share many title words.
  if((x.set.has('superavit')&&y.set.has('deficit'))||(x.set.has('deficit')&&y.set.has('superavit')))return 0;
  if(x.set.has('ibovespa')&&y.set.has('ibovespa')&&new Date(x.published-3*3600000).toISOString().slice(0,10)!==new Date(y.published-3*3600000).toISOString().slice(0,10))return 0;
  // Approval by two separate chambers is a different legislative step.
  if(['aprovar','repercutir','discutir','debater'].some(t=>x.set.has(t)&&y.set.has(t))&&x.chamber&&y.chamber&&x.chamber!==y.chamber&&!(x.set.has('camara')&&x.set.has('senado'))&&!(y.set.has('camara')&&y.set.has('senado')))return 0;
  let common=0,shared=0;for(const t of x.ts)if(y.set.has(t)){common++;shared+=weights.get(t)||1;}
  if(common<3)return 0;
  const av=norms.get(a)||sum(x.ts),bv=norms.get(b)||sum(y.ts);
  const lexical=.7*shared/Math.sqrt(av*bv)+.3*shared/Math.min(av,bv);
  // An exact percentage plus two named institutions supports a specific fiscal event.
  const institutions=['tcu','cbs','bc','ibge','copom','stf','tse','mpt','mpf'];
  const precise=x.percentages.some(p=>y.percentages.includes(p))&&institutions.filter(t=>x.set.has(t)&&y.set.has(t)).length>=2;
  return Math.min(1,lexical+(precise&&lexical>=.38?.12:0));
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
 const m=new Map<string,Article>();for(const a of articles)if(Date.parse(a.publishedAt)>=cutoff&&Date.parse(a.publishedAt)<=Date.parse(now)+300000){
  const old=m.get(a.url);
  m.set(a.url,{...a,image:a.image||old?.image||null,imageCheckedAt:a.imageCheckedAt||old?.imageCheckedAt,category:categorize(a.title,a.tags,a.url,a.categoryHint)});
 }
 const candidates=[...m.values()].filter(a=>SOURCES.some(s=>s.id===a.sourceId));
 // Protect candidate comparisons before per-publisher quotas discard their counterparts.
 const compare=createSimilarity(candidates),index=new Map<string,Article[]>(),overlap=new Set<Article>();
 for(const a of candidates){
  const terms=eventTokens(a.title),shared=new Map<Article,number>();
  for(const term of terms)for(const b of index.get(term)||[])if(a.sourceId!==b.sourceId&&Math.abs(Date.parse(a.publishedAt)-Date.parse(b.publishedAt))<=72*3600000)shared.set(b,(shared.get(b)||0)+1);
  for(const [b,n] of shared)if(n>=3&&compare(a,b)>.54){overlap.add(a);overlap.add(b);}
  for(const term of terms){if(!index.has(term))index.set(term,[]);index.get(term)!.push(a);}
 }
 // Reserve at most half of each quota for matches, then alternate topic buckets.
 const publisherSelections:Article[][]=[];
 for(const source of SOURCES){
  const sorted=candidates.filter(a=>a.sourceId===source.id).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
  const selected=sorted.filter(a=>overlap.has(a)).slice(0,40),reserved=new Set(selected);
  const buckets=new Map<Category,Article[]>();
  for(const a of sorted.filter(a=>!reserved.has(a))){
   if(!buckets.has(a.category))buckets.set(a.category,[]);buckets.get(a.category)!.push(a);
  }
  while(selected.length<80){let added=false;for(const bucket of buckets.values()){if(selected.length>=80)break;const a=bucket.shift();if(a){selected.push(a);added=true;}}if(!added)break;}
  publisherSelections.push(selected);
 }
 // Share the global cap across publishers, including quieter sources.
 const retained:Article[]=[];
 for(let i=0;i<80&&retained.length<800;i++)for(const selected of publisherSelections){if(retained.length>=800)break;if(selected[i])retained.push(selected[i]);}
 retained.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
 return {version:1,generatedAt:now,articles:retained,stories:clusterArticles(retained,prior),feeds};
}
