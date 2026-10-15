# APK Android de homologação

Projeto nativo em `mobile/android`, aplicativo `br.com.empauta.disparador.homologacao`, Android 8 ou posterior. Abre o painel HTTPS da homologação em WebView e mantém as operações de envio na VPS. O aplicativo não contém token administrativo, credenciais do banco ou sessão de WhatsApp pré-configurada.

O painel e a API compartilham a mesma origem HTTPS: cookies HttpOnly/Secure e proteção contra origem externa continuam ativos, sem liberar CORS geral. O aplicativo permite navegação interna somente no domínio configurado. Links HTTPS externos abrem em outro aplicativo. Acesso a arquivos/conteúdo, tráfego HTTP e conteúdo misto estão desativados; não existe ponte JavaScript nativa. Erros de certificado não são ignorados.

Há confirmação nativa para operações que usam `confirm`, navegação Voltar compatível com Android recente, tratamento de área segura/teclado, persistência de cookies e tela para tentar novamente quando o painel não abre. Não há suporte offline para campanhas; indisponibilidade de rede impede usar o painel. Campanhas já criadas dependem da VPS, da licença e da conexão WhatsApp, não de manter o APK aberto.

## Compilar

Requisitos: JDK 17, Gradle 8.13, Android SDK Platform 36 e Build Tools 36.0.0. A primeira compilação requer internet para resolver dependências oficiais.

```powershell
gradle -p mobile/android --no-daemon --max-workers=2 assembleDebug lintDebug
```

No Windows, o script `mobile/build-android.ps1` prepara ferramentas oficiais e verifica checksums, sem alterar configurações globais. Ferramentas e caches ficam em `artifacts/toolchain`, ignorado pelo Git. O parâmetro de verificação de caminho do Gradle é ajustado somente para compilar neste diretório com acentos.

O APK de teste é copiado para `artifacts/em-pauta-homologacao.apk`. A compilação debug usa assinatura de desenvolvimento, não uma chave comercial definitiva. A assinatura e o identificador devem ser planejados antes da distribuição pública. Builds com outra chave debug podem exigir desinstalar a versão anterior; os dados do servidor não são apagados nessa desinstalação.

`docs/templates/android-apk.yml` é um modelo opcional de GitHub Actions, não um workflow ativo. O envio de workflows foi recusado pelo GitHub por falta de escopo `workflow` na credencial atual. A compilação local permite entregar o APK sem ampliar permissões dessa credencial. Para ativar o modelo, o proprietário deve salvar o arquivo em `.github/workflows` com uma credencial autorizada.

## Teste em aparelho

1. Instalar o APK de homologação e entrar com a própria conta. Não usar o token administrativo como senha de cliente.
2. Copiar o código de pareamento, alternar para o WhatsApp e voltar ao aplicativo.
3. Carregar grupos, confirmar autorização e testar somente em um grupo próprio de teste.
4. Conferir agendamento, cancelamento, Voltar, teclado, fechamento/reabertura e indisponibilidade de rede.
5. Verificar o comportamento de sessão após um período em segundo plano.

Não foram simulados aparelhos Android físicos por meio do navegador. O iPhone continua usando o painel HTTPS; empacotamento APK não atende iOS. A instalação PWA do iPhone permanece uma etapa separada.
