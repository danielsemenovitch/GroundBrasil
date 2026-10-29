/** Directed real-headline audit; not a random-sample accuracy estimate.
 * node --experimental-strip-types scripts/evaluate-grouping.mjs [baseline-commit-sha]
 */
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as current from '../lib/news/core.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=JSON.parse(await readFile(new URL('../tests/fixtures/comparison-audit-2026-10-29.json',import.meta.url),'utf8'));
function evaluate(engine){
 const result={truePositive:0,trueNegative:0,falsePositive:0,falseNegative:0};
 for(const pair of fixture.pairs){const joined=engine.clusterArticles(pair.articles).length===1;result[joined?(pair.sameEvent?'truePositive':'falsePositive'):(pair.sameEvent?'falseNegative':'trueNegative')]++;}
 const edition=engine.makeEdition(fixture.corpus,[],fixture.evaluatedAt);
 return {pairs:result,retainedArticles:edition.articles.length,multiPublisherStories:edition.stories.filter(s=>s.sourceIds.length>1).length};
}
const report={reviewedPairs:fixture.pairs.length,corpusArticles:fixture.corpus.length,evaluatedAt:fixture.evaluatedAt,current:evaluate(current)};
if(process.argv[2]){
 const ref=process.argv[2];if(!/^[a-f0-9]{40}$/.test(ref))throw new Error('Supply a full baseline commit SHA');
 const source=stripTypeScriptTypes(execFileSync('git',['show',`${ref}:lib/news/core.ts`],{cwd:root,encoding:'utf8'}))
  .replaceAll("'../../data/editorial.ts'",JSON.stringify(new URL('../data/editorial.ts',import.meta.url).href))
  .replaceAll("'./sources.ts'",JSON.stringify(new URL('../lib/news/sources.ts',import.meta.url).href))
  .replaceAll("'fast-xml-parser'",JSON.stringify(import.meta.resolve('fast-xml-parser')));
 const before=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 report.baseline={commit:ref,...evaluate(before)};
}
console.log(JSON.stringify(report,null,2));
