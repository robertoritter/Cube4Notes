# Cube4Notes Server (protótipo inicial)

Servidor web multiplataforma em .NET 10, iniciado inicialmente no Windows. O mesmo projeto pode ser executado no Debian para validação posterior.

```powershell
dotnet run --project services/api/Cube4Notes.Server
```

Escolha uma pasta de notas no prompt. Para automatizar a escolha, passe `--notes "C:\caminho\das\notas"`. A porta padrão é 43123. Para gerar o executável Windows independente, execute na raiz do repositório:

```powershell
./scripts/publish-windows.ps1
```

Use sempre `dist/win-x64/Cube4Notes.Server.exe`. A pasta `bin/` é temporária da compilação; feche o executável publicado antes de substituí-lo por uma nova versão.

O console imprime URLs para interfaces IPv4 privadas e um código aleatório de acesso. Digite o código no navegador ao abrir a interface. O código fica guardado nesse navegador e é renovado quando o processo reinicia. O servidor ouve a porta TCP 43123 e rejeita clientes que não pertencem a uma sub-rede privada ativa do host. Mudanças de endereço de rede atualizam a lista no console.

A interface protótipo permite criar pastas e arquivos Markdown, navegar e salvar conteúdo com atalhos básicos. Oferece idioma Português (Brasil) ou English e temas Claro, Escuro, Sépia ou conforme o sistema; preferências ficam no navegador. Ao salvar, o servidor confere a versão aberta pelo navegador e recusa alterações concorrentes, preservando a cópia que está no servidor e o texto ainda aberto no navegador. Ela não implementa ainda conversão WYSIWYG completa, edição offline, sincronização, autenticação individual ou TLS. Não use em redes públicas/não confiáveis. O executável não altera o firewall, o roteador ou configura acesso externo.

Os assets de marca acompanham as convenções Cube4Code: símbolo, wordmark Cube4Notes com “4” roxo, Manrope e atribuição “created by Cube4Code.com”. A Manrope está sob SIL Open Font License; seu texto acompanha o asset em `wwwroot/brand/Manrope-OFL.txt`. Isso não escolhe licença para o produto.
