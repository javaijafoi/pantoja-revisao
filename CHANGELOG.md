# Changelog — Revisão Ciências 8º Ano (Pantoja)

Todas as melhorias e atualizações desta aplicação são registradas neste mesmo arquivo em ordem cronológica reversa.

---

## [2026-11-27 (Atualização 5)] — Modo foco no simulado, desfazer/embaralhar V/F, refazer prova e glossário unificado

### Melhorias implementadas
1. **Simulado Inteligente: Modo Foco (1 questão por vez), Cronômetro, Atalhos e Correções (`index.html`, `app.js`, `style.css`)**
   - Adicionado o botão **🎯 1 por vez / 📄 Ver todas** (`#btn-toggle-exam-focus`) e o paginador `#exam-focus-pager` para alternar entre lista completa e foco em uma questão por vez.
   - Adicionado o cronômetro informativo `#exam-timer-badge` (`⏱️ MM:SS`) durante a prova/treino, gravando `durationSeconds` no histórico (`examHistory`), exibindo o tempo no resultado, no histórico do painel e no relatório do WhatsApp.
   - Adicionados atalhos de teclado no simulado (`A`–`D` ou `1`–`4` para marcar alternativa, `R` para marcar `🚩 Revisar depois`, `[`/`]` ou `←`/`→` para navegar).
   - Corrigidos 3 pontos de confiabilidade: bloqueio global de atalhos V/F quando qualquer `<dialog open>` estiver aberto (incluindo `#dialog-glossary`), exibição do título da prova de origem (`_sourceExamTitle`) também no gabarito do treino de erros, e chaveamento estável dos rascunhos/marcadores de `error-drill` por ID da questão.

2. **Flashcards V/F com "Desfazer" e "Embaralhar", Refazer Prova pelo Histórico e Cópia de Erros (`index.html`, `app.js`, `style.css`)**
   - Adicionado o botão **↩️ Desfazer** (`#btn-undo-vf`) no feedback do flashcard para reverter toques/swipes acidentais antes de avançar, restaurando caixas, fila e contadores de erro.
   - Adicionado o botão **🔀 Embaralhar** (`#btn-shuffle-vf`) no topo dos flashcards V/F para reordenar aleatoriamente os cartões ainda pendentes na fila.
   - Adicionado o botão **🔁 Refazer** (`openHistoryExamPractice`) em cada item de **📜 Histórico de provas** para praticar provas anteriores em modo treino livre (sem gastar as 3 tentativas diárias) e o botão **💬 Copiar erro(s) p/ dúvida** (`buildExamErrorsWhatsAppText`) no gabarito para enviar dúvidas formatadas no WhatsApp.

3. **Glossário Unificado (V/F + Provas já Feitas), Destaque de Busca e Exportação (`index.html`, `app.js`, `style.css`)**
   - Expandido `#dialog-glossary` com alternância de fonte (**🃏 Cartões V/F** / **📝 Provas já feitas** sem spoiler de provas não realizadas), filtro **Falta dominar** (`#glossary-only-pending`), destaque visual seguro (`<mark>`) com `highlightSearchMatch()` e botão **📋 Copiar lista** (`#btn-copy-glossary`) com toast próprio `#glossary-feedback-toast` visível dentro do modal.

---

## [2026-11-27 (Atualização 4)] — Navegação inteligente no simulado, treino de erros de prova e glossário V/F

### Melhorias implementadas
1. **Navegação rápida no Simulado e proteção contra entrega com revisões pendentes (`index.html`, `app.js`, `style.css`)**
   - Transformado o contador `#exam-flagged-status` em botão clicável (`🚩 X para revisar ↻`) e adicionado o atalho **⏭️ Próxima em branco** (`#exam-jump-unanswered`) na barra fixa `.exam-sticky-bar`, permitindo saltar ciclicamente entre questões marcadas ou não respondidas.
   - Adicionada confirmação em dois cliques no envio do formulário (`#exam-form` / `#btn-submit-exam`) sempre que ainda houver questões marcadas com `🚩 Revisar depois`, além de `aria-current="location"` na pílula ativa do navegador e grade adaptativa de pílulas para treinos curtos.

2. **Gabarito Comentado completo (A/B/C/D) e Modo "🧠 Treinar Erros de Prova" (`app.js`, `style.css`)**
   - Atualizado `renderExamResultView()` para listar todas as 4 alternativas (`A`, `B`, `C`, `D`) de cada questão, destacando visualmente a resposta correta e a marcada pela aluna.
   - Adicionado o modo focado **🧠 Treinar Erros de Prova** (`openExamErrorDrill()` + `getPendingExamErrorQuestions()`), que reúne as questões erradas do `examHistory` ainda não resolvidas (`st.resolvedExamErrors`) para praticar no `#view-exam` sem consumir as 3 tentativas diárias e reintroduz automaticamente qualquer questão errada novamente em prova oficial.

3. **Glossário / Busca Rápida de Conceitos V/F, Toast Global e ajustes no Relatório (`index.html`, `app.js`, `style.css`)**
   - Adicionado o botão **🔍 Glossário V/F** no cabeçalho abrindo o modal `#dialog-glossary`, com busca instantânea sem acento (`normalizeSearchText`), filtro por frente e toggle *"Só com erros"* para consultar rapidamente os 90 cartões V/F e suas explicações.
   - Adicionado `#global-toast` para exibir notificações fora do modal de relatório (como ao iniciar o próximo dia pelo banner principal), além de exibir `(+ N outro(s))` no relatório de WhatsApp quando houver mais de 6 cartões com erro no dia.

---

## [2026-11-27 (Atualização 3)] — Treino focado de erros V/F, gabarito pelo histórico e marcador de revisão no simulado

### Melhorias implementadas
1. **Proteção do desbloqueio diário e Modo "Treinar Erros V/F" (`index.html`, `app.js`)**
   - Corrigido o bug em que clicar em *"🔄 Revisar 30 V/F Novamente"* após concluir os 30 cartões re-bloqueava o botão de prova no painel; agora `st.vfCompletedToday` permanece ativo no dia após atingir 30/30.
   - Adicionado o modo focado **🎯 Treinar Erros V/F** (`openFlashcards(subjKey, 'errors')` + `getVfRuntime()`), permitindo treinar apenas os cartões com erros acumulados em sessão isolada sem zerar as caixas já dominadas, mantendo a contabilização de novos erros e exibindo o indicador `#vf-mode-label` no topo.

2. **Reabertura do Gabarito Comentado pelo Histórico e registro da alternativa marcada (`app.js`, `style.css`)**
   - Passado a gravar `userAnswers` em cada registro de `st.examHistory` dentro de `gradeAndShowExamResult()` (mantendo compatibilidade com históricos antigos sem esse campo).
   - Exibida `"Sua resposta: X)"` nos detalhes de erro do painel e adicionado o botão **🔍 Gabarito** (`openHistoryExamResult` + `renderExamResultView`) para reabrir a tela completa de gabarito comentado com filtro *Todas / Apenas Erros*, além de remover o corte de 6 itens com lista rolável em `.exam-history-list`.

3. **Marcador "🚩 Revisar depois" no Simulado e ajustes de timers/acessibilidade (`index.html`, `app.js`, `style.css`)**
   - Adicionado o botão **🏳️ Revisar depois / 🚩 Marcada p/ revisar** em cada questão do simulado, sincronizado com as pílulas do navegador fixo (`.exam-nav-pill.is-flagged`), contador `#exam-flagged-status` e persistência em `appState.examDraftFlags`.
   - Corrigido o gerenciamento de timers em `setupTwoStepConfirm()` (retornando função de reset usada ao abrir prova ou fechar o modal) e em `showToast()` (cancelando timeout anterior), protegido `showCardFeedback()` contra foco após sair dos flashcards, normalizado `Number(savedChoice)` nos rascunhos e trocado `hidden` por `.visually-hidden` no `#input-import-file` para navegação por teclado.

---

## [2026-11-27 (Atualização 2)] — Painel global do dia, navegador fixo no simulado e revisão rápida de erros

### Melhorias implementadas
1. **Painel geral do dia e revisão rápida de erros no Dashboard (`index.html`, `app.js`, `style.css`)**
   - Adicionado o resumo `#global-day-summary` dentro do banner principal com barra de progresso unificada das 3 frentes, total de flashcards V/F dominados (`X/90`) e provas realizadas no dia.
   - Transformados os itens de **Pontos de atenção V/F** em acordeões expansíveis que mostram a afirmação, o gabarito e o macete/explicação diretamente no painel.
   - Adicionada a resolução automática (`findExamQuestion`) das questões erradas no **Histórico de provas**, permitindo revisar enunciado, alternativa correta e comentário sem precisar refazer a prova.

2. **Barra fixa de navegação do Simulado e limpeza segura de rascunho (`index.html`, `app.js`, `style.css`)**
   - Agrupados `#exam-progress-bar`, `#exam-sticky-status` e `#exam-question-nav` em `.exam-sticky-bar` (`position: sticky`) para acompanhar o progresso e saltar entre questões durante toda a rolagem.
   - Adicionado `IntersectionObserver` (`setupExamVisibilityObserver`) para destacar a questão atualmente visível (`.exam-nav-pill.is-current`).
   - Adicionado o botão **Limpar marcações** (`#btn-clear-exam-draft`) com confirmação em dois cliques via `setupTwoStepConfirm()` para reiniciar um rascunho de simulado com segurança.

3. **Acessibilidade por teclado nos Flashcards V/F, indicadores de fila e normalização de saves (`index.html`, `app.js`, `style.css`)**
   - Corrigido o atalho de teclado na tela de feedback dos flashcards para que `Enter`/`Espaço` respeitem outros botões focados (como `#btn-toggle-explanation`) em vez de pular o card.
   - Adicionados o indicador `#vf-queue-badge` (quantidade restante na fila) e badges de contexto no cartão (`⚠️ Reforço` para cards com erros acumulados e `⚡ Fast-track` para cards de revisão rápida).
   - Endurecido `loadState()` (limitação de `cardBoxes` entre `0` e `2` e índices não negativos), atualizado `importSaveFromText()` para executar `checkDailyRollover()` e persistir o save normalizado, e alinhado o botão de upload `.file-upload-btn` no modal.

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
