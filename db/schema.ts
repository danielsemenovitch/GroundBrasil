import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const articles = sqliteTable('articles', {
 id:text('id').primaryKey(),sourceId:text('source_id').notNull(),url:text('url').notNull().unique(),
 publishedAt:text('published_at').notNull(),data:text('data').notNull(),
}, t => [index('articles_published_idx').on(t.publishedAt)]);
export const editions = sqliteTable('editions', {
 id:text('id').primaryKey(),generatedAt:text('generated_at').notNull(),data:text('data').notNull(),
});
export const ingestionRuns = sqliteTable('ingestion_runs', {
 id:text('id').primaryKey(),startedAt:text('started_at').notNull(),finishedAt:text('finished_at'),
 status:text('status').notNull(),articleCount:integer('article_count').notNull().default(0),detail:text('detail'),
});
export const pipelineState = sqliteTable('pipeline_state', {
 id:text('id').primaryKey(),value:text('value').notNull(),
});
