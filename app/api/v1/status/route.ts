import { readEdition } from '@/lib/news/repository';
export async function GET(){try{const e=await readEdition();return Response.json({version:1,generatedAt:e.generatedAt,storage:e.storage,stale:e.stale,articles:e.articles.length,stories:e.stories.length,feeds:e.feeds},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Banco indisponível'},{status:503});}}
