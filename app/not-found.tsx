import Link from 'next/link';
import { Search } from 'lucide-react';
export default function NotFound(){return <main id="conteudo" className="shell empty-state"><Search size={35}/><span className="eyebrow">PÁGINA NÃO ENCONTRADA</span><h1>Essa história não está nesta edição.</h1><p>O endereço pode estar incorreto ou a notícia pode ter saído da janela de atualização.</p><Link href="/" className="button primary">Voltar às notícias</Link></main>;}
