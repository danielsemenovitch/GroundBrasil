'use client';
import { RefreshCw } from 'lucide-react';
export default function ErrorPage({reset}:{reset:()=>void}){return <main id="conteudo" className="shell empty-state"><RefreshCw size={32}/><h1>Uma pausa na atualização.</h1><p>Não conseguimos acessar a edição agora. Tente novamente em alguns instantes.</p><button className="button primary" onClick={reset}>Tentar novamente</button></main>;}
