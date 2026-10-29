import { readEdition } from '@/lib/news/repository';
import { BlindspotsPage } from '@/components/news-ui';
export const dynamic='force-dynamic';
export const metadata={title:'Pontos cegos'};
export default async function Page(){return <BlindspotsPage edition={await readEdition()}/>;}
