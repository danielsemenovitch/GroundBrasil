import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalUrl, parseFeed, clusterArticles, similarity, blindspot, coverageOf, makeEdition, plainText } from '../lib/news/core.ts';
import { SOURCES } from '../lib/news/sources.ts';
import type { Article, Source } from '../lib/news/types.ts';
const now='2026-10-28T12:00:00Z';
const article=(title:string,id='a',sourceId='camara',publishedAt='2026-10-27T12:00:00Z'):Article=>({id,sourceId,title,url:`https://www.camara.leg.br/noticias/${id}`,publishedAt,fetchedAt:now,excerpt:'',author:'',category:'Política',image:null,tags:[]});
test('canonical URLs strip only trackers and reject executable URLs',()=>{assert.equal(canonicalUrl('https://a.test/report?utm_source=x&id=3#top'),'https://a.test/report?id=3');assert.equal(canonicalUrl('javascript:alert(1)'),null);});
test('RSS parses real XML entities and never persists a full article',()=>{const xml='<rss><channel><item><title>Uma notícia &amp; outra notícia</title><link>https://www.camara.leg.br/noticias/abc</link><pubDate>Tue, 27 Oct 2026 12:00:00 GMT</pubDate><description><![CDATA[<p>'+('Palavra '.repeat(300))+'</p>]]></description></item></channel></rss>';const a=parseFeed(xml,SOURCES[1],now);assert.equal(a.length,1);assert.match(a[0].title,/&/);assert.ok(a[0].excerpt.length<=330);assert.ok(!a[0].excerpt.includes('<p>'));});
test('reject XML entities, invalid timestamps, offsite article links and future news',()=>{assert.throws(()=>parseFeed('<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>',SOURCES[1],now));const xml='<rss><channel><item><title>Uma notícia que não deve passar</title><link>https://evil.test/abc</link><pubDate>Tue, 27 Oct 2026 12:00:00 GMT</pubDate></item><item><title>Outra notícia sem data válida</title><link>https://www.camara.leg.br/noticias/a</link><pubDate>invalid</pubDate></item><item><title>Outra notícia datada no futuro</title><link>https://www.camara.leg.br/noticias/b</link><pubDate>2028-01-01</pubDate></item></channel></rss>';assert.equal(parseFeed(xml,SOURCES[1],now).length,0);});
test('Pública metadata never includes excerpts or imagery',()=>{const xml='<rss><channel><item><title>Investigação sobre assunto relevante no Brasil</title><link>https://apublica.org/report</link><pubDate>2026-10-27</pubDate><description>Conteúdo protegido</description></item></channel></rss>';const a=parseFeed(xml,SOURCES[3],now)[0];assert.equal(a.excerpt,'');assert.equal(a.image,null);});
test('same event clusters, repeated articles do not inflate source count',()=>{const a=article('Câmara aprova projeto que amplia atendimento para crianças no SUS');const b=article('Projeto amplia atendimento para crianças no SUS e é aprovado na Câmara','b','agencia-brasil');const c=article(a.title,'c','camara');const stories=clusterArticles([a,b,c,a]);assert.equal(stories.length,1);assert.equal(stories[0].sourceIds.length,2);assert.equal(stories[0].articles.length,3);assert.equal(stories[0].coverage.unrated,2);});
test('shared politician alone is not evidence of same event',()=>{const a=article('Lula recebe delegação para discutir acordo comercial');const b=article('Lula visita hospital para inaugurar unidade de saúde','b');assert.equal(similarity(a,b),0);assert.equal(clusterArticles([a,b]).length,2);});
test('same headline outside 72 hours is not merged',()=>{const a=article('Câmara aprova projeto de ampliação de benefício social');const b=article(a.title,'b','senado','2026-10-20T12:00:00Z');assert.equal(clusterArticles([a,b]).length,2);});
test('unknown ratings never silently become center',()=>{const fake={...SOURCES[0],leaning:'center',ratingEvidence:[],ratingDate:null} as Source;assert.deepEqual(coverageOf([fake.id,fake.id],[fake]),{left:0,center:0,right:0,unrated:1});});
test('blindspot minimum count, rated share and exact boundary',()=>{assert.equal(blindspot({left:4,center:0,right:0,unrated:0}).eligible,false);assert.equal(blindspot({left:8,center:1,right:1,unrated:4}).eligible,false);const yes=blindspot({left:8,center:1,right:1,unrated:2});assert.equal(yes.eligible,true);assert.equal(yes.score,70);assert.equal(blindspot({left:3,center:4,right:3,unrated:0}).eligible,false);assert.equal(blindspot({left:0,center:0,right:0,unrated:9}).score,null);});
test('edition retains current article dates, expires old records and keeps stable IDs',()=>{const a=article('Câmara aprova projeto de educação e tecnologia');const old=article('Antiga notícia fora da janela de retenção','old','senado','2026-09-01T12:00:00Z');const first=makeEdition([a,old],[],now);const second=makeEdition([a],[],now,first.stories);assert.equal(first.articles.length,1);assert.equal(second.stories[0].id,first.stories[0].id);assert.equal(first.articles[0].publishedAt,a.publishedAt);});
test('plain text strips scripts',()=>{assert.equal(plainText('<script>alert(1)</script><p>Texto seguro</p>'),'Texto seguro');});

test('localized Portuguese feed dates and explicit BBC hosts parse without admitting offsite links',async()=>{
 const source=SOURCES.find(s=>s.id==='bbc')!;
 const xml='<rss><channel><item><title>Reportagem da BBC sobre uma notícia</title><link>https://www.bbc.co.uk/portuguese/articles/test</link><pubDate>27 Out 2026 12:00:00 +0000</pubDate><description>Texto protegido</description></item><item><title>Outro domínio que não pode entrar</title><link>https://bbc.co.uk.evil.test/abc</link><pubDate>27 Out 2026 12:00:00 +0000</pubDate></item></channel></rss>';
 const a=parseFeed(xml,source,now);assert.equal(a.length,1);assert.equal(a[0].publishedAt,'2026-10-27T12:00:00.000Z');assert.equal(a[0].excerpt,'');assert.equal(a[0].image,null);
});
test('different bill identifiers and legislative decisions remain separate',()=>{
 for(const [a,b] of [
  ['Câmara aprova PL 1234 sobre benefício para servidores federais','Câmara aprova PL 5678 sobre benefício para servidores federais'],
  ['Câmara aprova projeto de benefício para servidores federais','Senado aprova projeto de benefício para servidores federais'],
  ['Lula sanciona projeto de benefício para servidores federais','Lula veta projeto de benefício para servidores federais'],
 ])assert.equal(clusterArticles([article(a),article(b,'b','senado')]).length,2);
});
test('equivalent acronyms and verb forms join the same event',()=>{
 const a=article('Polícia Federal indicia empresários por fraude no Banco Master');
 const b=article('Empresários são indiciados pela PF por fraude no Banco Master','b','g1');
 assert.equal(clusterArticles([a,b]).length,1);
});
test('one high-volume publisher cannot evict smaller publishers',()=>{
 const many=Array.from({length:110},(_,i)=>article(`Notícia ${i} com um assunto específico`,String(i),'g1'));
 const small=article('Uma investigação de outro veículo com cobertura própria','small','publica','2026-10-26T12:00:00Z');
 const e=makeEdition([...many,small],[],now);
 assert.equal(e.articles.filter(a=>a.sourceId==='g1').length,80);assert.ok(e.articles.some(a=>a.id==='small'));
});
test('reviewed real RSS headline pairs: same events merge; shared topics stay separate',async()=>{
 const {readFile}=await import('node:fs/promises');
 const fixture=JSON.parse(await readFile(new URL('./fixtures/grouping-headlines.json',import.meta.url),'utf8'));
 for(const p of fixture.pairs){const stories=clusterArticles(p.articles);assert.equal(stories.length,p.sameEvent?1:2,p.articles.map((a:Article)=>a.title).join(' / '));}
});

test('publisher sections and feed topics take precedence over incidental headline words',async()=>{
 const {categorize}=await import('../lib/news/core.ts');
 assert.equal(categorize('Pesquisa restaura fotografias das famílias',[],'https://example.test/brasil/noticia'),'Brasil');
 assert.equal(categorize('Inteligência artificial chega à sala de aula',[],'https://g1.globo.com/educacao/noticia/test'),'Educação');
 assert.equal(categorize('Presidente anuncia investimento',[],'https://g1.globo.com/tecnologia/noticia/test'),'Tecnologia');
 assert.equal(categorize('Uma reportagem sobre o clima',[],'https://g1.globo.com/meio-ambiente/noticia/test'),'Meio ambiente');
 assert.equal(categorize('A histórica virada de Lula',['Universidade','Educação'],'https://www.brasildefato.com.br/report'),'Política');
 assert.equal(categorize('Uma nova descoberta',[],'https://g1.globo.com/servico/test','Ciência'),'Ciência');
});
test('topic quotas retain smaller sections without increasing a publisher source count',()=>{
 const politics=Array.from({length:100},(_,i)=>({...article(`Debate no parlamento sobre tema ${i}`,`p${i}`,'g1'),url:`https://g1.globo.com/politica/${i}`}));
 const education={...article('Estudantes conhecem as datas do Enem','edu','g1'),url:'https://g1.globo.com/educacao/enem'};
 const health={...article('Campanha de vacinação alcança novos municípios','health','g1'),url:'https://g1.globo.com/saude/vacina'};
 const e=makeEdition([...politics,education,health],[],now);
 assert.equal(e.articles.length,80);assert.ok(e.articles.some(a=>a.id==='edu'));assert.ok(e.articles.some(a=>a.id==='health'));
 assert.equal(e.articles.find(a=>a.id==='edu')?.category,'Educação');
 assert.ok(e.stories.every(s=>s.sourceIds.length===1));
});
test('multiple feeds deduplicate articles, isolate conditional caching and report partial failures',async()=>{
 const {collectSourceFeeds}=await import('../lib/news/ingestion.ts');
 const source={...SOURCES.find(s=>s.id==='g1')!,additionalFeeds:[{url:'https://g1.globo.com/rss/g1/economia/',category:'Economia' as const},{url:'https://g1.globo.com/rss/g1/saude/',category:'Saúde' as const}]};
 const last={sourceId:'g1',ok:true,count:1,fetchedAt:now,error:null,endpoints:[{url:source.feedUrl,ok:true,count:1,fetchedAt:now,error:null,etag:'politics-etag'}]};
 const xml='<rss><channel><item><title>Manchete de economia para testar os feeds</title><link>https://g1.globo.com/economia/noticia/test</link><pubDate>2026-10-27</pubDate></item><item><title>Manchete de economia para testar os feeds</title><link>https://g1.globo.com/economia/noticia/test</link><pubDate>2026-10-27</pubDate></item></channel></rss>';
 const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(input),headers=new Headers(init?.headers);
  if(url===source.feedUrl){assert.equal(headers.get('If-None-Match'),'politics-etag');return new Response(null,{status:304});}
  assert.equal(headers.get('If-None-Match'),null);
  return url.includes('economia')?new Response(xml,{headers:{etag:'economy-etag'}}):new Response(null,{status:503});
 }) as typeof fetch;
 const r=await collectSourceFeeds(source,last,now,fetcher);
 assert.equal(r.articles.length,1);assert.equal(r.articles[0].category,'Economia');
 assert.equal(r.status.sourceId,'g1');assert.equal(r.status.ok,true);assert.equal(r.status.partial,true);
 assert.equal(r.status.endpoints?.length,3);assert.match(r.status.error!,/Saúde: HTTP 503/);
 assert.equal(r.status.endpoints?.[1].etag,'economy-etag');
});
test('photo extraction pairs the real figure with its own author and rejects missing or third-party credits',async()=>{
 const {extractArticlePhoto}=await import('../lib/news/photos.ts');
 const {creditedImage}=await import('../lib/news/core.ts');
 const {readFile}=await import('node:fs/promises');
 const fixture=JSON.parse(await readFile(new URL('./fixtures/photo-markup.json',import.meta.url),'utf8'));
 for(const p of fixture){const s=SOURCES.find(s=>s.id===p.sourceId)!;const photo=extractArticlePhoto(p.html,s,p.url);assert.ok(photo);assert.equal(photo.credit,p.credit);assert.equal(photo.sourceUrl,p.url);}
 const ab=SOURCES[0],url='https://agenciabrasil.ebc.com.br/economia/noticia/test',src='https://imagens.ebc.com.br/photo.jpg';
 assert.equal(creditedImage(ab,url,src,'Agência Brasil'),null);
 assert.equal(creditedImage(ab,url,src,'Reuters/Agência Brasil/Proibida reprodução'),null);
 assert.equal(creditedImage(ab,url,'https://unverified.test/photo.jpg','Antônio Cruz/Agência Brasil'),null);
 assert.equal(extractArticlePhoto('<meta property="og:image" content="'+src+'"><p>Antônio Cruz/Agência Brasil</p>',ab,url),null);
 assert.equal(creditedImage(SOURCES.find(s=>s.id==='g1')!,url,src,'Antônio Cruz/Agência Brasil'),null);
});
test('a verified photo survives RSS updates and illustrates its event with original provenance',()=>{
 const image={url:'https://imagens.ebc.com.br/photo.jpg',credit:'Antônio Cruz/Agência Brasil',licenseUrl:SOURCES[0].licenseUrl,sourceUrl:'https://agenciabrasil.ebc.com.br/economia/noticia/test'};
 const old={...article('Banco Central anuncia redução da taxa de juros','ab','agencia-brasil'),url:image.sourceUrl,image,imageCheckedAt:now};
 const fresh={...old,image:null,imageCheckedAt:undefined};
 const g1={...article('Banco Central anuncia redução da taxa de juros','g1','g1'),url:'https://g1.globo.com/economia/noticia/test'};
 const e=makeEdition([old,fresh,g1],[],now);
 assert.equal(e.articles.length,2);assert.deepEqual(e.articles.find(a=>a.id==='ab')?.image,image);
 assert.equal(e.articles.find(a=>a.id==='ab')?.imageCheckedAt,now);
 assert.equal(e.stories.length,1);assert.equal(e.stories[0].sourceIds.length,2);assert.deepEqual(e.stories[0].image,image);
});
