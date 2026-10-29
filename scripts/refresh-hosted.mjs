/** Run in GitHub Actions or another scheduler. No paid service required.
 * All credentials come from environment, never command arguments.
 */
const origin = process.env.SITE_ORIGIN;
const token = process.env.INGEST_TOKEN;
if (!origin || !token) throw new Error('SITE_ORIGIN and INGEST_TOKEN are required');
const url = new URL(origin);
if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/') throw new Error('Use the exact HTTPS Site origin');
const headers = { Authorization: `Bearer ${token}` };
if (process.env.SITES_ACCESS_TOKEN) headers['OAI-Sites-Authorization'] = `Bearer ${process.env.SITES_ACCESS_TOKEN}`;
const response = await fetch(new URL('/api/internal/refresh', url), { method:'POST', headers, redirect:'error', signal:AbortSignal.timeout(60000) });
if (!response.ok) throw new Error(`Refresh failed: HTTP ${response.status}`);
const result = await response.json();
console.log(JSON.stringify(result));
if (!result.feeds?.some(feed=>feed.ok)) throw new Error('No sources available; previous edition retained');
const readback = await fetch(new URL('/api/v1/status', url), { headers,redirect:'error',signal:AbortSignal.timeout(20000) });
if (!readback.ok) throw new Error(`Readback failed: HTTP ${readback.status}`);
const saved = await readback.json();
if(saved.storage!=='database'||saved.generatedAt!==result.generatedAt) throw new Error('Persisted edition verification failed');
console.log(JSON.stringify({verified:true,generatedAt:saved.generatedAt,articles:saved.articles,stories:saved.stories}));
