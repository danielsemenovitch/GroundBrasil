import { SOURCES } from '@/lib/news/sources';
export function GET(){return Response.json({sources:SOURCES},{headers:{'Cache-Control':'public, max-age=3600'}});}
