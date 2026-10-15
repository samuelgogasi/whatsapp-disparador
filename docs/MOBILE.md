# Uso em Android e iPhone

## Atualização de 15/10/2026 — iPhone

PWA implementado: manifest, ícones PNG (incluindo apple-touch-icon), abertura standalone e guia em `/install.html`. O usuário confirmou que o APK Android funcionou no aparelho. A instalação e o uso em iPhone real ainda aguardam validação.

No Safari, abra o endereço HTTPS da homologação, toque em Compartilhar → Adicionar à Tela de Início e mantenha “Abrir como App da Web” ativado, se a opção aparecer. Abra o ícone e faça login.

O service worker armazena somente offline.html, offline.css e o ícone público de indisponibilidade. Não armazena painel, APIs, dados da conta ou administração; não há fila local, sincronização em segundo plano ou reenvio offline. JavaScript/CSS do painel e navegações usam a rede; alterações chegam ao abrir novamente. Workers novos aguardam o fechamento das telas antigas, sem recarregar formulários automaticamente. Envios aceitos permanecem na VPS.

Validação técnica: testes do worker para cache restrito, APIs/admin não interceptados, fallback offline e dimensões dos ícones; testes existentes e build TypeScript. Teste físico pendente: instalar pelo Safari, entrar, parear por código, copiar/colar, agendar, alternar para WhatsApp e reabrir o ícone.

### Registro anterior

Revisão: 14/10/2026.

## Estado atual

O painel é web e já tinha regras responsivas para reorganizar as colunas. A revisão encontrou largura excedente na simulação de 390 px (conteúdo de 476 px), campos com fonte de 13 px e menu horizontal extenso.

Correções aplicadas nesta revisão:

- Contenção da largura de painéis, cards e fieldsets, sem rolagem horizontal da página nas telas verificadas.
- Menu móvel recolhível, com estado anunciado por aria-expanded e fechamento após escolher uma seção.
- Campos com fonte de 16 px e botões/labels de seleção com área de toque de pelo menos 44 px de altura no CSS móvel.
- Ações principais ocupando a largura disponível e formulários organizados verticalmente.
- Espaçamento para áreas seguras da tela e altura dinâmica do viewport.

Verificação no navegador de desenvolvimento: larguras de 320, 390 e 430 px; visão geral, abertura/fechamento do menu, formulário de divulgação e campo de agendamento. Sem exceder a largura da página nas medições feitas. Isso é simulação de viewport, não execução em Android ou iOS reais.

## Caminho recomendado: responsivo e PWA

Manter um único painel responsivo e prepará-lo como PWA, com instalação na tela inicial. O mesmo backend e o mesmo controle de licença atendem celular e computador.

Uma PWA instalável precisa de configuração própria, como manifest, nome/ícones, modo de exibição e publicação HTTPS. A implementação foi concluída em 15/10/2026, conforme a atualização acima; a validação em iPhone físico permanece pendente.

No iPhone, o Safari permite adicionar a aplicação web à tela inicial. Android também possui mecanismos de instalação de aplicações web em navegadores compatíveis. O fluxo de instalação varia conforme navegador/versão, então o painel deve mostrar orientação adequada ao dispositivo, sem prometer um botão universal.

APK é um pacote Android; não atende iPhone. O [APK Android de homologação](ANDROID.md) foi criado mantendo os envios na VPS. O usuário confirmou funcionamento em Android físico em 15/10/2026. Criar APK por si só não corrige o layout nem o funcionamento do sistema.

## Etapas para uma experiência móvel completa

- [x] Corrigir largura excedente e adaptar navegação/controles de toque.
- [ ] Testar Chrome Android e Safari iPhone em aparelhos reais: teclado aberto, rotação, agenda, copiar chave, retorno do WhatsApp e sessão expirada.
- [ ] Testar mensagens/grupos longos, erros, histórico preenchido e administração com dados reais de homologação.
- [ ] Implementar manifest, ícones de instalação, metadados e orientação para instalar no Android/iPhone.
- [ ] Definir estratégia de cache/atualização/offline antes de implementar service worker. Não guardar respostas autenticadas, QR, chaves, comprovantes ou dados pessoais no cache da aplicação.
- [ ] Publicar em domínio HTTPS e validar instalação/atualização como aplicativo web em dispositivos reais.
- [x] Implementar pareamento por código para conectar usando o mesmo celular; QR mantido como alternativa.
- [ ] Validar o pareamento real em Android/iPhone. APK Android já foi compilado; instalação PWA iOS continua pendente. Veja [APK/PWA e pareamento](APK_PWA_E_PAREAMENTO.md).

## Execução dos envios

O celular é a interface. Os jobs e agendamentos pertencem ao backend/fila no servidor; não devem depender de manter o navegador do celular aberto. Para a execução, servidor/worker/Redis devem estar ativos, WhatsApp conectado e licença vigente. PWA não significa envio offline nem funcionamento sem a infraestrutura.

## Fontes

- [Instalação de PWA e requisitos](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
- [Aplicação web na tela inicial do iPhone](https://support.apple.com/en-ie/guide/iphone/iphea86e5236/27/ios/27).
- [Pacotes e distribuição Android](https://developer.android.com/guide/app-bundle).
