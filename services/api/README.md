# API central

O primeiro protótipo executável está em [`Cube4Notes.Server`](Cube4Notes.Server/README.md). Ele serve uma interface web, navega e altera arquivos `.md` numa pasta escolhida, anuncia endereços IPv4 privados descobertos no momento e exige um código de acesso para as rotas da API. O código muda a cada inicialização. A restrição de rede verifica se o cliente está na mesma sub-rede local ativa. Salvar exige a versão do arquivo que o navegador abriu; mudanças concorrentes são recusadas com HTTP 409 para evitar sobrescrita silenciosa.

Limites conhecidos desta etapa: HTTP sem TLS, sem cliente offline/sincronização, sem integração de agentes, sem autenticação por usuário e sem descoberta automática nos navegadores. O endereço é mostrado no console; mudança de interface/IP atualiza essa lista. Não configurar acesso externo.
