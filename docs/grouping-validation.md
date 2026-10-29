# Auditoria de comparações e recência — 29/10/2026

A revisão usa 591 registros reais de manchetes e metadados: os 380 artigos da edição persistida de 29/10 às 20h37 UTC, feeds públicos da Folha e UOL baixados nesta revisão e três registros da regressão anterior que completam os pares de referência. O corpus, os 30 pares e a data fixa de avaliação estão em `tests/fixtures/comparison-audit-2026-10-29.json`. Não há corpo de reportagem, fotos novas, notícias inventadas ou avaliações políticas.

## O que estava limitando as comparações

1. URLs da Folha vinham dentro de redirecionadores do próprio veículo. Os destinos agora são extraídos sem uma requisição adicional e só passam se o domínio final estiver explicitamente aprovado.
2. Folha usa XML ISO-8859-1; UOL fornece bytes Windows-1252 e dias/meses em português. Decodificação UTF-8 exclusiva corrompia palavras ou descartava datas. A declaração XML, a configuração do feed e o cabeçalho HTTP são tratados explicitamente.
3. A cota temática de 80 artigos podia descartar a contraparte de uma reportagem antes do agrupamento. Agora há um índice de termos no conjunto candidato: até 40 posições por veículo protegem possíveis comparações; as demais alternam editorias. O teto global continua 800 e também alterna veículos.
4. Siglas, flexões e expressões diferentes mantinham relatos específicos separados. Foram acrescentadas equivalências explícitas, como BCE/Banco Central Europeu, e um reforço limitado quando um percentual exato e duas instituições aparecem nos dois títulos.
5. Havia risco de aproximar etapas legislativas de casas diferentes quando a manchete omitisse o nome da casa. O cadastro legislativo pode completar essa informação. Também há guardas para agregados fiscais incompatíveis e fechamentos do Ibovespa em dias distintos.

## Comparação controlada

O corpus já contém os novos veículos em ambos os lados; a tabela separa o efeito das regras/cotas do efeito de simplesmente acrescentar fontes. A versão anterior em Sites é `da8241dd688480bf82053a8b5b12a9b545e184eb`; seu conteúdo corresponde ao commit GitHub `afa68896f843a2d6433c99a5bd703d434dff7eda`.

| Medida no mesmo corpus | Anterior | Atual |
| --- | ---: | ---: |
| Artigos candidatos | 591 | 591 |
| Artigos retidos | 465 | 465 |
| Histórias com pelo menos duas publicações | 14 | 27 |
| Pares positivos unidos, em testes isolados | 11/15 | 14/15 |
| Pares negativos separados, em testes isolados | 14/15 | 15/15 |

Contar grupos não mede precisão nem recall. Os 30 pares foram escolhidos para esta auditoria e orientaram correções: não são uma amostra aleatória nem um holdout. As frequências de termos dependem do conjunto: o par Anatel/Folha–g1 continua separado no teste isolado, mas se une na edição completa. Os testes verificam os positivos no corpus de publicação e as separações negativas também isoladamente. Isso documenta uma limitação em vez de afirmar acerto universal.

Os 27 grupos publicados na edição de avaliação foram inspecionados por manchete. Incluem o vazamento do DHS (UOL/g1), ação do MPT contra a Meta (Folha/g1), Anatel e linhas de celular (Folha/g1), arquivamentos de Fachin (Folha/Agência Brasil), contas do governo central (Folha/Agência Brasil), saída de Lagarde do BCE (Folha/Agência Brasil), cálculo da CBS (Senado/Agência Brasil) e inadimplência de famílias (Folha/g1). Alguns conteúdos são republicações: quantidade de publicações não é quantidade de apurações independentes.

Reprodução:

```sh
node --experimental-strip-types scripts/evaluate-grouping.mjs
# Comparação em um checkout que contenha o commit anterior:
node --experimental-strip-types scripts/evaluate-grouping.mjs <SHA-completo-do-commit-anterior>
```

## Novos veículos e limites

Folha entra com últimos acontecimentos, política, economia e mundo. UOL entra com notícias; endereços que apontam diretamente para veículos parceiros não são contados como UOL. Ambos exibem apenas manchete, data, autoria disponível e link. Nenhuma assinatura é contornada; nenhum texto ou foto é republicado. O diretório registra as evidências. A presença de um RSS não é licença geral de republicação.

Metrópoles não foi ativado porque seus termos exigem autorização prévia para automação. O endpoint avaliado da CNN redireciona ao host `admin`, cujo robots.txt bloqueia rastreamento. Poder360 e R7 não foram ativados nesta revisão porque a verificação das condições não foi concluída. Não houve tentativa de contornar bloqueios.

O agrupamento continua lexical e pode perder paráfrases ou aproximar eventos distintos. O grupo editorial da eleição continua restrito às URLs revisadas; isso pode separar outros relatos do mesmo evento. Feeds curtos, o limite de 60 itens por leitura, horários e retenção também limitam o que aparece.

## Homepage

A ordem padrão usa janelas de atualização de 24, 48 e 72 horas em relação à edição coletada; dentro delas, prioriza quantidade de publicações e depois recência. Notícias antigas continuam disponíveis na janela de retenção e na ordenação explícita “Mais fontes”. Fotos não alteram a escolha dos destaques. O convite “Explore uma comparação” só aparece se existe um grupo com várias publicações nas últimas 48 horas. Não há pontuação de popularidade, rótulo político ou métrica de audiência inventados.
