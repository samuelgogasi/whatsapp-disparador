# WhatsApp Disparador

Sistema em desenvolvimento para jornalistas e donos de sites/portais divulgarem matérias em grupos de WhatsApp e para contatos individuais. A versão inicial já tem painel do cliente, administração, cadastro/login, licença mensal com Pix conferido manualmente, teste de 7 dias e divulgação em grupos. Contatos individuais e funcionalidades adicionais de produção ainda serão implementados.

**Avaliação e etapas:** [PLANO_DESENVOLVIMENTO.md](PLANO_DESENVOLVIMENTO.md).

O painel se adapta a celular com menu recolhível e controles de toque. A revisão foi feita em larguras simuladas; ainda não há PWA/APK nem validação em aparelhos reais. Veja [uso móvel e próximas etapas](docs/MOBILE.md).

Conexão por código implementada no painel/API, com QR alternativo, ainda sem vínculo real de homologação. A distribuição solicitada será APK no Android e PWA no iPhone; [plano móvel e pareamento](docs/APK_PWA_E_PAREAMENTO.md).

Cada confirmação de Pix gera uma nova chave exclusiva do usuário para um mês de calendário. O cliente ativa a chave na própria conta. Veja [licenças e operação do Pix](docs/LICENCAS_E_PIX.md). O painel tem navegação por áreas e agendamento pontual de mensagens para grupos, descritos em [agendamento](docs/AGENDAMENTO.md). Públicos salvos, modelos de boletim, alertas de repetição e calendário editorial continuam planejados.

Infraestrutura do piloto: VPS HostGator existente com Easypanel, no projeto separado `whatsapp-homologacao`. Os containers ainda não foram iniciados. Veja a [avaliação de impacto e isolamento](docs/HOMOLOGACAO.md) antes da implantação.

## Execução local

Requisitos: Node.js 22 ou 24 e Docker com Compose. Na raiz do projeto, no PowerShell:

```powershell
docker compose up -d --wait
Set-Location backend
npm ci
npm run setup:admin
npm run prisma:generate
npm run prisma:deploy
npm run dev
```

`setup:admin` cria `.env` se necessário e preserva token já configurado. Acesse `http://localhost:3333` para o cliente e `/admin.html` para a administração. O token do proprietário fica em `ADMIN_API_TOKEN` no `.env`; nunca entregue esse token aos clientes. As credenciais do Compose são apenas para desenvolvimento local. Para banco existente, leia o procedimento de migrations na documentação antes de aplicar.

Para uma prévia apenas visual, sem banco, pagamentos ou envios: execute `npm run preview` dentro de `backend` e abra `http://127.0.0.1:3334`. O link “Visualizar o painel sem operações” abre as áreas do sistema com dados vazios e identificação de prévia.

## Verificação

Dentro de `backend`:

```powershell
npm run prisma:generate
npm run build
npm test
```

Veja [backend/README.md](backend/README.md) para os endpoints. O worker roda no mesmo processo da API, pois as sessões Baileys ficam em memória. Não execute múltiplas instâncias ou mova o worker para outro processo antes de implementar coordenação de sessões.

## Colaboração entre IDEs

O código foi publicado na branch `main` de https://github.com/samuelgogasi/whatsapp-disparador.git. Antes de trabalhar em outra IDE, sincronize o checkout e revise `git diff` e `git status` para preservar alterações locais.

Trabalhando no mesmo diretório, as IDEs enxergam as mesmas alterações: combine quais arquivos cada uma altera. Para tarefas simultâneas com mudanças sobrepostas, use branches em checkouts separados ou worktrees. Nunca envie `.env` ou `.sessions` ao GitHub.
