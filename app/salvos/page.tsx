import { readEdition } from '@/lib/news/repository';
import { NewsFeed } from '@/components/news-ui';
export const dynamic='force-dynamic';
export const metadata={title:'Sua lista de leitura'};
export default async function Page(){return <NewsFeed initial={await readEdition()} onlySaved/>;}
