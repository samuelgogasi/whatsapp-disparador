# Agendamento e painel operacional

Entrega de 09/10/2026: menu lateral, visão geral, nova divulgação, agendamentos, histórico, WhatsApp e licença/Pix. O agendamento desta versão é pontual, para campanhas de texto/link destinadas a grupos.

## Uso no painel

1. Entrar na conta, manter a licença ativa e conectar o WhatsApp.
2. Carregar os grupos na seção WhatsApp.
3. Abrir Nova divulgação, preparar a mensagem e selecionar os grupos.
4. Escolher Enviar agora ou Agendar data e horário.
5. Para agendar, escolher o início em horário de Brasília (UTC−3) e confirmar a prévia da data/destinos.
6. Acompanhar em Agendamentos e Histórico.

O início deve estar pelo menos um minuto à frente e no máximo 366 dias no futuro. O campo considera Brasília mesmo se o computador estiver em outro fuso. A API recebe uma data ISO com fuso explícito e o banco armazena o instante em UTC.

## API e fila

`POST /api/campaigns`, autenticado:

```json
{
  "text": "Título da matéria\nhttps://seuportal.com/materia",
  "groupJids": ["123@g.us"],
  "scheduledAt": "2026-10-10T12:00:00-03:00"
}
```

O exemplo representa 12h em Brasília em 10/10/2026; deve ser substituído por uma data futura ao testar. Sem scheduledAt, o envio é imediato. Com a data, a campanha inicia como SCHEDULED e os jobs recebem delay até o instante previsto. O atraso é calculado depois da persistência, sem acrescentar o tempo gasto no banco ao horário escolhido.

Quando o worker inicia o processamento, a campanha passa a PROCESSING. O início previsto não é garantia de envio simultâneo ou conclusão no mesmo minuto: fila, intervalos configurados, pausas por lote e quantidade de grupos influenciam a execução. Essa característica corresponde à semântica dos [jobs adiados do BullMQ](https://docs.bullmq.io/guide/jobs/delayed).

## Condições de execução

- O backend/worker e Redis precisam estar disponíveis. A fila pode atrasar com serviço parado ou ocupado.
- O WhatsApp precisa estar conectado; recuperação automática após reinício continua pendente.
- A licença é conferida na criação e novamente antes de enviar. Agendar uma campanha não estende sua validade. Se vencer, pendentes ficam bloqueados por licença.
- Agendamentos aceitos além da validade atual exigem renovação/ativação antes do envio. O painel informa a exigência; não ativa ou cobra automaticamente.
- Redis deve ter persistência configurada. Banco e fila ainda não possuem outbox comum, então recuperação de falha ao publicar jobs permanece pendente antes de venda pública.

## Pix pessoal

No painel, os dados do Pix pessoal e o botão para abrir WhatsApp ficam na área Licença e Pix. PIX_KEY e PAYMENT_WHATSAPP são configurados no ambiente; não foram inventados ou preenchidos nesta entrega. Os dados pessoais de pagamento exigem login em `/api/payment-info`; `/api/public` divulga somente os dias do teste.

O cliente paga no banco, abre o WhatsApp pelo link e anexa o comprovante. O proprietário confere o pagamento e entrega a chave mensal. Não há integração bancária nem envio automático de comprovante/chave.

## Validação

Compilação, schema Prisma e 29 testes passaram, incluindo cálculo do delay, conversão Brasília/UTC, rejeição de datas inválidas/passadas, envio imediato, contrato HTTP e proteção dos dados de Pix. Os testes usam banco/fila/WhatsApp substituídos; não verificam execução temporal em Redis real.

A migration `20261009000000_campaign_scheduling` acrescenta SCHEDULED e scheduledAt. Foi escrita e o schema validado, mas a migration ainda não foi aplicada a PostgreSQL real neste ambiente. Aplicar junto das anteriores em homologação e testar o ciclo completo antes de implantar.

Recorrência diária/semanal, edição, cancelamento, contatos individuais, grupos+contatos e calendário visual ainda não foram implementados.

## Prévia

`npm run preview` em backend mantém uma prévia local, sem operações reais. `/` mostra o login; `/preview.html` permite navegar pelas áreas com identificação explícita de prévia e dados vazios. Não cria conta, chave, campanha ou pagamento e não envia mensagens.
