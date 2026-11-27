# Changelog — Revisão Ciências 8º Ano (Pantoja)

Todas as melhorias e atualizações desta aplicação são registradas neste mesmo arquivo em ordem cronológica reversa.

---

## [2026-11-27] — Proteção contra perda de dados, navegador de questões e pontos de atenção

### Melhorias implementadas
1. **Confirmação em dois cliques para ações críticas e blindagem de saves (`app.js`, `style.css`)**
   - Adicionado `setupTwoStepConfirm()` para exigir confirmação em dois cliques (janela de 4 segundos) em **Zerar Todo o Progresso** (`#btn-reset-all`) e em **Virar o Dia** (`#btn-advance-day`) quando o dia ainda estiver incompleto, evitando perda acidental de progresso.
   - Endurecido `loadState()` para normalizar saves legados ou parciais (garantindo objetos e arrays padrão como `examHistory`, `cardErrorsTotal` e contadores) e limpo o campo de arquivo (`#input-import-file`) e texto após importação bem-sucedida.

2. **Mapa navegável de questões e barra de progresso no Simulado (`index.html`, `app.js`, `style.css`)**
   - Adicionados `<progress id="exam-progress-bar">` e o painel `#exam-question-nav` (botões `1` a `10`) no topo do simulado (`#view-exam`), permitindo acompanhar o avanço visualmente, saltar direto para qualquer questão e identificar facilmente questões respondidas ou em branco (`.is-answered`, `.is-missing`).

3. **Pontos de atenção V/F, detalhes de erros no Histórico e Favicon SVG (`index.html`, `app.js`, `style.css`, `favicon.svg`)**
   - Adicionada a seção recolhível **Pontos de atenção V/F** em cada card do Dashboard listando os 5 tópicos com mais erros acumulados (`st.cardErrorsTotal`), além de exibir os números das questões erradas dentro de **Histórico de provas**.
   - Criado `favicon.svg` e vinculado via `<link rel="icon">` em `index.html` para exibir o ícone da aplicação na aba e eliminar erros 404 de ícone nos navegadores.

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
