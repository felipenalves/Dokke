# Tasks: Instalador dmg layout

> feature: instalador-dmg-layout

<!--
  Como ler este arquivo (o formato é verificado por `onp-spec audit`):
  - T-xxx = tarefa (código de rastreio, único no projeto inteiro).
  - Toda tarefa referencia em `Refs:` pelo menos uma história de usuário
    (US-xxx) ou critério de aceite (AC-xxx).
  - Toda tarefa lista os arquivos que cria/altera em `Arquivos:` — capriche:
    é o que decide o que `onp-spec plano` roda em PARALELO (arquivos
    disjuntos) e o que roda em sequência.
  - Campos opcionais por tarefa, usados pelo plano de execução:
    `- Modelo: claude-sonnet-5` e `- Esforço: alto` (baixo|medio|alto|xalto|max).
  - Uma tarefa só pode virar [concluida] quando os critérios de aceite dela
    tiverem prova PASS registrada por `onp-spec verify`.
  Status: pendente | em-andamento | concluida
    (atalho: `onp-spec tarefa <feature> <T-xxx> <status>`)
-->

## T-001 — Implementar o builder do instalador [concluida]
- Refs: US-001, AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007, AC-008, AC-009, AC-010, AC-011, AC-012, AC-013
- Arquivos: mac/package-dmg.sh, mac/dmg-background.svg, mac/dmg-background.png, package.json, package-lock.json
- Notas: appdmg grava o fundo, posições e visualização no `.DS_Store`; o script continua sendo a interface pública do build.

## T-002 — Provar o artefato montado [concluida]
- Refs: AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007, AC-008, AC-009, AC-011, AC-012, AC-013
- Arquivos: test/package-dmg.test.mjs
- Notas: um build é reutilizado pelos testes e remontado para provar persistência.

## T-003 — Auditar a implementação [concluida]
- Refs: AC-010
- Arquivos: test/package-dmg.test.mjs
- Notas: a auditoria mecânica fecha a rastreabilidade da spec.
