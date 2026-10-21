# ADR 0005: Tipos, modelos e relações entre notas

- Status: aceita
- Data: 2026-10-21

## Contexto

O proprietário quer registrar fichas ligadas entre si (empresas, pessoas, reuniões, mas também livros, jogos, aulas) e ver essas ligações de forma organizada, no computador e no celular, também sem servidor. Um grafo espacial mostra que existe ligação, mas não qual.

## Decisão

- **Tipo** é a propriedade `tipo:` da nota (um por nota). **Tags** continuam sendo quantas a pessoa quiser.
- **Modelos** são notas comuns na pasta `modelos/` do vault, com `tipo`, `tags`, campos vazios e `destino:` (pasta onde a nota nova é criada; não é copiado para a nota). `{{titulo}}`, `{{data}}` e `{{hora}}` são preenchidos na criação.
- **Relação** é um campo cujo valor é o nome de outra nota (`empresa: Empresa Y`, também `[[Empresa Y]]` ou um link Markdown) ou um link no texto. Renomear a nota atualiza esses campos.
- O painel de relações agrupa por tipo quem aponta para a nota; a lista por tipo mostra campos como colunas, contadores de relações e o último contato (a data mais recente das notas ligadas).
- **Conjuntos** prontos (Trabalho, Pessoal, Leituras, Estudos, Software, Jogos) só criam modelos em `modelos/`; depois são do usuário.
- Tudo é calculado no aparelho a partir das notas. O servidor não muda.

## Alternativas

- Banco de dados ou esquema próprio para tipos: quebraria a regra de Markdown legível e o funcionamento offline sem servidor.
- Tipo como tag: uma nota com duas tags de tipo não saberia em que grupo aparecer.
- Modelos guardados na configuração do servidor: não sincronizariam nem funcionariam offline.

## Consequências

- Qualquer editor continua abrindo as notas; os campos são YAML simples.
- Valores de campo que coincidem com o nome de uma nota viram relação, mesmo sem intenção (por exemplo `status: Concluído` se existir uma nota "Concluído"). Os campos `tipo`, `tags`, `aliases`, `destino` e `data` nunca contam.
- Vaults muito grandes calculam relações a cada abertura de nota; há cache por conteúdo.
