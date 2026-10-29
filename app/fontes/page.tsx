import { readEdition } from '@/lib/news/repository';
import { SourceDirectory } from '@/components/news-ui';
export const dynamic='force-dynamic';
export const metadata={title:'Fontes e transparência'};
export default async function SourcesPage(){return <SourceDirectory edition={await readEdition()}/>;}
