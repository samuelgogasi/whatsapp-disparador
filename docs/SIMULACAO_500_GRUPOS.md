# Simulação de uma mensagem para 500 destinos

Executada em 14/10/2026 na VPS de homologação, com 2 vCPU e aproximadamente 3,6 GB de RAM disponíveis ao sistema operacional. Esta é uma medição de infraestrutura, sem mensagens reais ao WhatsApp.

## Resultado

| Medida | Antes da primeira execução | Maior amostra nas execuções | Após a segunda execução |
| --- | --- | --- | --- |
| RAM dos três containers do disparador | 380,3 MB | 442,0 MB | 394,1 MB |
| RAM total da VPS | 51,7% | 53,1% | 51,7% |
| CPU total da VPS | 5,1% | 9,7% | 2,5% |

As amostras do Easypanel não são uma captura contínua de todos os picos. O acréscimo observado de RAM dos containers foi de aproximadamente 62 MB e inclui um processo Node adicional usado para executar o simulador. As variações também incluem os demais trabalhos do servidor; não se pode atribuir toda mudança da VPS ao teste.

A execução com relatório completo apresentou:

- 500 tarefas concluídas; zero tarefas com falha ou pendentes.
- Mensagem de 1.024 bytes repetida na fila para os 500 destinos fictícios.
- 49 ms para inserir as tarefas no Redis.
- 53,825 segundos de processamento, com espera artificial de 100 ms por tarefa.
- 99,117 segundos ao todo, incluindo intervalos de observação antes e depois do processamento.
- Redis: 2.364.176 bytes usados antes; 3.412.336 bytes com as 500 tarefas aguardando (aumento de aproximadamente 1 MiB). Após processar e antes de limpar a fila: 3.776.840 bytes.
- Tabelas e índices temporários: 204.800 bytes. Isso não mede WAL, histórico de produção, backups ou amplificação de escrita.
- Esquema temporário removido; nenhuma chave da fila exclusiva de simulação restante no Redis.

Na segunda medição, 55 consultas a `/ready` e 55 à página inicial da UNASP retornaram HTTP 200. As medianas de tempo vistas a partir do computador local foram 40 ms e 91 ms, respectivamente; os percentis 95 foram 45 ms e 111 ms. Não houve falhas nessas consultas. Essa amostragem não demonstra ausência de toda interrupção possível entre as consultas nem mede disponibilidade histórica.

## Método e isolamento

O script `backend/scripts/simulate-500.mjs` foi executado no console do container `whatsapp-homologacao_disparador-app-1`, com heap Node limitado a 96 MB. Ele exige os endereços internos `postgres` / banco `whatsapp_homologacao` e `redis`, cria nomes únicos `simulation500_<hex>` e remove apenas os próprios objetos de teste. Nenhum serviço da UNASP foi alterado ou reiniciado. A aplicação do disparador também permaneceu em execução, sem novo deploy.

Foi usado BullMQ real com concorrência 1 e PostgreSQL real. O processamento reutiliza `processDispatch` da aplicação com um adaptador de armazenamento de teste. Esse adaptador executa consultas e atualizações equivalentes em tabelas simplificadas de campanha, mensagens e licença, em esquema exclusivo. Ele não usa cadastros ou campanhas dos clientes e não reproduz todo o schema Prisma, chaves estrangeiras ou o endpoint de criação de campanha.

O envio foi substituído por uma espera de 100 ms com leitura de licença antes/depois. O script não importa o serviço WhatsApp, não cria sockets, não usa números ou JIDs de grupos reais e não publica mensagens. Isso permite medir fila e banco sem efeitos externos sobre destinatários. **Não foram medidos criptografia, sincronização, metadados ou envio real a 500 grupos**, nem 30 sessões simultâneas, imagens ou vídeos.

Na primeira execução as 500 tarefas também terminaram, mas a gravação do relatório em `/app` falhou por permissão após a limpeza. A execução foi repetida com destino gravável em `/tmp`. O relatório completo da segunda execução ficou em `/tmp/simulation500-report.json` no container; o resumo foi transcrito em `simulation-500-summary.json` e registrado em captura de tela. Os arquivos `simulation-500-http*.json` contêm as consultas HTTP de acompanhamento.

## Interpretação

A fila e o banco suportaram este cenário sintético sem pressão relevante nas amostras observadas. O resultado não comprova a capacidade de enviar a 500 grupos reais, não certifica uma quantidade de clientes e não avalia bloqueios do WhatsApp.

O tempo de 54 segundos não é previsão de entrega de uma campanha. Pelos valores padrão atuais, 500 tarefas reais incluem aproximadamente 10–30 segundos de esperas por destino e 16 pausas de 5–10 minutos. Apenas essas esperas somam aproximadamente 2h43 a 6h50 (média de 4h47), antes do tempo de rede, falhas, reconexões ou outras campanhas na fila. Os intervalos são controle operacional, sem garantia contra bloqueios.

Para dimensionar uso real, ainda é necessário observar sessões conectadas e um piloto autorizado com destinatários reais, além de implementar controle de concorrência por cliente, pausa/cancelamento e tratamento de tempo limite dos envios.
