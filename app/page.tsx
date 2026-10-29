import { readEdition } from '@/lib/news/repository';
import { NewsFeed } from '@/components/news-ui';
export const dynamic='force-dynamic';
export default async function Home(){return <NewsFeed initial={await readEdition()}/>;}
