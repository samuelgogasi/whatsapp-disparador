# Avaliação e plano de desenvolvimento

## Estado atual do piloto

Homologação HTTPS publicada em projeto separado da UNASP. APK Android 0.1.0 de teste compilado e disponibilizado, com os envios mantidos na VPS. A configuração atual é de 10 segundos por mensagem e uma pausa de um minuto a cada 30 grupos. Cancelamento de pendentes, confirmação de autorização na API, bloqueio de duplicatas, limite de campanhas ativas e pausa para revisão de entrega incerta foram implementados. Há 47 testes locais aprovados e validação de controles na API/PostgreSQL da homologação, sem mensagens reais nos testes desta atualização.

Referências atuais: [Android](docs/ANDROID.md), [operação do piloto](docs/OPERACAO_PILOTO.md) e [homologação](docs/HOMOLOGACAO.md). Permanecem pendentes instalação/pareamento do APK em aparelho real, PWA do iPhone, concorrência justa por cliente, medição de múltiplas sessões, outbox e preparação comercial. As revisões datadas abaixo são histórico da avaliação inicial e não substituem este estado atual.

Revisão: 02/10/2026. Escopo observado: todos os arquivos presentes no backend local.

Atualização de produto: 08/10/2026. Requisitos adicionados: sistema pago, chave individual por usuário e teste grátis de 7 dias. As regras comerciais e os diferenciais abaixo são propostas de implementação; ainda não existem no backend.

Público confirmado: jornalistas e proprietários de sites/portais de notícias. Divulgação em grupos e para contatos individuais faz parte do escopo. Infraestrutura disponível informada: VPS HostGator com Easypanel, 4 GB de RAM, 2 vCPU e 100 GB de armazenamento, compartilhada com um sistema existente. Não houve acesso direto à VPS; a avaliação usa a captura de consumo fornecida pelo usuário, detalhada na seção de infraestrutura.

Decisão comercial confirmada: Pix com conferência manual pelo proprietário; o cliente envia comprovante ao WhatsApp do proprietário e recebe chave mensal após liberação. Gateway, checkout e renovação automática saem do escopo do MVP. A VPS será usada inicialmente por poucas contas; o sistema existente é um portal informativo, sem picos conhecidos pelo proprietário.

## Primeira implementação — 08/10/2026

- Cadastro/login com senha protegida por scrypt e sessões com token armazenado por hash.
- Painel inicial do cliente e administração para consultar clientes, confirmar Pix, emitir, reemitir e revogar chaves.
- Teste de 168 horas ativado explicitamente, uma vez por conta; verificação de e-mail ainda pendente.
- Chave mensal vinculada à conta, exibida só na emissão, armazenada por hash e ativada pelo titular.
- Validade por mês de calendário; renovação antecipada preserva o período pago e gera nova chave.
- Registro do valor e referência única do pagamento, evitando liberação repetida pelo mesmo Pix.
- Rotas de campanhas e sessões isoladas pelo login; licença conferida na API e antes do envio no worker.
- Bloqueio de pendentes por licença, sem reativar campanhas automaticamente ao renovar.
- Migrations inicial/incremental, imagem Docker proposta e prévia visual local.

Esta é a primeira entrega do módulo de acesso/Pix e do painel para grupos, não a conclusão de todas as etapas. Migrations, imagem Docker e integração real com PostgreSQL/Redis/WhatsApp ainda precisam de validação; não houve implantação na VPS. Instruções: [docs/LICENCAS_E_PIX.md](docs/LICENCAS_E_PIX.md).

Validação da primeira entrega: compilação TypeScript e 23 testes passaram; schema Prisma válido e telas de entrada inspecionadas no navegador. Evidências e limites: [docs/VALIDACAO_2026-10-08.md](docs/VALIDACAO_2026-10-08.md).

## Segunda entrega — 09/10/2026

- Interface reorganizada como sistema: menu lateral, visão geral, nova divulgação, agendamentos, histórico, WhatsApp e licença/Pix.
- Agendamento pontual implementado com início em Brasília, data armazenada em UTC, validação de antecedência e jobs adiados até a data prevista.
- Lista de agendamentos e contadores calculados nas últimas 50 campanhas, com escopo indicado no painel.
- Fluxo de pagamento explicitado: Pix pessoal, link para o WhatsApp, comprovante enviado pelo cliente e chave mensal entregue pelo proprietário após conferência.
- Dados do Pix/WhatsApp disponíveis somente a usuários autenticados; configuração real ainda depende da chave/número do proprietário.
- Compilação/schema validados e 29 testes passaram, incluindo novos casos de agenda e privacidade do Pix. Migrations/execução com Redis real ainda pendentes.

Documentação: [docs/AGENDAMENTO.md](docs/AGENDAMENTO.md). Recorrência, edição/cancelamento de agendamentos, contatos individuais e calendário visual continuam pendentes; o recurso desta entrega é envio pontual para grupos.

## Parecer

Distribuição móvel proposta em 14/10/2026: APK no Android e PWA no iPhone, compartilhando painel/backend. Conexão por código implementada como opção principal no celular; QR mantido como alternativa. Compilação e 37 testes com dependências substituídas passaram, sem vinculação real de conta. APK/PWA e homologação em aparelhos continuam pendentes. Detalhes: [docs/APK_PWA_E_PAREAMENTO.md](docs/APK_PWA_E_PAREAMENTO.md).

Revisão móvel de 14/10/2026: corrigida largura excedente do painel, menu recolhível no celular, controles de toque e tipografia dos campos. Verificadas telas de 320, 390 e 430 px no navegador de desenvolvimento. PWA e testes em aparelhos Android/iPhone reais seguem pendentes. Estratégia e etapas: [docs/MOBILE.md](docs/MOBILE.md).

Express + TypeScript + PostgreSQL/Prisma + Redis/BullMQ é uma base coerente para campanhas assíncronas, histórico e tentativas de envio. A separação entre API, fila e serviço de WhatsApp é um bom começo. Entretanto, o que existe é um protótipo de backend para grupos; não é ainda um sistema pronto para envio em massa em produção.

A implementação atual já possui painel por áreas, login, licenciamento manual e agendamento pontual para grupos. Ainda não envia para contatos individuais, não coleta notícias e não tem recorrência, edição/cancelamento de campanhas ou recuperação completa após reinício. Também não há evidência de teste real com WhatsApp, Redis e PostgreSQL nesta revisão.

Baileys usa o WhatsApp Web e não é uma integração oficial. Intervalos e presença de digitação não garantem ausência de bloqueio, aceitação pelas políticas ou entrega aos participantes. Decidir o provedor com base no público, nos tipos de destinatários e na capacidade efetivamente disponível para a conta. Não presumir que uma API oficial substitui diretamente o acesso aos grupos existentes.

## O que foi corrigido nesta revisão

- Validação de IDs de sessão usados em caminhos de disco, para impedir navegação para outros diretórios.
- Rejeição de grupos duplicados, destinatários individuais, texto vazio e mídia com parâmetros incompletos.
- Validação de números, tamanho de lote e intervalos mínimos/máximos no ambiente.
- Campanhas criadas como PENDING; passam a PROCESSING quando o worker inicia.
- Falha com nova tentativa disponível permanece PENDING no log; apenas a última tentativa marca ERRO.
- A conclusão é avaliada também após falha definitiva, inclusive quando nenhum envio tem sucesso.
- Job já registrado como enviado é ignorado em reprocessamento, evitando duplicação nesse caso.
- IDs determinísticos nos jobs, tratamento de eventos de erro e suporte ao banco lógico/TLS do Redis.
- API vinculada ao endereço local por padrão, lockfile de dependências, Compose com persistência e sete testes de regressão.

O status PARTIAL_FAILURE continua sendo usado para qualquer campanha finalizada com erro, inclusive falha total, para preservar o modelo atual. Diferenciar FAILED é trabalho da próxima etapa.

## Problemas que ainda exigem implementação

| Prioridade | Problema observado | Próxima solução |
| --- | --- | --- |
| P0 | Autenticação/isolamento implementados, ainda sem teste integrado no banco | Validar a implementação com PostgreSQL, recuperação de senha e verificação de e-mail |
| P0 | Licenças/Pix manual implementados, concorrência SQL ainda não validada | Validar migrations, bloqueio por usuário, repetição do Pix e expiração em integração real |
| P0 | Banco e Redis não participam de uma transação comum | Outbox persistida junto da campanha e publicador recuperável; reconciliar pendências sem jobs |
| P0 | Confirmação de envio pode ocorrer antes de falha ao salvar o log | Persistir ID da mensagem, representar resultado incerto e evitar retry cego; não prometer exactly-once |
| P0 | Sessões ficam em memória e não são restauradas no boot | Recuperação, estado explícito, reconexão com backoff e pausa dos jobs enquanto offline |
| P0 | Reconexão automática pode gerar promises rejeitadas sem tratamento | Capturar falhas de inicialização/eventos, limitar reconexão e implementar desligamento controlado |
| P0 | URLs de mídia arbitrárias são baixadas pelo backend | Upload controlado ou allowlist, bloqueio de redes internas e limites de tamanho/tipo/tempo |
| P0 | npm audit aponta 3 entradas high na cadeia Prisma → @prisma/config → deepmerge-ts | Atualizar a cadeia em alteração dedicada e validar compatibilidade; não aplicar fix --force automaticamente |
| P1 | Uma fila com concorrência 1 limita todos os operadores; várias instâncias podem enviar em paralelo | Definir dono da sessão, fila/limites por conta e coordenação distribuída |
| P1 | Confirmação da biblioteca é tratada como envio bem-sucedido | Distinguir aceito pelo provedor de entregue/lido e processar recibos quando disponíveis |
| P1 | Lista de grupos do cliente não é conferida na criação | Conferir participação, permissão de envio e grupos autorizados antes de enfileirar |
| P1 | Sem limites por operador, paginação ou retenção | Quotas, limite de corpo, paginação, política de retenção e logs sem credenciais |
| P1 | Sem migrations versionadas ou testes de integração | Criar migration inicial, executar em banco descartável e validar os fluxos completos |

## Público e opções de divulgação

O produto deve ajudar jornalistas e portais a divulgar matérias e organizar sua distribuição. O painel deve usar termos editoriais como matéria, público, boletim e calendário. As duas modalidades abaixo são requisitos; o backend atual continua suportando somente grupos até a implementação da etapa correspondente.

### Fluxo de criação da divulgação

1. **Preparar matéria:** informar link do portal, título, chamada curta, imagem opcional e editoria. Como evolução, buscar metadados do link ou importar pelo RSS/API do próprio portal, com prévia editável e proteção contra URLs internas.
2. **Escolher onde divulgar:** mostrar duas opções claras, **Grupos de WhatsApp** e **Contatos individuais**. O usuário pode selecionar uma ou ambas na mesma campanha.
3. **Selecionar público:** para grupos, listar os grupos disponíveis e autorizados; para contatos, escolher pessoas cadastradas ou listas por tema/região com autorização de recebimento registrada. Mostrar as seleções separadamente.
4. **Revisar:** apresentar mensagem e mídia, conta remetente, horário, modalidade e quantidade de destinos. Exemplo: “12 grupos e 80 contatos”. Não apresentar soma dos participantes dos grupos como pessoas alcançadas ou entrega comprovada.
5. **Enviar ou agendar:** oferecer envio de teste, envio imediato ou agendamento, respeitando plano, autorização e capacidades do provedor.
6. **Acompanhar:** separar resultados por grupos e contatos, exibindo pendentes, aceitos pelo provedor, falhas e recibos quando disponíveis.

Enviar para contatos individuais significa uma mensagem privada por destinatário; não cria um grupo nem promete usar a lista de transmissão nativa do aplicativo WhatsApp.

### Requisitos de dados e envio para pessoas

- Criar `Contact` com telefone normalizado, nome opcional, tags, usuário proprietário e estado de recebimento; criar listas de contatos e manter origem/data da autorização e da retirada.
- Cadastrar contatos manualmente e importar CSV com prévia, validação e deduplicação. Não extrair automaticamente membros de grupos para montar listas privadas.
- Incluir preferências por editoria/região e mecanismo de parar o recebimento. Verificar bloqueio/retirada também no worker antes do envio, inclusive para campanhas antigas.
- Substituir a dependência exclusiva de `groupJids` por destinos tipados (`GROUP`/`CONTACT`), com registros de destinatários e jobs por destino. Preservar compatibilidade das campanhas existentes por migration e contrato de API definido.
- Deduplicar cada tipo de destino dentro da campanha. Um contato que também participe de um grupo poderá ver a notícia duas vezes; o produto deve explicar isso, sem prometer deduplicação entre grupo e pessoa sem dados confiáveis de participação.
- Medir consumo por destino e modalidade. Um envio para grupo não equivale a uma cobrança por cada participante. Definir a unidade comercial e separar eventuais custos do provedor oficial.
- Criar interface de provedor para texto, mídia, destinos e recibos. Se grupos e contatos usarem integrações diferentes, apresentar capacidade e remetente de cada modalidade, bloqueando opções indisponíveis para aquela conta.
- Na integração oficial, incorporar as regras de autorização, templates e janela de atendimento vigentes. A existência de login/licença não autoriza o recebimento pelo destinatário.

Conclusão desse bloco: grupos, contatos e campanha mista funcionam de ponta a ponta, com público separado, autorização aplicada, isolamento por usuário e logs por modalidade. Ainda não foi implementado.

## Produto pago, licença individual e teste grátis

### Requisitos confirmados

- Cada usuário terá uma chave individual de acesso/licença vinculada à sua conta.
- O produto será pago e oferecerá 7 dias grátis.
- A experiência deve demonstrar valor durante o teste e oferecer motivos claros para continuar usando.

### Modelo de acesso proposto

Login identifica o usuário; a chave identifica e autoriza sua licença; a assinatura determina os recursos, limites e período de acesso. Uma chave válida sozinha não significa assinatura ativa. A chave nunca será o `userId`, o número de WhatsApp ou a credencial do provedor de pagamento.

- Gerar a chave no servidor com aleatoriedade criptográfica, sem dados pessoais embutidos. Exibir o segredo completo uma vez e armazenar somente seu hash e um prefixo identificador.
- Manter uma chave ativa por usuário no MVP. Permitir revogar e gerar outra, invalidando a anterior; trocar a chave não reinicia o teste grátis.
- Usar sessão autenticada no painel; não obrigar o usuário a copiar a chave a cada acesso ou colocá-la em URLs. Chaves de integrações futuras terão permissões próprias.
- Vincular recursos, sessões de WhatsApp, campanhas e métricas ao usuário autenticado. O cliente não pode escolher outra conta alterando `userId`.
- Aplicar autorização tanto na API quanto no worker, imediatamente antes de cada envio. Campanhas agendadas ou já enfileiradas não podem contornar licença expirada, revogada ou limites do plano.
- Registrar emissão, rotação e revogação sem gravar o segredo nos logs. Limitar tentativas de validação de chave.

Entidades implementadas nesta etapa: `License` (usuário, hash, prefixo, tipo, validade, ativação e revogação), `ManualPayment` (licença, usuário, referência única, valor e confirmação) e `AuthSession`. `trialStartedAt` e `trialEndsAt` ficam na conta e não são apagados pela renovação. `Plan` e `Usage` são evoluções para quotas. `Subscription` e `BillingEvent` de gateway serão avaliados somente se houver decisão futura de automatizar cobrança.

### Regras propostas para os 7 dias

- Começar o teste na primeira ativação explícita após verificação da conta, mostrando a data de término antes de ativar. Essa escolha evita consumir o teste antes de o usuário iniciar a configuração.
- Medir 7 dias como 168 horas, com datas e comparação no servidor em UTC. Exibir início e término no fuso do usuário, inicialmente America/Sao_Paulo. Alterar o relógio do computador não amplia o acesso.
- Oferecer as funcionalidades que demonstram o produto, com limites de contas WhatsApp, destinos, envios e armazenamento a definir antes do lançamento. Não anunciar uso ilimitado.
- Mostrar dias restantes, limite disponível e opção de contratar no painel. Como proposta inicial, não exigir cartão nem converter automaticamente o teste em cobrança.
- Na expiração, bloquear novas campanhas e novos envios, preservando consulta do histórico, gestão da assinatura e exportação conforme a política de retenção. Marcar jobs bloqueados com motivo de licença, sem consumi-los como falhas de WhatsApp.
- O envio que já foi entregue ao provedor não pode ser desfeito pela expiração. Reavaliar a licença antes do próximo envio; após renovação, exigir retomada explícita de campanhas antigas para evitar disparos inesperados.
- Permitir um teste por conta verificada e registrar sinais de abuso com o mínimo de dados necessário. Novas contas ainda podem tentar repetir o benefício; não prometer prevenção absoluta.

No MVP manual, os estados de acesso são derivados da licença: sem licença, aguardando ativação, teste ativo, mensal ativo, vencida ou revogada. Não há cobrança recorrente automática para cancelar. O proprietário pode revogar o acesso; após o vencimento, outra confirmação de pagamento é necessária. Prazo de retenção e política comercial para reversões ainda precisam ser definidos.

### Cobrança e planos

- MVP confirmado: pagamento por Pix fora do sistema e conferência manual pelo proprietário. Definir preço e comunicar valor/dados do Pix; não há checkout nem gateway nesta entrega.
- Registrar confirmação somente na administração autenticada, com usuário, valor e referência única da transação. O comprovante enviado ao WhatsApp não libera acesso automaticamente.
- Reutilizar a referência do Pix não renova de novo. Para perda da chave, reemitir preservando validade e invalidando a anterior, sem registrar outro pagamento.
- Reservar quota de forma atômica e definir quando um envio consome quota; reprocessar um job não pode cobrar consumo duas vezes. Planos determinam limites no backend, não apenas botões visíveis no painel.
- A tela de acesso implementada mostra validade, ativação da chave e instruções de Pix/contato configuradas no ambiente. Consumo/quotas e consulta administrativa detalhada de pagamentos serão evoluções.

## Diferenciais propostos e experiência dos 7 dias

Posicionamento proposto para o público confirmado: ajudar jornalistas e portais a transformar matérias em divulgações e boletins para grupos e leitores cadastrados, com revisão editorial, organização e acompanhamento. A proposta de valor será validada com esses usuários; não é uma afirmação de exclusividade ou de superioridade sobre concorrentes.

| Prioridade | Diferencial | Valor percebido | Evidência para validar |
| --- | --- | --- | --- |
| MVP | Primeira campanha guiada, prévia real e envio de teste | Começar sem conhecer APIs ou configurações técnicas | Tempo entre ativação e primeiro envio de teste bem-sucedido |
| MVP | Divulgação em grupos, contatos ou ambos, com seleção clara | Atender distribuição pública em grupos e leitores que escolheram receber mensagens privadas | Campanhas concluídas por modalidade e clareza da seleção nos testes de uso |
| MVP | Matéria com link, título, chamada e editoria, preparada em um só editor | Reutilizar o conteúdo do portal com controle da apresentação | Tempo de preparação e uso recorrente pelo jornalista |
| MVP | Públicos salvos por tema, região ou interesse | Selecionar grupos relevantes e reutilizar uma seleção | Reutilização de públicos em campanhas posteriores |
| MVP | Modelos de boletim com identidade visual, fonte e data | Publicar notícias com apresentação consistente | Uso recorrente dos modelos e avaliação pelos operadores |
| MVP | Revisão antes do envio, alerta de repetição e biblioteca de conteúdo | Evitar publicar a mesma notícia novamente por engano | Alertas úteis e repetições evitadas; permitir republicação consciente |
| MVP | Calendário editorial e campanhas recorrentes controladas | Organizar a rotina de publicação | Agendamentos executados no horário e repetição de uso |
| MVP | Progresso claro, motivo do erro e recuperação seletiva | Saber o que aconteceu e agir sem refazer tudo | Campanhas concluídas e tempo para resolver falhas |
| Depois | Entrada por RSS/API e sugestão de boletins para aprovação | Reduzir trabalho de preparar notícias | Tempo de preparação medido e sugestões aprovadas |
| Depois | Aprovação por equipe e biblioteca compartilhada | Organizar operação com mais de uma pessoa | Demanda real por colaboração e uso das aprovações |
| Depois | Métricas de clique em links próprios, com medição transparente | Entender interesse pelos conteúdos | Cliques observados; distinguir bots/repetições e não confundir clique com leitura |

Fontes, licença de uso do conteúdo e qualidade editorial precisam ser avaliadas quando a entrada de notícias for implementada. Personalização deve representar públicos e preferências reais. Não vender promessa de ausência de bloqueio ou exibir entrega/leitura sem recibos observáveis.

### Jornada sugerida do teste

| Momento | Experiência no produto | Resultado esperado |
| --- | --- | --- |
| Dia 1 | Ativação transparente, conexão, modelo pronto e envio de teste para destino controlado | Usuário consegue ver o primeiro resultado |
| Dias 2–3 | Criar público salvo, preparar boletim e agendar campanha | Usuário monta uma rotina reutilizável |
| Dias 4–5 | Consultar histórico, recuperar falhas e reutilizar conteúdo/modelo | Usuário percebe organização e redução de retrabalho |
| Dia 6 | Resumo do uso real, prazo restante e apresentação dos planos | Usuário entende o valor experimentado e a oferta |
| Dia 7 | Horário de expiração visível e caminho simples para contratar | Decisão de compra sem perda inesperada de histórico |

Essa jornada orienta o painel e o onboarding; não implica envio automático de mensagens promocionais. Usar apenas dados reais nos resumos, sem inventar tempo economizado ou resultados.

Medir o funil: contas verificadas → testes ativados → primeira conexão → primeiro envio de teste → primeira campanha → retorno em outro dia → assinatura paga. Acompanhar tempo até primeiro valor, falhas de onboarding, uso dos diferenciais e conversão por período. Metas numéricas serão definidas após o piloto; visual bonito sozinho não comprova retenção.

Decisões ainda abertas: segmento do piloto dentro de jornalistas/portais, preço, integração para cada modalidade, limites por plano/teste e prazo de retenção. Cobrança será Pix manual com chave mensal. Para o MVP, a licença será individual; assentos de equipe e organizações compartilhadas serão uma evolução do modelo.

## Infraestrutura inicial: VPS HostGator com Easypanel

### Parecer de capacidade

É plausível usar a VPS de 4 GB de RAM, 2 vCPU e 100 GB de disco para desenvolvimento remoto, homologação e um piloto limitado. É uma avaliação preliminar, não um teste de capacidade. O consumo do sistema existente, as sessões WhatsApp simultâneas, tamanho das mídias e picos de publicação determinam a folga real. Os 100 GB são armazenamento, não RAM adicional.

Captura do Easypanel fornecida pelo usuário em 08/10/2026: CPU 2,0%, memória 44,4% (1,6 GB / 3,6 GB), disco 17,2% (16,0 GB / 93,1 GB) e rede 0 B/s. A folga aproximada no instante é 2,0 GB de RAM e 77,1 GB de disco. Esses números representam o servidor inteiro, não o consumo isolado da aplicação existente; a imagem não permite determinar duração do gráfico ou picos em outros horários. Usar os 3,6 GB exibidos como referência para o orçamento, em vez de presumir 4 GB integralmente utilizáveis.

Com essa captura, a recomendação é aproveitar a VPS para um piloto com poucas sessões simultâneas e medir o conjunto. Buscar inicialmente cerca de 1,0–1,2 GB de consumo incremental em runtime, como alvo a validar, preservando cerca de 0,8–1,0 GB da folga atual para variações. Não aplicar esse alvo como limite rígido sem teste. O extremo superior do orçamento estimado abaixo (2,2 GB) excederia a folga observada; nesse cenário será necessário otimizar, separar serviços ou ampliar a VPS. Builds e sincronização de sessões precisam de avaliação própria de pico.

Não estimar clientes suportados a partir da RAM isoladamente. Usuários cadastrados e contas WhatsApp simultaneamente conectadas geram cargas diferentes. O número inicial de sessões/clientes será definido por um piloto incremental com monitoramento, não por promessa comercial.

### Desenho de implantação proposto

- Criar um projeto separado no Easypanel, com serviços, credenciais, rede e volumes próprios, preservando o sistema existente.
- Manter uma única instância Node.js com API e worker juntos na primeira implantação. O serviço Baileys mantém sessões em memória; não habilitar réplicas ou sobreposição de instâncias nos deployments antes de implementar coordenação e desligamento correto.
- Servir o painel como arquivos estáticos no mesmo aplicativo ou em serviço leve, evitando um processo extra de renderização quando não houver necessidade.
- Usar PostgreSQL e Redis do projeto, acessíveis somente pela rede interna. Volume persistente para banco, Redis e credenciais de sessão; Redis com persistência e política `noeviction` conforme recomendação do BullMQ. Tratar falta de memória da fila sem descartar jobs silenciosamente.
- Configurar domínio/HTTPS pelo proxy do Easypanel. No container da API, definir `HOST=0.0.0.0`, `PORT=3333` e apontar o proxy para essa porta. Não alterar o padrão local de `127.0.0.1` para desenvolvimento.
- Preparar imagem de produção e migrations versionadas; executar migrations por procedimento controlado. O `compose.yaml` atual é apenas infraestrutura local, não uma implantação de produção pronta.
- Gerar builds fora da VPS quando possível e publicar imagens versionadas; se for necessário construir nela, fazer isso com monitoramento e sem concorrência com picos do sistema existente.
- Começar com texto, links e imagens pequenas. Não executar Chromium, modelos locais de IA ou transcodificação de vídeos nesse servidor como parte do MVP. Baileys não precisa de um navegador Chromium para funcionar.
- Usar retenção de logs, limites de uploads e limpeza de temporários. Avaliar armazenamento externo para mídias quando o uso justificar; guardar backups em destino externo à VPS e testar restauração.

### Orçamento inicial para dimensionamento

Faixas abaixo são estimativas de planejamento, sem benchmark. Não são limites de container já aplicados nem garantias de consumo.

| Componente novo | RAM estimada inicialmente | O que faz variar |
| --- | --- | --- |
| API + worker + sessões WhatsApp | 512–1024 MB | Sessões simultâneas, sincronização, mídia e processamento |
| PostgreSQL | 384–768 MB | Conexões, consultas, cache e tamanho das operações |
| Redis da fila | 128–256 MB | Jobs pendentes, histórico e payloads |
| Painel estático, se separado | 64–128 MB | Implementação do servidor e tráfego |

Total novo estimado: cerca de 1,1–2,2 GB, mais sistema operacional, Docker/Easypanel, aplicação existente e margem para picos. Ajustar a partir de medições; sessões adicionais podem ultrapassar esse orçamento. Redis com `maxmemory` precisa de folga no limite do container para persistência e outras estruturas.

### Verificação antes de implantar

- [x] Obter primeira captura de uso agregado: CPU 2%, RAM 1,6/3,6 GB e disco 16/93,1 GB.
- [ ] Medir RAM disponível/consumida, CPU, disco e uso por container em período normal e no pico do sistema existente; observar pelo menos um ciclo diário e horários de publicação.
- [ ] Levantar sistema operacional, serviços já instalados, domínios/portas em uso e política de backup.
- [ ] Definir limites/reservas de recursos e testar os limites sem provocar encerramento de processos.
- [ ] Testar piloto incremental: novas sessões, campanhas simultâneas, imagens, reinício, deployment e falha de dependências.
- [ ] Monitorar backlog/tempo de espera da fila, latência da API e também a latência do sistema existente.
- [ ] Confirmar ausência de OOM/reinícios e preservar margem. Como metas iniciais de operação, propor pelo menos 20% de RAM disponível e 20% de disco livre em uso normal; validar picos separadamente.

Se houver memória insuficiente, uso frequente de swap, CPU persistentemente saturada, reinícios ou degradação do sistema existente, reduzir concorrência/limites ou separar/ampliar infraestrutura antes de aceitar mais clientes. Não ampliar a RAM apenas para mascarar uma fila sem limites ou um problema de sessão.

Esta atualização não instalou serviços nem modificou a VPS. O provisionamento depende primeiro da leitura dos recursos reais e da conclusão das proteções do backend.

## Etapas e critérios de conclusão

### 1. Definir o produto e o provedor

- [x] Confirmar público (jornalistas e donos de portais) e destinos (grupos e contatos individuais, com opção de ambos).
- [ ] Definir número de contas simultâneas, volume e segmento do piloto.
- [ ] Definir origem das notícias: texto manual, RSS, API ou outro processo.
- [ ] Definir destinatários autorizados, preferências e mecanismo de interrupção dos envios.
- [ ] Escolher integração com WhatsApp e documentar limites e condições aplicáveis à conta.
- [ ] Definir público inicial, proposta de valor, preço, limites do teste/plano e regras comerciais.

Concluída quando os fluxos e o provedor estiverem registrados, sem depender de funcionalidades presumidas.

### 2. Tornar o backend confiável — próxima etapa recomendada

- [x] Implementar autenticação e isolamento por usuário na API; validar com banco real antes de acesso remoto.
- [ ] Implementar outbox, publicação recuperável e reconciliação das campanhas.
- [ ] Restaurar sessões, tratar desconexões e encerrar API/fila/banco de forma controlada.
- [ ] Registrar tentativas, ID de mensagem e resultado incerto; definir FAILED/CANCELED/PAUSED.
- [ ] Proteger uploads, revisar dependências e versionar migrations.
- [ ] Testar com PostgreSQL e Redis descartáveis: indisponibilidade da fila, reinício, falha total e retry.
- [ ] Implementar contatos, autorização/preferências, destinos tipados, contrato da API e envio privado com testes por modalidade.

Concluída quando uma campanha sobreviver a falhas e reinícios sem desaparecer ou ser concluída prematuramente, com acesso autorizado e resultados auditáveis.

### 3. Implementar licenciamento e cobrança — obrigatório para o MVP pago

- [x] Criar modelos e migrations para licença, pagamento manual, teste e sessões de login.
- [x] Implementar emissão, ativação, rotação e revogação de chave com isolamento por usuário.
- [x] Implementar ativação única do teste, expiração após 168 horas e relógio do servidor.
- [x] Verificar licença na API e no worker e bloquear pendentes após perda do acesso.
- [x] Implementar administração de Pix com referência única, valor, confirmação e renovação mensal.
- [x] Cobrir regras de chave de outra conta, revogação, expiração, pagamento repetido e repetição do teste em testes automatizados com dependências substituídas.
- [ ] Aplicar e testar migrations/concor­rência em PostgreSQL real e validar bloqueio durante campanha integrada.
- [ ] Implementar planos/quotas e consumo atômico, consulta detalhada de pagamentos e retomada seletiva explícita.

Concluída quando teste e pagamento liberarem somente o acesso previsto, o bloqueio funcionar no backend e eventos repetidos não duplicarem validade ou consumo.

### 4. Construir o painel operacional e a primeira experiência

- [x] Login, início de conexão com QR, atualização do estado e seleção de grupos disponíveis no painel inicial; teste real pendente.
- [ ] Implementar desconexão explícita e recuperação da sessão após reinício.
- [ ] Opções visíveis de divulgação em grupos, contatos individuais ou ambos; cadastro/importação e seleção de listas de contatos.
- [ ] Editor de matéria com link, título, chamada, imagem e editoria; revisão de destinos por modalidade.
- [ ] Editor com texto, mídia, prévia e envio de teste para destino controlado.
- [x] Criação de campanha de texto para grupos e consulta de resultado por grupo no painel inicial.
- [ ] Progresso automático com contadores de pendentes, enviados e erros.
- [ ] Histórico paginado e detalhe dos erros.
- [ ] Onboarding guiado até o primeiro envio de teste, com prévia e modelo de boletim.
- [ ] Tela da licença/assinatura, consumo, validade do teste e contratação.
- [ ] Públicos salvos e biblioteca de modelos/conteúdo, respeitando isolamento por usuário.
- [ ] Instrumentar o funil de ativação e conversão com eventos mínimos necessários.

Concluída quando o operador completar o fluxo sem chamar a API manualmente e tiver visibilidade do resultado.

### 5. Controle das campanhas

- [x] Agendamento pontual com horário de Brasília e persistência em UTC; validação real com Redis/banco ainda pendente.
- [ ] Pausar, retomar e cancelar; explicar que mensagens já enviadas não são desfeitas.
- [ ] Reenvio seletivo apenas de falhas elegíveis, com rastreabilidade.
- [ ] Limites por conta e prevenção de campanhas duplicadas na API.
- [ ] Calendário editorial e alertas de repetição de conteúdo por público.
- [ ] Recorrência diária/semanal e edição/cancelamento seguro de agendamentos.

Concluída quando os controles forem respeitados pelo worker mesmo após reinício.

### 6. Entrada de notícias, se fizer parte do produto

- [ ] Conectar fontes aprovadas, deduplicar conteúdos e guardar origem/data.
- [ ] Montar mensagem por template e oferecer revisão editorial.
- [ ] Associar fontes a públicos e agendas, com aprovação antes da distribuição automática.

Concluída quando a mesma notícia não for repetida e houver controle claro sobre o que será enviado e para quem.

### 7. Operação e publicação

- [ ] Ambiente de homologação, CI, backups e teste de restauração.
- [ ] Gestão de segredos, proteção das sessões e HTTPS para o painel/API.
- [ ] Métricas de fila, falhas, desconexões e readiness de banco/Redis.
- [ ] Validar carga com provedor simulado; piloto real em grupos controlados.
- [ ] Documentar implantação, rollback e procedimentos de suporte.
- [ ] Executar piloto de 7 dias com usuários do público escolhido e medir ativação, retorno e contratação.
- [ ] Medir a VPS compartilhada e preparar implantação isolada no Easypanel seguindo o orçamento e os critérios acima.

Concluída quando o piloto e os testes de recuperação passarem e a operação puder detectar e corrigir falhas.

## Resultado das verificações desta revisão

As verificações abaixo são da revisão técnica de 02/10/2026 e preservam esse histórico. A primeira implementação de 08/10/2026 acrescenta licenciamento/Pix manual, login, painel e testes de regras/HTTP. Contatos individuais e implantação na VPS continuam pendentes. Veja o documento de licenças para limites de validação.

- `npm run prisma:generate`: passou, cliente Prisma 6.19.3.
- `npm run build`: passou.
- `npm test`: 7 testes passaram, sem enviar mensagens reais.
- `npm audit`: 3 entradas high na mesma cadeia de dependência; pendência registrada acima. O relatório com `--omit=dev` também aponta a cadeia.
- Remote Git `origin`: configurado; `git ls-remote` acessou o repositório e não retornou refs.
- Não há identidade Git local/global configurada no ambiente observado. Nenhum commit/push foi realizado.
- Docker não foi encontrado no PATH. Não foi possível validar Compose, migrations ou integração real neste ambiente.

## Orientação para a outra IDE

Leia este plano e os diffs antes de alterar os mesmos arquivos. Próximo bloco recomendado: etapa 2, começando por outbox e autenticação, preparando o isolamento para a etapa 3 de licenciamento. Licença individual e teste de 7 dias são requisitos do MVP pago, assim como o onboarding e os diferenciais marcados MVP. Preserve as validações e os testes de retry. Não separe API e worker enquanto as sessões estiverem somente no Map em memória. Cada mudança deve indicar comportamento, teste realizado e pendências restantes.

## Referências técnicas

- Baileys e sua natureza de integração: https://github.com/WhiskeySockets/Baileys
- Semântica das tentativas BullMQ: https://docs.bullmq.io/guide/retrying-failing-jobs
- Advisory retornado pelo npm audit: https://github.com/advisories/GHSA-ggr8-5vv4-36mx
- Serviços, recursos e volumes no Easypanel: https://easypanel.io/docs/services/app
- Requisitos de instalação do Easypanel (não representam capacidade da aplicação): https://easypanel.io/docs
- Configuração Redis/BullMQ: https://docs.bullmq.io/guide/connections
- Política de mensagens WhatsApp Business: https://whatsappbusiness.com/policy/
