import type { Metadata } from 'next';
import { Header, Footer } from '@/components/news-ui';
import './globals.css';
export const metadata:Metadata={metadataBase:new URL('https://ground-news-brasil.classyglade18.chatgpt.site'),title:{default:'Ground News Brasil — Um fato. Mais perspectivas.',template:'%s | Ground News Brasil'},description:'Compare notícias brasileiras, conheça as fontes e entenda diferentes perspectivas. Jornalismo com origem à vista e metodologia transparente.',icons:{icon:'/favicon.svg'},openGraph:{locale:'pt_BR',type:'website',siteName:'Ground News Brasil',title:'Ground News Brasil — Um fato. Mais perspectivas.'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body><Header/>{children}<Footer/></body></html>;}
