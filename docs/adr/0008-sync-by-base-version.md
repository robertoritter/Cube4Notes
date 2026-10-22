# ADR 0008: Sincronização por versão-base, com cópia de conflito

- Status: aceita (registrada depois da implementação)
- Data: 2026-10-20

## Contexto

Celular, tablet e outros computadores editam offline e reencontram o servidor depois. O mesmo arquivo pode mudar em dois lugares. A regra do projeto é que nenhuma alteração seja descartada em silêncio, e o resultado precisa continuar sendo Markdown comum, sem marcações de conflito dentro do texto.

## Decisão

- Cada aparelho guarda uma cópia completa dos vaults liberados (IndexedDB) e uma fila de operações (`put`, `delete`, `mkdir`, `rmdir`, `move`, `upload`).
- Gravar e apagar uma nota levam a versão-base: o SHA-256 do conteúdo que o aparelho tinha. Anexos sobem à parte e nunca sobrescrevem um arquivo diferente.
- O servidor aplica a operação se a versão atual for igual à versão-base. Se for diferente, mantém a versão do servidor e grava a do aparelho como `Nota (conflito <aparelho> <data>).md`.
- Exclusões vão para `.lixeira`; uma exclusão de nota que mudou depois é recusada.
- Renomeações ficam registradas por 30 dias, para que edições pelo nome antigo sigam a nota.
- O servidor guarda versões anteriores (`.cube4notes/historico`), para desfazer qualquer alteração.
- Aparelhos só sincronizam com o servidor, nunca entre si.

## Alternativas

- Merge automático de texto (diff3) ou CRDT: menos cópias de conflito, mas pode produzir texto que ninguém escreveu, e CRDT exige guardar um formato próprio além do Markdown.
- Última gravação vence: simples, mas perde texto sem aviso, o que a regra do projeto proíbe.
- Sincronização entre aparelhos (peer-to-peer): dispensaria o servidor ligado, mas multiplica os casos de conflito e exigiria descoberta entre aparelhos.

## Consequências

- O pior caso é uma cópia de conflito, visível e marcada no app, para o usuário juntar.
- Coberto por testes adversariais (`app/dev/teste_sync.py`, `teste_offline.py`), que rodam no CI.
- Edição simultânea em tempo real fica fora do escopo.
