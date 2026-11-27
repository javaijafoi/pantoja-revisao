# Changelog — Revisão Ciências 8º Ano (Pantoja)

Todas as melhorias e atualizações desta aplicação são registradas neste mesmo arquivo em ordem cronológica reversa.

---

## [2026-11-26] — Melhorias de usabilidade, resiliência e revisão de erros

### Melhorias implementadas
1. **Rascunho automático da prova e validação visual de pendências (`app.js`, `style.css`)**
   - Salva automaticamente no `localStorage` (`appState.examDrafts`) cada resposta marcada durante o simulado, restaurando o progresso caso a página seja recarregada ou a aluna volte ao painel antes de concluir.
   - Ao tentar entregar uma prova incompleta, destaca os cards das questões em branco (`.question-card.is-missing`), exibe exatamente quais números faltam e rola suavemente até a primeira questão pendente.
   - Limpa o rascunho automaticamente ao entregar a prova ou virar o dia (`advanceToNextDay`).

2. **Filtro de erros no Gabarito Comentado e Histórico de Provas no Painel (`index.html`, `app.js`, `style.css`)**
   - Adicionada barra de filtros (`Todas` / `Apenas Erros`) na tela de resultado do simulado (`view-exam-result`) para permitir revisão focada nas questões erradas.
   - Adicionado resumo recolhível (`📜 Histórico de provas`) nos cards de cada frente no Dashboard exibindo notas anteriores de `st.examHistory` e total de erros acumulados nos flashcards V/F.

3. **Atalhos de teclado nos Flashcards, escapamento seguro de HTML e virada de dia ao retomar aba (`index.html`, `app.js`, `style.css`)**
   - Adicionados atalhos de teclado na tela de flashcards V/F (`←`/`F` = Falso, `→`/`V` = Verdadeiro, `E` = Ver/Ocultar Explicação, `Enter`/`Espaço` = Próximo Card) com dica visual para desktop.
   - Implementado `escapeHtml()` nas renderizações dinâmicas via `innerHTML` para evitar que símbolos matemáticos/químicos (`<`, `>`) afetem a marcação HTML.
   - Adicionado listener `visibilitychange` para executar `checkDailyRollover()` automaticamente ao retornar para uma aba deixada aberta de um dia para o outro.
