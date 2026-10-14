# Backend · Portal em Pauta (nome provisório)

Versão inicial para jornalistas e portais: Express/TypeScript, Baileys, BullMQ/Redis e PostgreSQL/Prisma. Inclui painel do cliente e administração, cadastro/login, teste grátis e chave mensal após Pix confirmado manualmente.

Leia o [README da raiz](../README.md) e a [operação de licenças/Pix](../docs/LICENCAS_E_PIX.md).

## Rodar localmente

Requisitos: Node.js 22 ou 24, PostgreSQL e Redis. Para subir os dois serviços, execute `docker compose up -d --wait` na raiz. Dentro do backend:

```powershell
npm ci
npm run setup:admin
npm run prisma:generate
npm run prisma:deploy
npm run dev
```

Confira DATABASE_URL/REDIS_URL em `.env`. `setup:admin` gera ADMIN_API_TOKEN e preserva token existente. Acesse `http://localhost:3333` e `http://localhost:3333/admin.html`. Nunca entregue o token administrativo ao cliente: a chave do cliente é emitida pelo painel.

Em banco já existente, leia o procedimento de migrations na documentação antes de executar deploy. A prévia `npm run preview` em `127.0.0.1:3334` serve somente as telas, sem cadastro, pagamento ou envio.

## API de conta e licença

| Método | Endpoint | Uso |
| --- | --- | --- |
| POST | `/api/auth/register` | `{ name, email, password }`, cria conta e cookie de login |
| POST | `/api/auth/login` | `{ email, password }`, cria cookie de login |
| POST | `/api/auth/logout` | `{}`, encerra sessão |
| GET | `/api/me` | Dados públicos da própria conta e licença, sem segredo da chave |
| POST | `/api/license/trial` | `{}`, ativa uma vez os 7 dias grátis |
| POST | `/api/license/activate` | `{ key }`, ativa a chave vinculada ao titular |
| GET | `/api/public` | Dias de teste disponíveis, sem dados pessoais de Pix |
| GET | `/api/payment-info` | Pix pessoal/WhatsApp do responsável, exigindo login |

Senhas: 10–128 caracteres. Sessões: 12 horas, token armazenado por hash e cookie HttpOnly/SameSite=Strict. Em produção, PUBLIC_URL deve ser HTTPS, ativando cookie Secure. Operações de escrita exigem JSON; origens externas são rejeitadas. Não há verificação de e-mail ou recuperação de senha nesta versão.

## Administração

Use `Authorization: Bearer <ADMIN_API_TOKEN>`; o cookie de cliente não dá permissão administrativa.

| Método | Endpoint | Uso |
| --- | --- | --- |
| GET | `/api/admin/users` | Últimos 100 usuários e estado das licenças, sem hashes/senhas |
| POST | `/api/admin/users/:userId/monthly-license` | `{ reference, amountCents, confirmed: true }`, confirma Pix já conferido e emite chave mensal |
| POST | `/api/admin/users/:userId/rotate-license` | `{}`, reemite chave sem renovar a validade vigente |
| POST | `/api/admin/users/:userId/revoke-license` | `{}`, revoga acesso |

A referência única do Pix é normalizada; repetição retorna 409 e não acrescenta prazo. A chave completa aparece apenas na emissão/reemissão e pertence à conta indicada. O administrador confirma o crédito fora do sistema; enviar comprovante não libera acesso automaticamente. Validade mensal usa mês de calendário em UTC, limitada ao último dia do mês quando necessário.

## WhatsApp e campanhas

Todas as rotas exigem login. userId deve corresponder à própria conta. Conexão/QR/grupos e criação de campanhas exigem licença ativa.

| Método | Endpoint | Uso |
| --- | --- | --- |
| POST | `/api/sessions/:userId/connect` | Inicia conexão |
| POST | `/api/sessions/:userId/pairing-code` | `{ phoneNumber }`, solicita código para vincular no próprio celular |
| GET | `/api/sessions/:userId/status` | Estado da própria sessão |
| GET | `/api/sessions/:userId/qr` | QR em Data URL quando disponível |
| GET | `/api/sessions/:userId/groups` | Grupos disponíveis |
| POST | `/api/campaigns` | Cria campanha para grupos da própria sessão |
| GET | `/api/campaigns` | Últimas 50 campanhas do usuário autenticado |
| GET | `/api/campaigns/:id/logs` | Resultados da própria campanha |

Exemplo de criação (com cookie de login válido):

```json
{
  "text": "Título da matéria\nLeia no nosso portal: https://seuportal.com/materia",
  "groupJids": ["1234567890-123456@g.us"]
}
```

O usuário é obtido do login; não é necessário enviar userId. Aceita 1–1000 grupos únicos, texto não vazio e mídia opcional na API com mediaUrl/mediaType juntos (`image`/`video`). O painel inicial oferece apenas texto/link. Proteção completa do download de mídia ainda é uma pendência antes de exposição pública.

Conexão por código: informe número com país e DDD (ex.: `+55 11 99999-9999`), copie o código e insira na opção de vinculação por número em Aparelhos conectados no WhatsApp. A API normaliza a formatação, exige titularidade/licença, reúne pedidos simultâneos e reaproveita o código por um minuto, sem prometer a validade do provedor. Sockets reais ainda precisam de homologação; a prévia não gera códigos. Veja [pareamento e distribuição móvel](../docs/APK_PWA_E_PAREAMENTO.md).

Para agendar, acrescente `scheduledAt` com data ISO e fuso explícito; o painel oferece data/hora de Brasília. A campanha inicia SCHEDULED e os jobs ficam adiados até o início previsto. Requer pelo menos um minuto de antecedência e permite até 366 dias. Veja [agendamento](../docs/AGENDAMENTO.md).

O worker verifica licença novamente antes de enviar. Ao vencer/revogar, pendentes ficam BLOQUEADO_LICENCA e a campanha PAUSED_LICENSE. Renovar não retoma automaticamente. Nesta versão, revise os destinos bloqueados e crie outra divulgação somente para eles.

API e worker ficam na mesma instância por causa das sessões em memória. Não habilite réplicas nem deployments com instâncias sobrepostas. Intervalos e presença de digitação não garantem ausência de bloqueio ou entrega. Contatos individuais, recorrência, edição/cancelamento de agendas, outbox e recuperação completa de sessões ainda serão implementados.

## Verificação

```powershell
npm run prisma:generate
npm run build
npm test
npx prisma validate
```

Testes de regras usam repositório em memória; testes HTTP substituem banco/fila/WhatsApp. PostgreSQL, Redis, migrations, imagem Docker e envios reais precisam de teste integrado antes da implantação. Nenhuma mensagem real é enviada pelos testes.
