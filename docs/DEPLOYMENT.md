# Publicação e orçamento

A implementação usa o runtime Cloudflare fornecido pelo Sites. A primeira publicação é privada. Nenhuma cobrança adicional ou assinatura foi iniciada.

A hospedagem independente em Cloudflare deve permanecer no plano Free e impedir upgrade automático para respeitar o orçamento. O código usa APIs compatíveis com Workers/D1, mas o starter inclui integração específica de Sites: a migração exige preparar um manifesto Wrangler independente e validar o comportamento fora da plataforma. Não alegamos que essa segunda hospedagem já foi implantada.

Limites oficiais verificados em 28/10/2026:

- Workers Free: 100.000 requisições por dia, 10 ms de CPU por invocação; até 50 subrequests. https://developers.cloudflare.com/workers/platform/pricing/ e https://developers.cloudflare.com/workers/platform/limits/
- D1 Free: 500 MB por banco e 5 GB por conta; limites de consultas e uso também se aplicam. https://developers.cloudflare.com/d1/platform/limits/

A ingestão agrupa inserts para manter menos de 100 parâmetros SQL por statement e limita a edição a 240 artigos. Ainda assim, parsing e agrupamento de feeds devem ser medidos contra o limite de CPU do Free em um ensaio real na conta de destino. Se necessário, o agrupamento pode ser movido para GitHub Actions sem IA paga, mantendo a API de leitura e D1.

Acesso público, domínio próprio e configuração de uma conta Cloudflare/GitHub para este projeto dependem de decisão do proprietário. O MVP atual não faz promessas de escala ou disponibilidade ilimitadas.
