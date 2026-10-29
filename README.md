# Ground News Brasil

MVP editorial em português brasileiro: RSS real, comparação entre fontes, favoritos locais, busca, filtros, tema claro/escuro, diretório e metodologia explícita. Não usa APIs de IA nem notícias fictícias. O nome é provisório; o produto é independente de Ground News/Snapwise.

- Site: https://ground-news-brasil.classyglade18.chatgpt.site (acesso privado do proprietário).
- Código: https://github.com/danielsemenovitch/GroundBrasil.
- Atualização: automação do Site ativa a cada duas horas; o workflow do GitHub fica como alternativa, sem uma segunda coleta agendada em paralelo.

## Arquitetura

- React 19 + TypeScript, App Router compatível com Next.js via Vinext, Cloudflare Workers.
- CSS editorial próprio, Lucide; não depende de componentes visuais pagos.
- Cloudflare D1: artigos normalizados, edição publicada, histórico de ingestão e lease de concorrência.
- `lib/news/core.ts`: parser RSS/Atom, canonização, categorias, deduplicação, agrupamento, cobertura e critérios de pontos cegos. Funções puras e testadas.
- `lib/news/repository.ts`: coleta e persistência. Dez veículos e 17 feeds fixos, timeout, limite de XML, sem entidades externas, ETag/Last-Modified, retenção e publicação transacional.
- `data/bootstrap.json`: edição real de fontes verificadas, atualizada em 29/10/2026, usada e identificada como snapshot apenas enquanto o banco está vazio. Não é uma fixture fictícia.
- `data/editorial.ts`: agrupamento revisado com URLs explícitas, síntese e observações sustentadas por três reportagens. Não infere opinião política.
- APIs versionadas reutilizáveis para um aplicativo Android futuro. Não há aplicativo Android neste repositório.

## Desenvolvimento

Requer Node 24 e pnpm 11.25.0 (versão fixada em `package.json`). Em um checkout próprio:

```sh
git clone https://github.com/danielsemenovitch/GroundBrasil.git
cd GroundBrasil
pnpm install --frozen-lockfile
pnpm dev
```

Na hospedagem Sites, use os helpers oficiais do plugin e preserve `sites()` em `vite.config.ts`.

```sh
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

Após gerar o build, aplique uma vez cada migration pendente à instância local:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_smart_blackheart.sql
```

Nunca aplique novamente uma migration já executada. A publicação Sites aplica as migrations de produção. Não crie tabelas durante requisições.

## API v1

| Endpoint | Contrato |
|---|---|
| `GET /api/v1/stories` | `q`, `category`, `multiple=1`, `sort=coverage`, `offset`, `limit` (máx. 240); edição, total, frescor e disponibilidade das fontes |
| `GET /api/v1/stories/:id` | História com artigos e proveniência; 404 se fora da edição |
| `GET /api/v1/sources` | Metadados, propriedade e evidências, permissões e avaliação política |
| `GET /api/v1/status` | Estado persistido, data de coleta e falhas por fonte |
| `POST /api/internal/refresh` | Coleta protegida por `Authorization: Bearer INGEST_TOKEN`; bloqueio de concorrência e 15 minutos de cooldown |
| `POST /mcp` | MCP somente leitura: `news_status` |

As respostas não contêm segredos. Links são validados e títulos/trechos renderizados como texto. A ingestão nunca recebe URLs arbitrárias do cliente. Sem eval ou HTML de publicações na interface.

## Atualização agendada

O caminho principal na publicação privada é uma automação vinculada ao Site; veja `docs/OPERATIONS.md`. O processo realiza POST no endpoint protegido e verifica a leitura de `/api/v1/status`, sem republicar o site.

O workflow `.github/workflows/news-refresh.yml` é uma alternativa preparada para GitHub (a cada 2 horas). Ele exige `SITE_ORIGIN` em repository variables e `INGEST_TOKEN` em repository secrets; Sites privado exige também `SITES_ACCESS_TOKEN`. Não é ativado sem esses valores. Não mantenha duas agendas para o mesmo site.

`node scripts/refresh-hosted.mjs` usa somente APIs padrão do Node, sem instalar dependências no agendador. Falhas preservam os dados anteriores. Não há tentativa de contornar bloqueios dos veículos.

## Dados, licenças e limites editoriais

`docs/source-evidence.json` registra fontes, evidências de propriedade, termos e imagem de contexto. Conteúdo completo não é republicado. Agência Pública: somente título, URL, autoria e data. Fotos são admitidas apenas com crédito e origem compatíveis; a ausência de imagem tem tratamento editorial próprio.

Todas as fontes estão **não avaliadas** politicamente. Propriedade pública não significa centro/esquerda/direita. A versão limitada de pontos cegos mostra regras, mas não pontua histórias sem dados suficientes. Não há integração de fact-checking nem vereditos automatizados.

A lista reúne dez veículos: Agência Brasil, Câmara, Senado, Pública, g1 (oito editorias RSS), BBC News Brasil, Brasil de Fato, Repórter Brasil, Mongabay Brasil e ((o))eco. A expansão melhora a diversidade de tipos de publicação, mas não comprova equilíbrio político; avaliações continuam pendentes. Cada fonte mantém até 80 artigos, alternando editorias para preservar assuntos de menor volume, por até 14 dias, com teto de 800. As seis novas fontes usam apenas metadados, sem trechos ou fotografias. A classificação temática é heurística; os agrupamentos automáticos ainda precisam de monitoramento editorial. A síntese revisada e as observações têm caráter informativo, com links às reportagens.

## Editorias e imagens

O g1 mantém um único cadastro e participa com RSS de política, economia, mundo, educação, ciência, saúde, tecnologia e meio ambiente. ETag e Last-Modified são independentes por endpoint. Falhas parciais preservam a edição e ficam visíveis. Os oito feeds não aumentam sua contagem de fontes. O antigo endpoint `natureza` não é usado: retornava conteúdo de 2024 na validação de 29/10/2026. Os feeds especializados da EBC retornaram HTTP 500 nessa revisão e não foram ativados.

A classificação privilegia editoria do endereço, depois a editoria explícita do feed, e por fim termos do título/tags. Educação, tecnologia e meio ambiente têm filtros próprios. A classificação continua heurística e pode ser corrigida.

`lib/news/ingestion.ts` coleta os RSS com concorrência limitada e cache por endpoint. `lib/news/photos.ts` consulta somente matérias da Agência Brasil e Senado para verificar imagem e crédito juntos. Não usa apenas og:image nem persiste o texto da página. A EBC é consultada no máximo duas vezes por execução, separando inícios de requisições em pelo menos dez segundos (inclusive após o RSS); o Senado tem até três consultas de matérias, excluindo páginas de áudio. O enriquecimento tem orçamento de 32 segundos e é opcional para a coleta: falhas não bloqueiam a edição. Fotos sem autoria, de terceiros ou marcadas como reprodução proibida não são admitidas. Resultados sem foto são guardados por 48 horas. Imagens verificadas sobrevivem à próxima leitura do RSS e podem ilustrar o mesmo grupo com a atribuição original.

Cartões e páginas sem imagem usam composição tipográfica; falhas de carregamento também removem o espaço da imagem. Não usamos imagens genéricas para simular fotografias de um evento.

## Agrupamento e validação

O agrupador compara títulos em até 72 horas, com siglas/variações portuguesas explícitas e pesos por frequência dos termos na edição. Combina cosseno ponderado (70%) e contenção (30%), mínimo de três termos compartilhados e limiar de 0,54. Exige apoio da primeira reportagem e da maioria do grupo; veta certos conflitos de ações, números de projetos e etapas legislativas. Continua sendo um método lexical conservador: pode perder paráfrases e não comprova concordância factual.

`tests/fixtures/grouping-headlines.json` contém nove pares reais revisados (seis positivos e três negativos), com origem e data, complementados por regressões sintéticas identificadas nos testes. Em uma edição validada com 343 artigos, a nova versão encontrou sete grupos com múltiplas fontes, contra cinco usando o algoritmo anterior sobre os mesmos artigos. Essa comparação mede agrupamentos, não precisão geral ou garantia de cobertura. Veja `docs/grouping-validation.md`.

## Custos e publicação

Nenhuma chave de IA, API comercial, assinatura ou plano pago foi contratado. A versão Sites é privada e usa o ambiente já disponível. O código permite expansão para Cloudflare, mas migrar para uma conta própria exige configurar hospedagem, D1 e segredos. O plano Workers Free tem limites de CPU/requisições: o custo zero não garante escala ilimitada; benchmark de CPU é necessário antes de prometer operação pública no Free. Fontes oficiais consultadas em `docs/DEPLOYMENT.md`.

O repositório `danielsemenovitch/GroundBrasil` contém o código-fonte, o lockfile, as migrations, os testes e a documentação. A publicação em Sites usa seu próprio repositório de origem; um push ao GitHub, por si só, não altera o site publicado. Depois de editar, sincronize o código revisado com Sites e publique pelos helpers oficiais. Dados de produção, credenciais e artefatos de build não são versionados no GitHub.

## Antes de abrir ao público

Definir identidade/nome definitivo e canal de correções, ampliar a amostra, revisar permissões e agrupamentos, confirmar cotas/CPU na hospedagem de destino, verificar recuperação de dados e decidir acesso público explicitamente. Tokens do atualizador permanecem secretos; não retirar autenticação para facilitar agendamento.
