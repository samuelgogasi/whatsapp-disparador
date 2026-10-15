# Operação do piloto

Os envios permanecem na VPS. Fechar o APK ou o navegador não cancela a fila. Ainda existe um único envio em processamento no conjunto do sistema; esta entrega não implementa filas independentes por cliente nem comprova capacidade para dez sessões.

## Intervalos

- Espera de 10 segundos antes de cada envio, sem simulação adicional de digitação.
- Pausa adicional de um minuto antes do 31º grupo e a cada novo lote de 30 na mesma campanha.
- Comunicação com o WhatsApp e operações de banco acrescentam tempo.
- Uma campanha de 500 grupos soma 1h39min20s apenas de esperas, se a fila estiver livre.
- Limites mínimos do piloto: 10 segundos e um minuto. São escolhas operacionais do projeto, não limites oficiais do WhatsApp nem proteção garantida contra bloqueios.

`MIN_MESSAGE_DELAY_MS` e `MAX_MESSAGE_DELAY_MS` são 10000; `MIN_BATCH_PAUSE_MS` e `MAX_BATCH_PAUSE_MS`, 60000. O lote permanece em 30 grupos. O administrador pode conferir os valores efetivos em `GET /api/admin/dispatch-status`, usando sua credencial administrativa.

## Controles de envio

- A declaração de revisão da mensagem e autorização dos grupos agora é obrigatória também na API (`confirmed: true`), com data registrada na campanha. Isso registra uma declaração do cliente; não comprova o consentimento de todos os participantes.
- O servidor bloqueia por dez minutos a mesma mensagem para o mesmo conjunto de grupos, na mesma conta e com o mesmo agendamento, independentemente da ordem dos grupos. O bloqueio inclui campanhas canceladas para evitar repetição acidental imediata.
- Até duas campanhas agendadas, na fila ou em processamento por cliente. `MAX_ACTIVE_CAMPAIGNS` permite de uma a cinco; a homologação usa duas.
- Cancelar pendentes impede os próximos envios da campanha. Uma mensagem já em transmissão pode concluir; não é possível desfazer mensagens já publicadas. A autorização de cancelamento é vinculada ao titular.
- A licença continua sendo reavaliada antes da transmissão. Revogação ou vencimento interrompem os pendentes.
- Antes de chamar o WhatsApp, o banco registra `EM_ENVIO` por atualização condicional. Se o processo reiniciar nesse ponto, o destino fica como entrega incerta e não é repetido automaticamente.
- Uma falha após chamar o socket ou um timeout de 45 segundos também gera entrega incerta. Os demais pendentes ficam aguardando revisão e a campanha pausa. O operador deve conferir o grupo antes de criar qualquer nova divulgação para esses destinos.
- Mensagens confirmadas como enviadas não são repetidas em reprocessamentos. Isso não equivale a comprovar leitura ou recebimento por todos os participantes.

Esses controles reduzem erros e envios indesejados. Baileys continua sendo uma integração não oficial; não há promessa de conformidade integral ou imunidade a restrições. Não foram adicionadas rotação de números, ocultação de automação ou técnicas para contornar restrições da plataforma.

## Otimizações

- Cache por conta dos IDs e nomes dos grupos por até um minuto; sem armazenar listas de participantes nesse cache. Mudanças nos grupos invalidam o cache. Atualizar grupos força nova consulta; consultas simultâneas compartilham a solicitação.
- Sincronização completa e processamento de histórico de conversas desativados, pois o produto não usa esse histórico.
- Removidas solicitações de presença/digitação a cada mensagem.
- Uma leitura inicial do registro por tarefa para verificar bloqueio e sucesso; atualização de status da campanha somente na transição inicial.
- Contagens de status agrupadas em uma consulta por conclusão de tarefa.

Os limites de RAM/CPU dos containers permanecem os da homologação. A aplicação deve continuar com uma instância porque sessões de WhatsApp e worker compartilham o processo. Ganhos de memória/CPU com sessões reais precisam de nova medição; a simulação anterior é histórica e não constitui benchmark desta versão.

## Validação

Build TypeScript e testes automatizados locais verificam autorização, isolamento de contas, duplicatas, limites, cancelamento, entrega incerta, recuperação do marcador de transmissão, timeout e cache. O APK precisa de validação em aparelho Android real. Não executar campanhas reais apenas para testar atualização ou migrations.

Esta versão passou por 47 testes locais e foi publicada na homologação a partir do commit `80a3de5`. `/ready` respondeu 200 e `/api/admin/dispatch-status` confirmou intervalos de 10000 ms, pausa de 60000 ms e lote de 30. No PostgreSQL real, duas campanhas técnicas futuras foram criadas diretamente pelo serviço, sem enfileiramento; repetição e terceira campanha ativa retornaram 409. As duas foram canceladas pela API autenticada e todos os seus registros ficaram `CANCELADO`. Permanecem na conta técnica com o prefixo `TESTE TECNICO APK SEM ENVIO`; nenhum destino real recebeu mensagem. A API recusou criação sem confirmação (400) e cancelamento de campanha inexistente (404).

Após a atualização, o portal da UNASP respondeu 200 e seus containers mantiveram os identificadores anteriores. Não houve alteração ou reinicialização dos serviços da UNASP.
