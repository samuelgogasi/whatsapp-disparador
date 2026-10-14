# Android APK, iPhone PWA e conexão por código

Atualização: 14/10/2026.

## Modelo de distribuição

Proposta alinhada ao pedido: Android com APK e iPhone com aplicação web instalável (PWA), reutilizando o mesmo painel e backend. É viável sem duplicar regras de licença, Pix ou agendamento. APK/PWA ainda não foram construídos nesta entrega; o que foi implementado agora é o pareamento por código.

Capacitor é uma opção para reaproveitar os arquivos web em um projeto Android. O trabalho adicional inclui configurar ambiente Android, integração segura com o backend, assinatura, distribuição e atualização do aplicativo. Instalação direta de APK e distribuição pela Play Store são caminhos diferentes, com requisitos próprios a definir antes de publicar.

No projeto atual a autenticação usa cookies de mesma origem. Não basta copiar o HTML para um WebView local e apontar chamadas para outro domínio: precisamos definir origem da aplicação/API, autenticação no aplicativo, política de cookies/CORS e navegação para WhatsApp. Não enfraquecer essas proteções para fazer o empacotamento funcionar. O domínio de produção ainda precisa ser escolhido/configurado.

Para o iPhone, preparar manifest, ícones e instalação via Safari, com publicação HTTPS e teste real em dispositivos. Backend, fila e sessões WhatsApp ficam na VPS; o envio não pertence ao processo do APK ou navegador do celular.

## Implementação da conexão por código

- Formulário de número com país/DDD na seção WhatsApp; aceita a formatação comum e normaliza para dígitos.
- `POST /api/sessions/:userId/pairing-code` exige login, titularidade da sessão e licença ativa. A licença é reavaliada antes de devolver o resultado.
- Serviço usa `requestPairingCode` do Baileys instalado, aguardando a sessão sinalizar que está pronta (QR disponível).
- Pedidos simultâneos do mesmo usuário/número compartilham a solicitação. O resultado é reaproveitado por um minuto, para evitar geração repetida. Esse tempo é do cache local, não uma garantia da validade definida pelo WhatsApp.
- Esperas têm timeout. Fechamento de sessão e falhas de inicialização são tratados; sessão registrada reconecta sem solicitar novo vínculo.
- Código fica em memória e aparece somente na resposta para o titular. Não foi adicionado ao banco, aos logs ou ao status da sessão.
- Interface oferece exibição, cópia, instruções de Aparelhos conectados e atualização do estado ao voltar do WhatsApp. QR continua disponível como alternativa.

Fluxo: informar número → gerar/copiar código → abrir WhatsApp → Aparelhos conectados → Conectar aparelho → opção por número de telefone → inserir código → voltar ao painel → atualizar/carregar grupos. A nomenclatura exata das opções pode variar por versão. O código é de vinculação do dispositivo, não um SMS ou a chave mensal do sistema.

## Validação e pendências

Compilação TypeScript e 37 testes passaram. Novos testes cobrem normalização, espera da sessão, pedidos simultâneos, cache, sessão registrada/conectada, fechamento, falha de inicialização, timeout e autorização HTTP. Os sockets são substituídos nos testes; nenhuma conta real foi vinculada e nenhum número foi enviado ao WhatsApp para teste.

A prévia local mostra o formulário, mas não gera código real. Pareamento precisa ser testado com uma conta autorizada em Android e iPhone e com a infraestrutura real. A sessão ainda usa arquivos locais de autenticação como protótipo; armazenamento adequado de credenciais, recuperação completa, coordenação e backoff robusto continuam no plano antes de operação comercial.

## Próximas etapas

- [x] Implementar formulário/API de código, controle de solicitações e testes.
- [ ] Validar vínculo e retorno do WhatsApp em aparelhos reais, incluindo código recusado/expirado e conexão interrompida.
- [ ] Publicar backend/painel em homologação HTTPS e validar sessão/licença.
- [ ] Preparar PWA do iPhone e testar instalação, teclado, retorno do WhatsApp e atualização.
- [ ] Preparar projeto Android compartilhando o painel e definir autenticação/origens e abertura do WhatsApp.
- [ ] Configurar assinatura, gerar APK de teste e validar em Android real.
- [ ] Definir distribuição e atualização; depois emitir artefato de produção.

## Referências

- [Capacitor em aplicação web existente](https://capacitorjs.com/docs/getting-started).
- [Ambiente Android](https://capacitorjs.com/docs/getting-started/environment-setup).
- [Pareamento documentado pelo Baileys](https://github.com/WhiskeySockets/baileys.wiki-site/blob/main/docs/socket/connecting.md).
