import { readEdition } from '@/lib/news/repository';
import { StoryView } from '@/components/news-ui';
import { notFound } from 'next/navigation';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const e=await readEdition();const s=e.stories.find(x=>x.id===id);return {title:s?.title||'Notícia não encontrada',description:s?.summary};}
export default async function StoryPage({params}:{params:Promise<{id:string}>}){const {id}=await params;const e=await readEdition();const s=e.stories.find(x=>x.id===id);if(!s)notFound();return <StoryView story={s}/>;}
