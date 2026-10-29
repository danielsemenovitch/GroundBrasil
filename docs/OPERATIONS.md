# Operação de atualizações — Ground News Brasil

Site: `appgprj_6ae19102270481919434626bddb4bf5c`.

1. Consulte `get_site` para esse ID. Reutilize a publicação existente e sua agenda; não crie outro Site. A publicação inicial é privada, restrita ao proprietário.
2. Obtenha o `siwc_bypass_bearer_token` retornado por `get_site` apenas em memória. Ele já existe; não use a ferramenta de geração/rotação de token. A mesma credencial foi configurada como segredo de runtime `INGEST_TOKEN` para a versão privada inicial.
3. Faça `POST` em `/api/internal/refresh` no `current_live_url` exato retornado, com `OAI-Sites-Authorization: Bearer <token>` (entrada do Site privado) e `Authorization: Bearer <token>` (autorização do atualizador). Sem corpo. Passe segredos por stdin oculto, nunca em argumentos de shell, arquivos, prompts ou logs.
4. Leia a resposta JSON e depois `GET /api/v1/status` com o mesmo acesso. Verifique `storage=database`, data igual à resposta e ao menos uma fonte disponível. Conteúdo parcial é permitido, mas deve ser registrado como parcial. Uma execução normal não modifica nem republica código.
5. Cooldown de 15 minutos ou execução concorrente retorna `updated=false` e preserva a edição. Não force outra coleta. Em falha de fontes ou infraestrutura, mantenha a última edição e relate o erro. Não contorne 403, robots, paywalls ou CAPTCHA.
6. Nunca invente artigos, avaliações políticas, links ou checagens. Somente as fontes aprovadas no cadastro versionado (dez veículos em 29/10/2026). Não expanda o escopo em uma execução agendada.

Se a credencial de serviço for rotacionada fora desta rotina, o administrador deverá atualizar `INGEST_TOKEN` por variável secreta e republicar a versão correspondente. Não rotacione para tentar resolver erro de autorização. Para exposição pública, use um segredo de ingestão dedicado e preserve a autenticação do endpoint. Não compartilhe o token do Site com visitantes.

Agendamento confirmado ativo em 28/10/2026: a cada duas horas, no fuso `America/New_York`, pela automação vinculada `Atualizar notícias do Ground News Brasil`. Verifique o estado atual com Sites ao retomar a operação; esta anotação não substitui a consulta. O workflow do GitHub é apenas uma alternativa: não configure `SITE_ORIGIN` enquanto a agenda do Site estiver ativa. A mera presença de um workflow no Git não comprova execução automática.
