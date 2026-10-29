import { authorizedUpdater, refreshNews } from '@/lib/news/repository';
export async function POST(request:Request){
 if(!await authorizedUpdater(request))return Response.json({error:'Não autorizado.'},{status:401});
 try{const r=await refreshNews();return Response.json({updated:r.updated,message:r.message,generatedAt:r.edition.generatedAt,articles:r.edition.articles.length,stories:r.edition.stories.length,feeds:r.edition.feeds},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'A coleta falhou. A edição anterior foi preservada.'},{status:503});}
}
