# ADR 0003: Links entre notas em Markdown padrão

- Status: aceita
- Data: 2026-10-21

## Contexto

Notas ligadas umas às outras são o que transforma uma pasta de arquivos em base de conhecimento. Há dois formatos em uso: o link Markdown padrão (`[texto](pasta/nota.md)`), que qualquer editor e o GitHub entendem, e o link de wiki (`[[Nome]]`), mais curto de digitar, mas que fora de alguns apps aparece como texto cru e depende de o nome da nota ser único no vault.

## Decisão

O Cube4Notes grava links entre notas em **Markdown padrão, com caminho relativo à nota** e codificado (`%20` para espaços). Para digitar, `[[` abre a lista de notas e insere o link padrão; `[[Nome]]` digitado por inteiro também vira link padrão. Links `[[Nome]]` já existentes (vindos de outros editores) continuam aparecendo nos backlinks e acompanham renomeações, mas não são criados pelo Cube4Notes.

Ao renomear ou mover uma nota, pasta ou anexo **neste aparelho**, os links das outras notas e os relativos da própria nota são reescritos. Renomeações vindas de outro aparelho não reescrevem de novo (o aparelho que renomeou já reescreveu).

## Alternativas

- `[[Nome]]` como formato gravado: mais curto, mas quebra a regra de Markdown legível em qualquer editor e fica ambíguo com nomes repetidos.
- Caminho a partir da raiz do vault (`/pasta/nota.md`): não funciona em editores que abrem só a pasta da nota.

## Consequências

- As notas continuam abrindo com links funcionando no VS Code, no GitHub e em outros editores de Markdown.
- Uma nota renomeada fora do Cube4Notes (no Explorer, por exemplo) não atualiza os links: o link aponta para a nota que não existe e o Cube4Notes oferece criá-la.
- Links dentro de blocos de código nunca são alterados.
