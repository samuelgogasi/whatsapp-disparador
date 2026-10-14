# Licenças mensais e Pix manual

Implementação inicial em 08/10/2026. Pagamentos são conferidos pelo proprietário fora do sistema. Não há gateway, cobrança automática ou análise automática de comprovante.

## Fluxo do cliente

1. Criar conta com nome, e-mail e senha no painel `/`.
2. Ativar explicitamente o teste de 7 dias, se desejar. O prazo é de 168 horas no relógio do servidor, uma vez por conta.
3. Após o teste, fazer o Pix da mensalidade acordada e enviar o comprovante ao proprietário pelo WhatsApp. Os dados de contato e Pix aparecem se configurados no ambiente.
4. Receber a chave emitida após conferência e informá-la no painel da própria conta.
5. Acessar o WhatsApp e criar divulgações até a validade indicada.

Login e licença são separados: o login continua disponível depois do vencimento para consultar histórico e informar uma nova chave. Uma chave de outro usuário não ativa sua conta. E-mails ainda não são verificados; a proteção contra múltiplas contas de teste é uma pendência, além do bloqueio de repetição na mesma conta já implementado.

## Fluxo do proprietário

1. Abrir `/admin.html` e entrar com `ADMIN_API_TOKEN` do ambiente. Esse token é exclusivo do administrador; nunca entregue aos clientes.
2. Selecionar a conta cadastrada do cliente e confirmar nome, e-mail e ID.
3. Conferir o crédito do Pix no banco. A imagem de um comprovante sozinha não é validação automática do pagamento.
4. Informar referência única da transação (preferencialmente o identificador do Pix), valor recebido e marcar a confirmação.
5. Gerar a licença e copiar a chave apresentada. Entregá-la ao cliente fora do sistema; esta implementação não envia mensagens por conta própria.

O backend armazena hash da chave, prefixo, validade e histórico do pagamento. A chave completa só aparece na emissão. A referência é normalizada e única globalmente; repeti-la retorna conflito e não renova novamente.

Se perder a chave ou a resposta da emissão, usar **Reemitir chave perdida sem renovar**. Essa ação mantém a validade vigente, não gera novo pagamento e invalida a chave anterior. Licenças vencidas/revogadas precisam de nova liberação; reemissão não estende o prazo.

## Validade mensal

- Um Pix confirmado libera um mês de calendário em UTC, preservando a hora. Um mês iniciado em 31/01 termina no último dia de fevereiro.
- Sem licença mensal vigente, o período começa na confirmação administrativa, não no envio do comprovante ou na ativação posterior pelo cliente.
- Renovação antes do vencimento acrescenta um mês ao período mensal ainda válido.
- Cada liberação gera uma nova chave aleatória e revoga a anterior. O cliente precisa ativar a nova chave.
- Conversão de teste para mensal começa na confirmação; o saldo do teste não é somado ao mês.
- Revogação administrativa interrompe novos envios; não apaga histórico nem desfaz mensagens já enviadas.

## Campanhas e vencimento

A API exige licença ativa para conectar, acessar QR/grupos e criar campanhas. O worker confere novamente antes do envio, incluindo depois das esperas de digitação. Se não houver acesso, os pendentes da campanha ficam `BLOQUEADO_LICENCA` e a campanha `PAUSED_LICENSE`. Não há retry automático para esse bloqueio.

Uma nova licença não retoma esses envios. Nesta versão, o operador deve revisar os destinos bloqueados e criar outra campanha somente para eles. Retomada seletiva em um clique é uma etapa futura. Uma mensagem que já entrou em envio não pode ser desfeita por revogação simultânea.

## Configuração local

Com PostgreSQL e Redis disponíveis, dentro de `backend`:

```powershell
npm ci
npm run setup:admin
npm run prisma:generate
npm run prisma:deploy
npm run dev
```

`setup:admin` cria `.env` a partir do exemplo quando necessário, gera o token sem imprimi-lo e preserva token já configurado. Abra o arquivo localmente para obter o token. Configure `DATABASE_URL` e `REDIS_URL` reais antes de iniciar.

Campos opcionais em `.env`:

```dotenv
PAYMENT_WHATSAPP=5511999999999
PIX_KEY=sua-chave-pix
```

Em produção, configure `PUBLIC_URL=https://seu-dominio.com`, `HOST=0.0.0.0` dentro do container e o token administrativo como segredo no Easypanel. Cookies de login serão HttpOnly, SameSite=Strict e Secure quando o domínio for HTTPS. Não há recuperação de senha ou segundo fator administrativo nesta versão.

Para observar somente a apresentação, sem banco ou envios: `npm run preview`, em `http://127.0.0.1:3334`. `/` mostra o login e `/preview.html` abre o painel com dados vazios, identificado como prévia. Operações de cadastro, licença e envio retornam erro; não há simulação de pagamento.

## Migrations

Há uma migration inicial para o esquema anterior e uma incremental para contas, licenças, pagamentos e sessões autenticadas. O índice parcial garante uma chave corrente por conta; transações usam bloqueio da linha do usuário para serializar teste/emissão/rotação/revogação.

Em um banco vazio, `npm run prisma:deploy` aplica as duas. Se outro ambiente já possui tabelas ou migrations do protótipo, fazer backup e comparar o esquema/histórico antes de aplicar. Quando o esquema existente corresponder exatamente à migration inicial e ainda não tiver histórico próprio, marcar a inicial com `prisma migrate resolve --applied 20261002000000_initial`, depois aplicar a incremental. Não executar esse baseline sem conferir correspondência.

## Verificação e limites da entrega

Testes cobrem regras de mês/expiração, teste único, chave vinculada, duplicação do Pix, reemissão, isolamento de campanhas/sessões, administração, origem das requisições e bloqueio no processador. Testes da regra de licença usam repositório em memória; testes HTTP usam dependências substituídas. O bloqueio SQL/concor­rência real e aplicação das migrations ainda precisam ser validados contra PostgreSQL.

Atualização de 09/10/2026: o painel passou a organizar áreas por menu lateral e suporta agendamento pontual. Os dados de Pix/WhatsApp são consultados em `/api/payment-info`, que exige login; a rota pública não retorna a chave pessoal. Veja [agendamento](AGENDAMENTO.md).

Ainda pendentes antes de venda pública: teste integrado com banco/Redis/WhatsApp, outbox e recuperação da fila, sessões recuperáveis, proteção completa de mídia, verificação de e-mail, recuperação de senha, quotas e auditoria de dependências. O backend e o painel desta versão divulgam somente em grupos; contatos individuais estão sinalizados como em desenvolvimento. Nenhuma implantação foi executada na VPS.
