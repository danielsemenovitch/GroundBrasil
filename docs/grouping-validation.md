# Validação do agrupamento — 29/10/2026

A edição de avaliação combina a edição persistida e os RSS baixados diretamente dos dez veículos em 29/10/2026. Contém 343 artigos após deduplicação, retenção e limite por fonte. Não há matérias inventadas nem rótulos políticos inferidos.

Sobre os mesmos 343 artigos, o agrupador anterior produziu cinco grupos com duas ou mais fontes; o novo produziu sete. O agrupamento editorial com URLs explícitas foi preservado. Essa contagem não é uma medida de precisão e não comprova que todos os eventos foram encontrados.

Foram inspecionados os sete grupos produzidos. Exemplos: investigação de impeachment de Ricardo Nunes (Agência Brasil/Brasil de Fato); arquivamentos de Fachin (Agência Brasil/g1); contas do governo em setembro (Agência Brasil/g1); indiciamentos no caso Master (Agência Brasil/g1/Brasil de Fato); declarações do TSE sobre normalidade da eleição (Agência Brasil/g1); eleição em Israel (BBC/Brasil de Fato).

A fixture versionada inclui seis pares positivos e três negativos reais. Não foi usada para alegar desempenho em notícias inéditas. As regressões sintéticas verificam números distintos de projetos, etapas legislativas, siglas, flexões verbais, validade dos links e datas, limite temporal, cotas e ausência de classificações políticas sem evidência. Os 16 testes passaram.

Limitações: títulos com nomes/verbos muito diferentes ainda podem ficar separados. A frequência dos termos muda por edição e pode mudar grupos. Não fazemos embeddings, análise do corpo das reportagens ou síntese automática neutra. A janela dos RSS e o limite de 60 itens por coleta reduzem a cobertura retrospectiva. A entrada do g1 é pelo feed de política; não equivale a acompanhar todo o portal. Não se deve interpretar a quantidade de fontes como representatividade política.
