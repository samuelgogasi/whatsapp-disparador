# Homologação na VPS existente

## Restrição de operação

Não alterar, reiniciar, parar, reimplantar ou reutilizar `unasp-db` e `unasp-portal`. O serviço `teste` também permanece sem alterações. Não alterar configurações globais, redes, volumes, credenciais ou rotas da UNASP para implantar este projeto.

## Estado verificado em 14/10/2026

O projeto `whatsapp-homologacao` e o serviço Compose `disparador` foram implantados separadamente, após autorização do proprietário. O repositório está na branch `main`, com arquivo `compose.homologacao.yaml`. O primeiro deploy usou o commit `fef103d` e terminou às 16:01 de 14/10/2026 (Brasília).

O aviso de interpolação foi resolvido ao salvar corretamente as variáveis no formulário. O domínio HTTPS foi direcionado para o serviço Compose `app`, porta `3333`. A aplicação abriu em https://whatsapp-homologacao-disparador.ngof2y.easypanel.host/ e `/ready` retornou HTTP 200 com banco e fila disponíveis. PostgreSQL e Redis passaram seus healthchecks no deploy.

O monitor mostrou CPU em 2%, RAM em 44,9% (1,6 GB de 3,6 GB) e disco em 17,3% (16,1 GB de 93,1 GB). Esses números são uma amostra, não uma medição de pico. Os identificadores dos containers da UNASP permaneciam iguais aos registrados antes da preparação:

- Portal: `unasp-portal_unasp-portal.1.i6f33ru7ndzxp0ozuhnevbtl7`
- Banco: `unasp-portal_unasp-db.1.wlkjih1g1qu7awwwego3fe8lj`
- phpMyAdmin: `unasp-portal_unasp-db_phpmyadmin.1.xgrf1cfht0ffpu44ddcoa4bnd`

Depois da implantação, esses identificadores continuaram iguais. Uma consulta HTTP à página inicial `https://unaspbrasil.org/` retornou 200. Não houve alterações ou reinícios nos serviços da UNASP. Esse teste de disponibilidade não mede latência histórica nem garante ausência de impacto futuro.

Durante o build, foram observadas amostras de CPU em 92,8% e depois 55,8%, com RAM perto de 47%. Após o deploy, a CPU estava em 3,1% e a RAM em 50,2% (1,8 GB de 3,6 GB). O disco passou para 18,2 GB de 93,1 GB. Os três containers novos somaram aproximadamente 338,5 MB de RAM, sem sessões WhatsApp conectadas: aplicação 135,3 MB, PostgreSQL 149,5 MB e Redis 53,6 MB. São amostras, não um benchmark ou pico máximo registrado.

## Isolamento e limites preparados

O Compose cria PostgreSQL, Redis e volumes exclusivos. Não referencia o MySQL da UNASP, redes externas ou volumes preexistentes. Não publica portas diretamente no host. As migrations apontam para `whatsapp_homologacao` no serviço `postgres` do próprio Compose.

| Container | Limite de RAM | Limite de CPU |
| --- | --- | --- |
| Aplicação | 512 MiB | 0,5 núcleo |
| PostgreSQL | 384 MiB | 0,3 núcleo |
| Redis | 128 MiB | 0,2 núcleo |
| Total | 1 GiB | 1 núcleo |

Esses são limites configurados, não estimativas de consumo ou reservas exclusivas. Sua aplicação precisa ser confirmada nos containers após o deploy. A soma aproximada da RAM usada hoje com o teto da homologação deixa cerca de 1 GB de margem; a contabilização do monitor e os limites Docker podem diferir.

Os projetos compartilham CPU, RAM, disco, rede, Docker, Easypanel e proxy. Portanto, existe risco de lentidão por disputa de recursos mesmo sem acesso ao banco ou aos arquivos da UNASP. Limites de execução não limitam o processo de montagem da imagem Docker. Preferir uma imagem montada fora da VPS antes da primeira implantação, para reduzir esse pico. Logs, imagens e volumes também podem crescer com o uso.

## Verificação antes e depois do piloto

1. Resolver a interpolação das variáveis somente no serviço novo; validar HTTPS e a rota interna da aplicação.
2. Montar a imagem fora da VPS ou verificar limites específicos do processo de build antes de executá-lo no servidor compartilhado.
3. Registrar recursos e disponibilidade HTTP da UNASP antes do deploy e comparar durante/depois, sem modificar seus serviços.
4. Conferir limites efetivos, migrations no banco novo, `/ready` e estabilidade dos três containers.
5. Testar cadastro, licença, pareamento e agendamento com poucos usuários e destinatários de teste acordados com o proprietário.
6. Se houver pressão persistente de recursos ou lentidão correlacionada, parar somente a homologação e investigar. Não reiniciar a UNASP para compensar consumo do piloto.

## Verificações realizadas e uso nos aparelhos

Depois da publicação, foi executada uma [simulação de 500 tarefas sem envios reais](SIMULACAO_500_GRUPOS.md), com banco e fila reais. O relatório descreve resultados e limites; não é teste de capacidade de 500 grupos WhatsApp reais ou de múltiplas sessões.

Build TypeScript e 40 testes automatizados passaram localmente; o build Docker na VPS terminou e sua auditoria não reportou vulnerabilidades. Na aplicação publicada, foram verificados cadastro, cookie Secure, login, logout com invalidação de sessão, ativação do teste de sete dias, consulta de campanhas e leitura administrativa da conta e do teste. A API administrativa retornou 401 sem token. Uma conta técnica identificada como `Teste tecnico de homologacao` permanece no banco novo; nenhum envio ou pagamento foi realizado.

O navegador abriu login, administração autenticada e painel autenticado. O layout publicado foi conferido em larguras de 320, 390 e 430 px, sem rolagem horizontal da página nas telas examinadas. Essa simulação não substitui Chrome Android e Safari iOS reais.

1. Abrir o endereço HTTPS no Chrome do Android ou Safari do iPhone.
2. Criar a própria conta e ativar o teste em **Licença e Pix**. O teste começa na ativação.
3. Em **WhatsApp**, informar país, DDD e número e gerar o código. Concluir o vínculo na opção de conectar dispositivo pelo número no WhatsApp.
4. Retornar ao navegador, atualizar a conexão e carregar os grupos.
5. Escolher somente um grupo próprio de teste, enviar uma mensagem e conferir o histórico. Depois repetir com um agendamento pontual.

Credenciais exclusivas do servidor foram preservadas no arquivo local ignorado pelo Git `backend/.env.homologacao`. O token `ADMIN_API_TOKEN` permite entrar em `/admin.html`; deve permanecer com o proprietário. As credenciais da conta técnica ficam em `backend/.env.homologacao-teste`, também ignorado. Esses arquivos não fazem parte do repositório e não devem ser publicados.

Pix e WhatsApp de recebimento do comprovante ainda precisam ser configurados nas variáveis opcionais `PIX_KEY` e `PAYMENT_WHATSAPP`. Não é necessário configurá-los para testar a licença gratuita. APK Android e instalação PWA iOS continuam etapas futuras; esta entrega permite testar pelo navegador nos dois sistemas. Pareamento, envios reais e execução do agendamento ainda dependem de teste com um aparelho e destinatário escolhido pelo proprietário. A homologação não está liberada para produção.
