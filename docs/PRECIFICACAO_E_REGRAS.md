# Precificação e regras comerciais — proposta de 15/10/2026

Este documento separa a proposta comercial das regras já implementadas. Os preços abaixo ainda precisam ser definidos pelo proprietário antes de serem anunciados no produto. Nenhuma mensalidade ou franquia foi habilitada por esta alteração.

## Referências públicas

Consulta em 15/10/2026, aos sites dos próprios fornecedores. São ofertas anunciadas, sem validação independente da qualidade ou de suas promessas.

| Produto e fonte | Preços anunciados | Diferença relevante |
| --- | --- | --- |
| [ZapTurbo](https://zapturbo.com.br/) | Standard R$ 29,90 / 1.500 disparos; Pro R$ 49,90 / 5.000; Premium R$ 69,90 / 10.000 por mês | Um número; posicionamento amplo para vendas e marketing. |
| [Sistema Zap Plus](https://sistemazapplus.com.br/) | Mensal R$ 39 à vista; anual R$ 197 à vista | O site traz valores promocionais/parcelados inconsistentes; comparar o total contratado, não misturar prestação com mensalidade. |
| [Zaplus](https://zaplus.chat/) | Pro R$ 297/mês e Premium R$ 497/mês | Outro produto de nome semelhante, voltado também a automação e atendimento. Não tratar como o mesmo Zap Plus. |

Existem outras marcas chamadas ZapTurbo/ZapPlus. Samuel deve confirmar os endereços dos concorrentes que acompanha para refinarmos a comparação.

## Oferta recomendada para validar o mercado

Começar com um único plano piloto: **R$ 49,90 por mês de calendário, por conta, com um WhatsApp conectado**, até dez clientes convidados. Proposta comercial, não preço já publicado. Manter acesso web, APK e PWA na mesma licença; não cobrar novamente por dispositivo. O produto ainda não tem equipe multiusuário.

O motivo para pagar é a rotina de distribuição editorial em servidor: preparar a matéria, selecionar grupos, agendar e acompanhar resultados pelo celular. Não vender como mensagens ilimitadas, entrega instantânea, garantia de tráfego no portal ou proteção contra banimento.

Após medir custos e conversão do piloto, testar **R$ 79,90/mês** para novas contas, condicionado à qualidade e aos diferenciais entregues. Não prometer agora manutenção vitalícia de preço, plano anual ou suporte 24 horas.

Antes da venda aberta, definir e implementar uma franquia. Uma hipótese para pesquisa é 15.000 entregas por ciclo (500 grupos × 1 matéria por dia × 30 dias), mas isso NÃO é um limite existente nem uma capacidade já garantida. Uma matéria para 500 grupos corresponde a 500 entregas, e não a uma entrega. Cancelados antes da transmissão não deveriam consumir franquia; falhas e entregas incertas exigem uma política explícita para evitar cobranças duplicadas. Reservar capacidade para campanhas agendadas e tratar renovação/concor­rência no servidor.

Não anunciar franquias até haver contador persistente, reserva atômica, aviso de consumo, bloqueio no limite e tratamento de renovação. O código atual limita campanhas simultâneas, não o consumo mensal.

## Custos e capacidade

Receita bruta hipotética a R$ 49,90: dez clientes = R$ 499/mês; trinta = R$ 1.497/mês. Isso não representa lucro. Levantar mensalmente: VPS incremental ou dedicada, armazenamento e backups, domínio, tributos/taxas aplicáveis, horas de suporte e margem para incidentes. Não usar o valor inteiro da VPS compartilhada como custo zero.

Fórmula de referência: margem de contribuição por cliente = preço recebido − custos variáveis por cliente. Ponto de equilíbrio = custos fixos mensais / margem de contribuição. Se a margem não for positiva, não há ponto de equilíbrio nesse modelo. Samuel deve informar o custo real da VPS e o esforço de suporte para calcular valores concretos.

Com uma única fila global, espera de 10 s e pausa adicional de 60 s a cada 30 grupos, o teto matemático é aproximadamente 7.200 entregas/dia em carga contínua, ANTES de rede, falhas, reconexões e manutenção. Isso não é benchmark nem meta operacional. Trinta clientes com 15.000 entregas/mês somariam 450.000; excederiam os cerca de 216.000 de um mês de 30 dias nesse teto ideal. Não vender essa capacidade na arquitetura atual. Medir fila, latência até início/conclusão, RSS, CPU, disponibilidade e suporte; evoluir divisão de filas/sessões antes de prometer escala. As aplicações UNASP ficam fora das mudanças.

## Regras já existentes

- Cadastro não inicia automaticamente o teste. A ativação explícita libera sete dias corridos (168 h), uma vez por conta. Não exige cartão nem gera cobrança automática.
- A restrição é por conta; não há verificação de identidade que garanta uma única experiência por pessoa. Tratar abuso de cadastros antes da aquisição aberta, sem alegar proteção já implementada.
- O Pix é manual. O proprietário confere o crédito recebido, registra uma referência única do pagamento e emite uma chave exclusiva vinculada à conta. Comprovante sozinho não ativa licença.
- O mês é de calendário, não um pacote fixo de 30 dias. A validade mensal é calculada na emissão da chave; a ativação posterior não reinicia a validade. O painel informa o vencimento.
- Renovação mensal antecipada preserva o prazo mensal ainda pago; licença vencida começa no momento da nova emissão. Ao trocar chave, a antiga é revogada. Reemissão de chave perdida preserva a validade.
- No vencimento, novos envios e conexão exigem licença vigente; pendentes bloqueados por licença não retomam automaticamente. O cliente deve revisar os resultados antes de preparar nova divulgação.
- Cada cliente opera seus próprios grupos/sessão. Máximo atual de duas campanhas ativas por conta e uma transmissão global em processamento. Não representa dois envios simultâneos por cliente.
- O canal atual é texto/link para grupos; contatos individuais, anexos e recorrência não fazem parte da oferta entregue.

## Diferenciais: entregue versus próximos passos

Entregue: agendamento pontual em horário de Brasília, conexão por código no mesmo celular, resultados por grupo, cancelamento de pendentes, prevenção de campanha duplicada e pausa para revisão de entrega incerta, acesso móvel e processamento na VPS.

Prioridade de diferenciação editorial: listas salvas de grupos por editoria/região; modelos de chamada com título e link; reutilização de seleções; busca e filtros de destinos; calendário editorial. Depois: importação assistida de RSS com revisão humana antes de publicar e métricas de cliques com coleta mínima de dados. São itens de roadmap, sem promessa na tela como disponíveis. Nenhum ganho de audiência está demonstrado ainda.

Antes da venda aberta: decidir preço/franquia; instrumentar capacidade e custos; configurar chave Pix e WhatsApp do responsável; implementar franquias; verificação de e-mail e recuperação de senha; política de suporte e cancelamento; revisão dos termos e da privacidade; backups com teste de restauração; validar expiração/renovação sob carga e isolamento por conta; concluir teste real no iPhone. As telas não substituem essas entregas.

## Mudança de comunicação nesta etapa

Cadastro/login passam a destacar sete dias grátis, sem cartão e sem cobrança automática. Explicam o momento de ativação, os recursos atuais, a renovação por Pix e as dependências dos envios. Contas sem teste/licença veem um primeiro passo para abrir Licença e Pix. Preços e franquias propostos permanecem neste documento até decisão comercial e suporte técnico aos limites.
