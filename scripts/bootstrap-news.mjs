import { readFile, writeFile, stat } from 'node:fs/promises';
import { parseFeed, makeEdition, hash } from '../lib/news/core.ts';
import { SOURCES } from '../lib/news/sources.ts';
const dir=process.argv[2];if(!dir)throw new Error('Supply the path to verified downloaded RSS files');
const research=JSON.parse(await readFile(`${dir}/../source-research.json`,'utf8'));
const observed=await Promise.all(SOURCES.map(s=>stat(`${dir}/${s.id}.xml`)));
const now=new Date(Math.max(...observed.map(s=>s.mtimeMs))).toISOString();let articles=[];const feeds=[];
for(const source of SOURCES){
 const xml=await readFile(`${dir}/${source.id}.xml`,'utf8');const parsed=parseFeed(xml,source,now);
 articles.push(...parsed);feeds.push({sourceId:source.id,ok:true,count:parsed.length,fetchedAt:now,error:null});
}
for(const a of research.seedEvent.articles)articles.push({id:hash(a.url),sourceId:a.sourceId,title:a.title,url:a.url,publishedAt:a.publishedAt,fetchedAt:now,excerpt:'',author:a.author,category:'Política',tags:['Eleições 2026'],image:a.imageUrl?{url:'/images/eleicoes-2026.jpg',credit:a.photoCredit,sourceUrl:a.url,licenseUrl:'https://agenciabrasil.ebc.com.br/sobre'}:null});
const edition=makeEdition(articles,feeds,now);await writeFile('data/bootstrap.json',JSON.stringify(edition));
console.log(JSON.stringify({articles:edition.articles.length,stories:edition.stories.length,comparisons:edition.stories.filter(s=>s.sourceIds.length>1).map(s=>({id:s.id,title:s.title,sources:s.sourceIds})),images:edition.stories.filter(s=>s.image).length}));
