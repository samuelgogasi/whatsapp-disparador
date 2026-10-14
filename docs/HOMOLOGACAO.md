# Homologação na VPS existente

## Restrição de operação

Não alterar, reiniciar, parar, reimplantar ou reutilizar `unasp-db` e `unasp-portal`. O serviço `teste` também permanece sem alterações. Não alterar configurações globais, redes, volumes, credenciais ou rotas da UNASP para implantar este projeto.

## Estado verificado em 14/10/2026

O projeto `whatsapp-homologacao` e o serviço Compose `disparador` foram preparados separadamente. O repositório está na branch `main`, com arquivo `compose.homologacao.yaml`. Nenhum container da homologação foi iniciado: o painel mostra CPU, memória e rede zerados.

O Easypanel ainda apresenta um aviso de interpolação de `POSTGRES_PASSWORD`, mesmo após o salvamento das variáveis do novo serviço. Antes do primeiro deploy, verificar que o Compose recebe as variáveis; não remover a exigência de senha nem recorrer ao banco da UNASP. A rota HTTPS e o destino interno `app:3333` também precisam ser validados.

O monitor mostrou CPU em 2%, RAM em 44,9% (1,6 GB de 3,6 GB) e disco em 17,3% (16,1 GB de 93,1 GB). Esses números são uma amostra, não uma medição de pico. Os identificadores dos containers da UNASP permaneciam iguais aos registrados antes da preparação:

- Portal: `unasp-portal_unasp-portal.1.i6f33ru7ndzxp0ozuhnevbtl7`
- Banco: `unasp-portal_unasp-db.1.wlkjih1g1qu7awwwego3fe8lj`
- phpMyAdmin: `unasp-portal_unasp-db_phpmyadmin.1.xgrf1cfht0ffpu44ddcoa4bnd`

Isso não substitui um teste HTTP do portal nem demonstra ausência de impacto futuro.

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

Build TypeScript e 40 testes automatizados passaram localmente; auditoria de dependências de produção sem vulnerabilidades reportadas. Docker, PostgreSQL/Redis reais, conexão WhatsApp e aparelhos físicos ainda não foram validados nesta VPS. A homologação não está liberada para produção.
