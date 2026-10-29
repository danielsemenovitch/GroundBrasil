import { z } from 'zod';
import { readEdition } from '@/lib/news/repository';
export async function POST(request:Request){
 try{
 if(Number(request.headers.get('content-length'))>10000)return new Response(null,{status:413});
 const body=z.object({id:z.union([z.string(),z.number()]).optional(),method:z.string(),params:z.object({name:z.string().optional()}).passthrough().optional()}).parse(await request.json());const {id,method}=body;
 if(method==='notifications/initialized')return new Response(null,{status:202});
 let result:unknown;
 if(method==='server/discover')result={supportedVersions:['2026-07-28'],capabilities:{tools:{}}};
 else if(method==='initialize')result={protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'ground-news-brasil',version:'1.0.0'}};
 else if(method==='tools/list')result={tools:[{name:'news_status',description:'Lê o estado da última coleta de notícias do Ground News Brasil.',inputSchema:{type:'object',properties:{},additionalProperties:false}}]};
 else if(method==='tools/call'&&body.params?.name==='news_status'){const e=await readEdition();result={content:[{type:'text',text:JSON.stringify({generatedAt:e.generatedAt,stories:e.stories.length,articles:e.articles.length,feeds:e.feeds,stale:e.stale})}]};}
 else return Response.json({jsonrpc:'2.0',id,error:{code:-32601,message:'Método não encontrado'}});
 return Response.json({jsonrpc:'2.0',id,result});
 }catch{return Response.json({jsonrpc:'2.0',id:null,error:{code:-32603,message:'Falha temporária'}});}
}
