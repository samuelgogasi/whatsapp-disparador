# Envios por conta — 15/10/2026

## Comportamento

O Redis guarda uma tarefa de coordenação por conta na fila `whatsapp-accounts-v2`. Cada execução lê apenas o próximo destino elegível no PostgreSQL. Ao aguardar um intervalo, usa `moveToDelayed` e libera a vaga do worker. Até três contas distintas podem transmitir simultaneamente; uma conta compartilha seu intervalo e contador entre todas as campanhas. Não existe faixa de horário comercial: publicação e agendamento funcionam 24 horas.

O primeiro envio aguarda dez segundos. Depois de cada transmissão, a conta aguarda dez segundos e, a cada trinta transmissões, mais sessenta segundos. O contador e o próximo horário ficam em `DispatchPacing`, inclusive quando uma campanha termina ou o processo reinicia. Campanhas futuras não impedem outras campanhas imediatas; a conta é reavaliada em até cinco segundos enquanto aguarda agenda. As campanhas elegíveis da mesma conta são atendidas por antiguidade dos registros (desempate por ID).

Redis não recebe mais uma cópia do texto para cada grupo. Os logs completos continuam no banco. Uma reconciliação a cada cinco segundos encontra contas com trabalho pendente, inclusive após falha entre gravação no banco e criação da tarefa no Redis. A consulta agrupa as contas no PostgreSQL. Tarefas concluídas/falhas de coordenação são removidas; resultados de entregas continuam persistidos no banco.

## Controles

- Limite global inicial de três execuções/transmissões. Uma única tarefa por conta e proteção adicional contra reentrada local de tarefa stalled. Antes da transmissão, é verificado o token de posse da tarefa.
- `EM_ENVIO` e a reserva do próximo horário são gravados em uma transação antes de chamar o socket. Se a confirmação de entrega não for persistida, a recuperação marca entrega incerta e pausa a campanha, sem repetir automaticamente.
- Duas tentativas para falhas anteriores à transmissão, com intervalo de trinta segundos persistido por mensagem. Erros de transmissão ou timeout continuam sendo entrega incerta e exigem revisão.
- Licença e cancelamento são reavaliados imediatamente antes de entregar ao socket. Uma transmissão já iniciada pode concluir.
- O aplicativo deixa de iniciar trabalho adicional quando seu RSS excede 1.280 MiB, reavaliando em cinco segundos. É um freio de admissão, não recuperação automática de vazamento de memória ou controle dinâmico de CPU.
- Continuidade exige uma réplica do aplicativo. Sessões WhatsApp permanecem locais ao processo. Não escalar réplicas sem implementar ownership das sessões. Esta versão não promete coordenação entre múltiplos processos de WhatsApp.

## Recursos da homologação

Aplicativo: teto de 1.536 MiB / 1 vCPU; heap Node até 1.024 MiB. PostgreSQL mantém 384 MiB / 0,3 CPU e Redis 128 MiB / 0,2 CPU. Tetos somados do Compose: 2.048 MiB / 1,5 CPU. Não representam consumo permanente. Encerramento gracioso: 60 s no aplicativo / 65 s no Compose, acomodando o timeout de transmissão de 45 s.

Somente o projeto `whatsapp-homologacao/disparador` é alterado. Não modificar UNASP, seus bancos, redes, variáveis ou limites. Os limites configurados não garantem ausência de disputa por disco ou memória do host; acompanhar as medições do piloto.

## Validação

54 testes automatizados passaram, incluindo simulação com relógio controlado de dez contas × quinhentos destinos (5.000 entregas fictícias). Verificados intervalos independentes, pausa compartilhada entre campanhas, madrugada, agendamento futuro, cancelamento, vencimento, duas tentativas, entrega incerta e retomada com estado persistido. Essa simulação não mede consumo de sessões WhatsApp reais.

`node scripts/test-account-dispatch.mjs` executa integração com PostgreSQL e Redis reais, criando schema e fila temporários exclusivos. Usa dez contas fictícias com quatro destinos cada, remetente falso, intervalos reduzidos apenas no teste, três execuções simultâneas e reinício do worker. Não importa o serviço de WhatsApp nem conecta contas reais. Limpa somente os recursos temporários criados pelo próprio teste. Executar somente na homologação. Resultado de execução será registrado após a publicação.

## Publicação e retorno

A migração `20261015000000_account_dispatch` é aditiva. A fila antiga `whatsapp-dispatch` não é apagada e não tem consumidor nesta versão. A reconciliação utiliza os registros do banco como fonte de trabalho. Publicar com campanhas reais sem processamento em curso; verificar `/ready` e `/api/admin/dispatch-status` (`concurrency: 3`, `scheduling: per-account`, `hours: 24/7`).

Não retornar simplesmente para o worker antigo com campanhas em andamento: tarefas antigas e novas não compartilham a mesma política de pacing. Em eventual rollback, interromper admissões, aguardar transmissões, revisar `EM_ENVIO`/entregas incertas e reconstruir somente pendentes confirmados. Não repetir envios já concluídos.

Capacidade para dez WhatsApps reais com 2.000–2.500 entregas diárias cada ainda depende de teste autorizado com sessões reais e observação de memória, CPU, conexão, fila e falhas. Não é garantida pelos testes fictícios.
