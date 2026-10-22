# ADR 0007: Executável único em .NET com a interface embutida

- Status: aceita (registrada depois da implementação)
- Data: 2026-10-20

## Contexto

O Cube4Notes precisa ser fácil de instalar em qualquer ambiente: quem não tem servidor em casa usa no próprio computador, e quem tem um servidor Linux sem tela deixa rodando como serviço. Experiências anteriores com ferramentas de notas mostraram que exigir proxy reverso, banco de dados, containers ou configuração manual por máquina afasta o usuário. O servidor também precisa compilar e rodar no Windows, no Linux e no macOS.

## Decisão

- Servidor em .NET 10 (ASP.NET Core, Kestrel), mirando `net10.0` e nunca `net10.0-windows`. O que é de um sistema só (ícone na bandeja, firewall e confiança no certificado no Windows) fica atrás de verificação em tempo de execução.
- Interface web (TypeScript, Vite, Milkdown) compilada para `app/wwwroot` e embutida no executável como recurso.
- Publicação em arquivo único, autocontido (não precisa do .NET instalado), com globalização invariante (não depende da biblioteca ICU).
- Janela própria de app com Photino (WebView do sistema), num segundo processo, para fechar a janela sem derrubar o servidor.
- Armazenamento só em arquivos: notas nas pastas dos vaults e configuração em JSON numa pasta própria. Sem banco de dados.

## Alternativas

- Electron ou Tauri: janela melhor integrada, mas pacote maior (Electron) ou outra cadeia de compilação (Rust); o servidor continuaria sendo necessário.
- Node.js no servidor: mesma linguagem da interface, mas exigiria empacotar o runtime; o servidor de teste em Node (`app/dev/mock-server.mjs`) existe só para desenvolvimento.
- Banco SQLite para índice e versões: mais rápido em vaults muito grandes, mas cria um segundo formato a manter coerente com os arquivos.

## Consequências

- Instalação é copiar um arquivo e abrir. No Linux, `gerar-executavel.sh` e `instalar-servico.sh` cobrem o servidor sem tela.
- O CI precisa gerar e testar o executável nos três sistemas, porque erros de plataforma (como a falta da ICU num Debian mínimo) só aparecem no executável real.
- A interface compilada fica versionada em `app/wwwroot`, para que quem só compila o .NET tenha a interface certa.
