import { readEdition } from '@/lib/news/repository';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 try {const {id}=await params;const edition=await readEdition();const story=edition.stories.find(s=>s.id===id);return story?Response.json({story,generatedAt:edition.generatedAt},{headers:{'Cache-Control':'public, max-age=60'}}):Response.json({error:'Notícia não encontrada.'},{status:404});}catch{return Response.json({error:'Serviço temporariamente indisponível.'},{status:503});}
}
