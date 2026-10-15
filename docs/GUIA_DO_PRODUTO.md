# Em Pauta — guia do aplicativo e próximos passos

Atualizado em 15/10/2026. Estado: **homologação funcional, disponível para piloto controlado**. Público: jornalistas e responsáveis por sites e portais de notícias.

## 1. Links de acesso

| Acesso | Link |
| --- | --- |
| Painel no navegador | [Abrir Em Pauta](https://whatsapp-homologacao-disparador.ngof2y.easypanel.host/) |
| APK Android 0.1.0 | [Baixar em-pauta-homologacao.apk](https://github.com/samuelgogasi/whatsapp-disparador/releases/download/android-homologacao-v0.1.0/em-pauta-homologacao.apk) |
| Informações da versão Android | [Release no GitHub](https://github.com/samuelgogasi/whatsapp-disparador/releases/tag/android-homologacao-v0.1.0) |
| Instalação no iPhone/iPad | [Guia para instalar pelo Safari](https://whatsapp-homologacao-disparador.ngof2y.easypanel.host/install.html) |
| Administração — somente proprietário | [Abrir painel administrativo](https://whatsapp-homologacao-disparador.ngof2y.easypanel.host/admin.html) |
| Código e documentação | [Repositório GitHub](https://github.com/samuelgogasi/whatsapp-disparador) |

O download do APK, a página de instalação e a disponibilidade do serviço foram verificados nesta atualização e responderam HTTP 200. Compartilhe o link do GitHub acima, não o endereço temporário `release-assets.githubusercontent.com` gerado após o download.

## 2. Android: instalação e atualização

1. No Android 8 ou posterior, abra o link **Baixar APK**.
2. Abra o arquivo baixado. Se o Android solicitar, permita a instalação por esse navegador ou gerenciador de arquivos. Essa autorização pode ser desativada após instalar.
3. Conclua a instalação e abra **Em Pauta**.
4. Crie uma conta ou entre com seu e-mail e senha.

O APK tem aproximadamente 2,25 MB (2.249.043 bytes). É uma versão de homologação assinada com chave de depuração, destinada aos testes; ainda não é uma distribuição de produção nem está publicado na Play Store. O proprietário relatou instalação e funcionamento bem-sucedidos em Android real.

O aplicativo abre o painel hospedado na VPS. Melhorias nas telas e no backend chegam ao reabrir/recarregar o painel; não exigem recompilar o APK. Alterações no aplicativo nativo exigirão uma nova versão instalada. Não há atualizador automático de APK implementado.

Checksum SHA-256 da versão 0.1.0:

```text
ebab3d462d234774b99d584fdb747ece5ebd597d0812e17fd11e99c761be2fe0
```

## 3. iPhone e iPad: instalação como PWA

1. Abra o painel ou o guia de instalação no **Safari**. Se o link abrir dentro do WhatsApp, copie e cole no Safari.
2. Toque em **Compartilhar** e escolha **Adicionar à Tela de Início**.
3. Se aparecer **Abrir como App da Web**, mantenha ativado e confirme em **Adicionar**.
4. Abra o ícone **Em Pauta** e faça login. Pode ser necessário entrar novamente mesmo que já tenha entrado pelo Safari.

O PWA possui nome, ícone e abertura como aplicativo. Não há pacote APK para iPhone, nem aplicativo publicado na App Store. O primeiro teste completo em iPhone real ainda não foi confirmado pelo proprietário.

O painel exige internet. A tela de indisponibilidade não cria campanhas, não confirma envios e não repete operações. O cache do service worker guarda apenas a página pública de indisponibilidade, seu estilo e um ícone; não guarda respostas da API, dados da conta ou informações administrativas.

## 4. Primeira divulgação

1. **Crie sua conta:** informe nome ou portal, e-mail e senha.
2. **Ative o teste:** abra **Licença e Pix → Ativar meus 7 dias grátis**. O cadastro sozinho não inicia a contagem. O benefício dura 168 horas corridas e pode ser ativado uma vez por conta; não exige cartão e não gera cobrança automática.
3. **Conecte o WhatsApp:** na área **WhatsApp**, solicite o código de vinculação com o número completo, incluindo país e DDD. No WhatsApp, entre em **Aparelhos conectados** e use a opção de vincular pelo número de telefone. O código não é SMS. QR Code é alternativa, normalmente com outra tela disponível.
4. **Carregue os grupos** na área WhatsApp.
5. **Prepare a matéria:** em **Nova divulgação**, escreva o texto e o link, selecione os grupos e confirme que os destinos autorizam essa divulgação.
6. **Envie ou agende:** escolha envio imediato ou data e horário de início em Brasília. O agendamento exige pelo menos um minuto de antecedência.
7. **Acompanhe:** consulte o histórico e os resultados por grupo. O horário agendado é de início previsto; a conclusão depende do volume, da conexão e da capacidade disponível.

Depois que a campanha for aceita pelo servidor, os envios continuam na VPS com o aplicativo fechado. A VPS deve estar disponível, a licença vigente e o WhatsApp conectado. Uma mensagem preparada no celular, mas ainda não aceita pelo servidor, não está agendada.

## 5. O que está funcionando

| Funcionalidade | Estado atual |
| --- | --- |
| Cadastro, login e sessão protegida | Implementado |
| Teste grátis de sete dias | Implementado, com destaque no cadastro e orientação inicial |
| Licença mensal por chave vinculada à conta | Implementado |
| Pix e envio de comprovante | Fluxo manual; dados do responsável precisam estar configurados |
| Administração | Consulta clientes/licenças/pagamentos, emissão, revogação e reemissão de chaves |
| Conexão por código e QR Code | Implementado |
| Divulgação de texto e link em grupos | Implementado |
| Agendamento pontual | Implementado, com horário de Brasília |
| Histórico e resultados por grupo | Implementado; não equivale a comprovante de leitura ou clique |
| Cancelamento de pendentes | Implementado; uma transmissão em andamento ainda pode concluir |
| Prevenção de campanha repetida | Bloqueia repetição do mesmo conteúdo/destinos/agenda por dez minutos |
| Campanhas ativas | Até duas por conta na configuração atual |
| Coordenação independente por conta | Publicada; até três contas transmitindo simultaneamente |
| Android | APK disponível; teste físico relatado como bem-sucedido pelo proprietário |
| iPhone/iPad | PWA publicado; validação completa em aparelho real pendente |

Contatos individuais, campanhas mistas, anexos pela interface, recorrência, edição de campanhas, importação de notícias e métricas de cliques não estão incluídos como funcionalidades prontas.

## 6. Como os envios são distribuídos

- Disponível **24 horas por dia**, inclusive de madrugada. Não existe bloqueio por horário comercial.
- Cada conta possui seu próprio ritmo: **dez segundos entre transmissões e pausa adicional de sessenta segundos a cada trinta transmissões**.
- O contador pertence à conta e vale entre campanhas; criar outra campanha não reinicia a pausa.
- Até três contas podem transmitir simultaneamente. Enquanto uma aguarda o intervalo, outras podem avançar.
- O Redis mantém uma tarefa de coordenação por conta; os destinos são carregados do banco um por vez.
- O estado dos intervalos é persistido. Uma entrega interrompida ou sem confirmação pode pausar a campanha para revisão, sem reenvio automático daquela entrega incerta.

Uma divulgação para 500 grupos representa **500 entregas**. O tempo de referência é da ordem de 1h40, mais comunicação e espera efetiva; não é prazo garantido. A nova fila evita que uma conta monopolize a espera das demais, mas não garante capacidade ilimitada.

A integração atual utiliza Baileys, fora da API oficial da Meta. Enviar apenas para destinos autorizados é obrigatório no fluxo. Intervalos e controles de repetição não garantem ausência de restrições ou bloqueios pelo WhatsApp. O produto não deve ser anunciado como “antiban”.

## 7. Mensalidade e operação do proprietário

O preço ainda não foi fechado. **R$ 49,90/mês para o piloto é uma proposta**, não uma oferta publicada ou aprovada. O sistema ainda não contabiliza franquia mensal de entregas. Consulte [precificação e regras comerciais](PRECIFICACAO_E_REGRAS.md) antes de anunciar planos.

Fluxo operacional de renovação:

1. Informar ao cliente o preço vigente e a chave Pix pessoal do responsável.
2. Receber o comprovante pelo WhatsApp e conferir o crédito efetivo na conta.
3. No painel administrativo, selecionar a conta correta, registrar referência única e valor do pagamento e emitir a chave mensal.
4. Enviar a chave ao cliente; ele a ativa em **Licença e Pix**.
5. Consultar a validade exibida. Nunca compartilhar o token administrativo com clientes.

A mensalidade corresponde a um mês de calendário. O prazo é calculado na emissão da chave; ativar depois não reinicia a validade. Renovação antecipada preserva o prazo mensal ainda pago. Reemissão de chave perdida preserva o vencimento e invalida a chave anterior. Ao vencer, novos envios ficam bloqueados. Campanhas pausadas por licença exigem revisão dos pendentes; não retomam automaticamente após renovar.

## 8. Hospedagem e evidências

Projeto próprio no Easypanel: `whatsapp-homologacao/disparador`, na VPS HostGator de 4 GB / 2 vCPUs. Os serviços da UNASP não foram alterados.

| Componente | Teto de memória | Teto de CPU |
| --- | --- | --- |
| Aplicativo | 1.536 MiB, aproximadamente 1,5 GB | 1 vCPU |
| PostgreSQL do disparador | 384 MiB | 0,3 CPU |
| Redis do disparador | 128 MiB | 0,2 CPU |

São limites máximos, não consumo permanente. O aplicativo adia novos trabalhos se seu RSS exceder 1.280 MiB. Manter somente uma réplica enquanto as sessões WhatsApp dependerem do processo local.

Verificações concluídas:

- 54 testes automatizados aprovados e compilação TypeScript concluída.
- Simulação com relógio controlado: dez contas × 500 destinos, total de 5.000 entregas fictícias.
- Integração na VPS com Redis e PostgreSQL reais, schema/fila exclusivos e remetente falso: dez contas, quarenta entregas fictícias, concorrência máxima três, reinício gracioso do worker e zero duplicatas.
- Nenhuma mensagem real enviada nos testes automatizados desta entrega.
- Limites de memória/CPU conferidos no contêiner; painel e portal UNASP disponíveis após publicar.

Esses testes não comprovam suporte a dez WhatsApps reais enviando 2.000–2.500 mensagens diárias cada. Esse cenário depende do piloto com sessões reais. Mais detalhes em [filas por conta](FILAS_POR_CONTA.md).

## 9. Próximas etapas, por prioridade

| Prioridade | Entrega pendente | Critério para concluir |
| --- | --- | --- |
| 1 — Piloto | Validar iPhone real | Instalar pelo Safari, entrar, parear, copiar código, agendar e reabrir o app após alternar para WhatsApp |
| 1 — Piloto | Testar 3, depois 5 e 10 contas reais autorizadas | Medir fila, duração, memória/CPU, reconexões e falhas durante a rotina de publicação; confirmar ausência de impacto na UNASP |
| 1 — Operação | Backups e restauração | Backup protegido de banco/sessões e exercício de recuperação concluído |
| 1 — Operação | Monitoramento e alertas | Detectar indisponibilidade, fila parada, aumento de erros e pressão de memória |
| 2 — Comercial | Definir preço, franquia e política de uso | Oferta aprovada; contador/reserva de consumo no servidor, aviso e bloqueio no limite implementados |
| 2 — Comercial | Conferir configuração de Pix e WhatsApp do responsável | Fluxo completo testado: dados corretos, pagamento conferido, emissão e ativação de chave |
| 2 — Conta | Recuperação de senha e verificação de e-mail | Fluxos completos e testados, com limitação de tentativas |
| 2 — Lançamento | Termos, privacidade, suporte e cancelamento | Documentos e canais definidos para o produto efetivamente oferecido |
| 2 — Lançamento | APK de produção | Assinatura de produção protegida, identidade/versão definidas e processo de atualização documentado |
| 2 — Lançamento | Ambiente de produção | Domínio e configuração próprios, procedimento de publicação/retorno e separação clara da homologação |
| 3 — Diferenciais | Listas salvas por editoria/região e modelos de chamadas | Cliente reutiliza públicos e mensagens sem selecionar tudo novamente |
| 3 — Diferenciais | Calendário editorial e importação assistida de RSS | Conteúdo revisado pelo jornalista antes da criação de campanha |
| 3 — Expansão | Contatos individuais, mídia e recorrência | Cada modalidade implementada e testada, com autorização e limites adequados |

Não lançar promessa de volume elevado ou “ilimitado” antes de medir a capacidade e implementar limites comerciais. O passo imediato é o piloto gradual; a base técnica está publicada para esse teste.

## 10. Documentação complementar

- [Android e compilação do APK](ANDROID.md)
- [Instalação e experiência móvel](MOBILE.md)
- [Filas, persistência e recursos](FILAS_POR_CONTA.md)
- [Licenças e Pix](LICENCAS_E_PIX.md)
- [Agendamento](AGENDAMENTO.md)
- [Precificação e regras comerciais](PRECIFICACAO_E_REGRAS.md)
- [Histórico de homologação](HOMOLOGACAO.md)
- [Plano de desenvolvimento](../PLANO_DESENVOLVIMENTO.md)

Este guia consolida o estado atual. Documentos antigos mantêm registros datados de etapas que já foram concluídas; use a data e as atualizações posteriores para interpretar as pendências históricas.
