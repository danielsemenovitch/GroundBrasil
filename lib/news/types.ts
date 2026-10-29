export type Category = 'Política' | 'Economia' | 'Brasil' | 'Mundo' | 'Educação' | 'Ciência' | 'Tecnologia' | 'Saúde' | 'Meio ambiente' | 'Cultura' | 'Esportes';
export interface SourceFeed { url: string; category?: Category }
export type Leaning = 'left' | 'center' | 'right' | 'unrated';
export interface Source {
  id: string; name: string; short: string; url: string; feedUrl: string;
  kind: 'Jornalismo público' | 'Legislativo' | 'Independente' | 'Privado';
  owner: string; ownerEvidence: string; license: string; licenseUrl: string;
  color: string; summaryAllowed: boolean; imagesAllowed: boolean;
  leaning: Leaning; ratingEvidence: string[]; ratingDate: string | null;
  articleHosts?: string[];
  checkedAt?: string;
  additionalFeeds?: SourceFeed[];
}
export interface NewsImage { url: string; credit: string; licenseUrl: string; sourceUrl: string }
export interface Article {
  id: string; sourceId: string; title: string; url: string; publishedAt: string;
  fetchedAt: string; excerpt: string; author: string; category: Category;
  image: NewsImage | null; tags: string[]; imageCheckedAt?: string; categoryHint?: Category;
}
export interface Story {
  id: string; title: string; summary: string; summarySourceId: string | null;
  category: Category; articles: Article[]; sourceIds: string[];
  publishedAt: string; updatedAt: string; image: NewsImage | null;
  grouping: 'automatic' | 'reviewed'; commonTerms: string[];
  coverage: Record<Leaning,number>; blindspot: { eligible: boolean; score: number | null; reason: string };
}
export interface FeedEndpointStatus { url: string; category?: Category; ok: boolean; count: number; fetchedAt: string; error: string | null; etag?: string; lastModified?: string }
export interface FeedStatus { sourceId: string; ok: boolean; count: number; fetchedAt: string; error: string | null; etag?: string; lastModified?: string; partial?: boolean; endpoints?: FeedEndpointStatus[] }
export interface Edition { version: 1; generatedAt: string; articles: Article[]; stories: Story[]; feeds: FeedStatus[] }
export interface EditionResponse extends Edition { storage: 'database' | 'snapshot'; stale: boolean }
