import type { Story } from './types.ts';

export type NewsOrder = 'relevance' | 'coverage' | 'recent';
const HOUR=3600000;
function freshness(story:Story,now:number){
 const age=Math.max(0,now-Date.parse(story.updatedAt));
 return age<=24*HOUR?0:age<=48*HOUR?1:age<=72*HOUR?2:3;
}
/** Freshness windows come first; coverage breaks ties within the same window. */
export function rankStories(stories:Story[],order:NewsOrder='relevance',now=Date.now()):Story[]{
 return [...stories].sort((a,b)=>{
  const recent=b.updatedAt.localeCompare(a.updatedAt);
  if(order==='recent')return recent||a.id.localeCompare(b.id);
  const coverage=b.sourceIds.length-a.sourceIds.length;
  if(order==='coverage')return coverage||recent||a.id.localeCompare(b.id);
  return freshness(a,now)-freshness(b,now)||coverage||recent||a.id.localeCompare(b.id);
 });
}
export function homepageStories(stories:Story[],order:NewsOrder='relevance',now=Date.now()){
 const ordered=rankStories(stories,order,now),featured=ordered[0];
 if(!featured)return {featured:undefined,secondaries:[],rest:[],comparison:undefined};
 // The next two stories use the same ranking. A photograph does not override age.
 const secondaries=ordered.slice(1,3),ids=new Set([featured.id,...secondaries.map(s=>s.id)]);
 const comparison=ordered.find(s=>s.sourceIds.length>1&&freshness(s,now)<2);
 return {featured,secondaries,rest:ordered.filter(s=>!ids.has(s.id)),comparison};
}
