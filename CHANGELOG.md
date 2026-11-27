# Changelog — Revisão Ciências 8º Ano (Pantoja)

Todas as melhorias e atualizações desta aplicação são registradas neste mesmo arquivo em ordem cronológica reversa.

---

## [2026-11-27 (Atualização 12)] — Atalhos de Favoritas no painel, reforço imediato da sessão V/F e precisão no simulado

### Melhorias implementadas
1. **Favoritas (⭐) acessíveis direto no Painel, filtro no Gabarito e sincronização com o Glossário (`index.html`, `app.js`)**
   - Adicionados na barra **🌐 Revisão mista (3 frentes)** do Dashboard (`#global-day-summary`) os atalhos diretos **⭐ Favoritas V/F (N)** (`openStarredVfPractice()`) e **⭐ Questões Favoritas (N)** (`openStarredExamPractice()`), permitindo treinar em 1 clique os itens favoritados sem precisar abrir o modal do Glossário.
   - Adicionado o filtro **⭐ Favoritas (N)** (`#btn-filter-starred`) no cabeçalho do **Gabarito Comentado** (`#view-exam-result`), com atualização automática do contador via `updateResultStarredFilterCount()` e sincronização bidirecional dos botões `☆ / ⭐` via `syncVisibleStarButtons()`.
   - Adicionado o botão **🧹 Limpar filtros** (`#btn-glossary-clear-filters`) no `#dialog-glossary` (exibido quando há busca, filtro por frente ou opções marcadas) e atualização do Dashboard ao fechar o Glossário.

2. **Reforço imediato dos erros da sessão V/F e preservação de erros novos do Treino Livre (`app.js`)**
   - Adicionado o botão **🎯 Reforçar N erro(s) desta sessão** (`#btn-go-to-session-errors-now`) na tela de conclusão dos Flashcards V/F sempre que houver erros na sessão recém-terminada, abrindo `openCustomVfPractice()` apenas com aqueles cartões (preservando o progresso diário).
   - Adicionado `st.practiceWrongErrors` (normalizado em `loadState()` com retrocompatibilidade) para registrar questões erradas durante sessões de **Treino Livre** (`🔁 Refazer`, `🎲 Simulado Geral Misto` ou `🔍 Treino pelo Glossário`), integrando-as a `getPendingExamErrorQuestions()` e dando baixa automática ao acertar posteriormente.

3. **Foco sincronizado no Simulado, atalho `C` para limpar resposta e ritmo por questão no resultado (`index.html`, `app.js`)**
   - Adicionado listener `focusin` em `#exam-questions-container` para manter `examCurrentIndex` e a pílula ativa sincronizados ao navegar com `Tab` no modo *"📄 Ver todas"*, além do atalho **`C`** para limpar a resposta da questão atual (`↺ Limpar`) e atualização da legenda `.exam-keyboard-hint`.
   - Adicionado o ritmo médio por questão (`~Xs/Q` ou `~Xm YYs/Q`) junto ao tempo total no resumo do **Gabarito Comentado** (`renderExamResultView()`).

---

## [2026-11-27 (Atualização 11)] — Glossário com Auto-Teste e treino de provas, sistema de Favoritas (⭐) e treino dos erros da prova

### Melhorias implementadas
1. **Glossário Interativo: Modo Auto-Teste, filtro de pendências em provas e treino direto de questões (`index.html`, `app.js`, `style.css`)**
   - Adicionado o toggle **🙈 Auto-teste** (`#glossary-hide-answers`) no `#dialog-glossary` para ocultar o gabarito e o comentário de cartões V/F e questões de prova atrás de um `<details>` (*Revelar resposta / gabarito*), permitindo revisar sem spoiler antes de conferir.
   - Habilitado o checkbox `#glossary-only-pending` também na aba **📝 Provas já feitas** (alternando o rótulo para *Erro pendente*), facilitando encontrar apenas questões erradas ainda não resolvidas.
   - Adicionado o botão **🧠 Treinar estas questões (N)** (`#btn-glossary-practice-exams`) na aba **📝 Provas já feitas**, abrindo `openCustomExamPractice()` em modo treino livre com as questões filtradas (com baixa automática nas pendências ao acertar).

2. **Sistema de Favoritas / Dúvidas (⭐) integrado aos Flashcards, Gabarito, Glossário e Relatório (`index.html`, `app.js`, `style.css`)**
   - Adicionado o estado persistente `appState.starredItems` (`{ cards, questions }`, normalizado em `loadState()`) com botões **☆ / ⭐** no feedback dos Flashcards V/F (`#btn-star-vf`), no cabeçalho de cada questão do **Gabarito Comentado** (`.btn-star-q`) e nos cartões do **Glossário** (`.btn-star-glossary`).
   - Adicionado o filtro **⭐ Favoritas** (`#glossary-only-starred`) no `#dialog-glossary` para listar e treinar rapidamente apenas os cartões V/F ou questões favoritadas.
   - Incluído automaticamente o resumo de **⭐ Favoritas / Dúvidas** no relatório de WhatsApp gerado por `generateReportAndSaveText()`.

3. **Treino focado nos erros da prova no Gabarito, indicador de rascunho no Histórico e correção na cópia de dúvida (`app.js`)**
   - Adicionado no **Gabarito Comentado** (`#view-exam-result`) o botão **🎯 Treinar só os N erros desta prova** (`openSpecificExamErrorsPractice()`) quando houver acertos e erros na prova, permitindo refazer de imediato apenas as questões erradas daquela tentativa (com baixa nas pendências).
   - Atualizado `getExamDraftStatus()` para considerar também questões marcadas com `🚩` ou alternativas riscadas (`✂️`), e atualizado `renderDashboard()` e `renderExamResultView()` para indicar `📝 Continuar` quando houver rascunho em andamento ao refazer provas do **📜 Histórico de provas**.
   - Corrigido `buildSingleQuestionWhatsAppText()` para não prefixar `❌ Marquei:` ao clicar em **💬 Copiar dúvida** em uma questão que a aluna acertou (exibindo `✅ Marquei e acertei: ... (fiquei com dúvida)`).

---

## [2026-11-27 (Atualização 10)] — Riscar alternativas no simulado, treino pelo Glossário com streak V/F e mapa do gabarito

### Melhorias implementadas
1. **Eliminação de alternativas no Simulado ("Riscar opção") e correção de rascunho (`app.js`, `style.css`)**
   - Adicionado o botão **✂️ / ↩️** (`.btn-eliminate-opt`) ao lado de cada alternativa (`A`–`D`) durante provas e treinos no `#view-exam`, aplicando destaque riscado (`.option-row.is-eliminated`) para descartar distratores sem afetar a seleção do rádio.
   - Persistidas as eliminações por rascunho em `appState.examDraftEliminated` (normalizado em `loadState()`, limpo via `clearExamDraftState()` ao concluir, limpar marcações ou virar o dia, e desfeito automaticamente ao marcar a alternativa).
   - Corrigido `#btn-clear-exam-draft` para preservar `appState.examDraftOrders` ao limpar marcações de uma sessão em andamento (evitando dessincronia no **Simulado Geral Misto**).

2. **Flashcards V/F com sequência de acertos (🔥 Streak) e treino direto pelo Glossário (`index.html`, `app.js`, `style.css`)**
   - Adicionado o indicador **🔥 X seguidos** (`#vf-streak-badge`) no topo dos flashcards V/F durante sequências de 2 ou mais acertos, integrado ao **↩️ Desfazer** (`#btn-undo-vf`), além do recorde da sessão no resumo final de conclusão.
   - Adicionado o botão **🎯 Treinar estes cards (N)** (`#btn-glossary-practice-vf`) no modal `#dialog-glossary` (quando a fonte é **🃏 Cartões V/F**), iniciando `openCustomVfPractice()` em sessão isolada apenas com os cartões filtrados na busca e preservando o progresso diário.

3. **Mapa navegável no Gabarito Comentado e cópia universal com fallback (`index.html`, `app.js`, `style.css`)**
   - Adicionada a barra de pílulas coloridas `#result-question-nav` (`.is-result-correct` / `.is-result-wrong`) no topo do **Gabarito Comentado** (`#view-exam-result`) para visualizar acertos/erros de relance e saltar diretamente para qualquer questão (restaurando o filtro `Todas` automaticamente ao clicar em questão oculta pelo filtro `Apenas Erros`).
   - Extraído o helper compartilhado `copyTextToClipboard()` com fallback via `<textarea>` + `document.execCommand('copy')` para todos os botões de cópia do app (`Relatório + Save`, `Copiar erro(s) p/ dúvida`, `Copiar dúvida` individual e `Copiar lista` do Glossário).

---

## [2026-11-27 (Atualização 9)] — Pular/resumo nos flashcards V/F, pendências de prova no painel e Simulado Geral Misto

### Melhorias implementadas
1. **Flashcards V/F com botão "Pular", precisão da sessão e resumo final detalhado (`index.html`, `app.js`, `style.css`)**
   - Adicionado o botão **⏭️ Pular** (`#btn-skip-vf`, atalho `S`) no topo da revisão V/F para enviar o cartão atual ao final da fila sem contabilizar erro (desabilitado quando houver apenas 1 cartão restante ou enquanto o feedback estiver aberto).
   - Adicionado o rastreamento de desempenho da sessão (`vfSessionStats`) integrado ao **↩️ Desfazer** (`#btn-undo-vf`), exibindo precisão percentual, total de acertos/erros e os tópicos que precisaram de reforço no cartão final de conclusão.

2. **Painel de Pendências de Prova, rascunhos em treinos de erro e cópia individual de dúvida (`app.js`, `style.css`)**
   - Adicionado o acordeão recolhível **🧠 Pendências de Prova (N)** em cada card do Dashboard (com enunciado, gabarito e comentário das questões erradas ainda não resolvidas, mantendo zero spoiler).
   - Exibida a retomada de rascunhos (`📝 Continuar ...`) também nos botões **🧠 Treinar Erros de Prova** (por frente e na barra mista global) e corrigido `updateExamTimerBadge()` para habilitar **🧹 Limpar marcações** assim que o cronômetro sair de `00:00`.
   - Adicionado o botão **💬 Copiar dúvida** (`.btn-copy-single-q` / `buildSingleQuestionWhatsAppText()`) em cada questão do **Gabarito Comentado** para enviar uma única dúvida formatada para o WhatsApp.

3. **Simulado Geral Misto (Sem Spoiler) e indicadores de média/metas no painel e relatório (`app.js`)**
   - Implementados `collectCompletedExamPoolBySubject()` e `openMixedCompletedPractice()` (botão **🎲 Simulado Geral Misto**), sorteando até 12 questões equilibradas entre Química, Biologia e Física apenas de provas já concluídas (zero spoiler), priorizando erros antigos e dando baixa real nas pendências em modo treino livre (com persistência de ordem/rascunho em `appState.examDraftOrders`).
   - Adicionado `getEditalExamStats()` para exibir no `#global-day-summary` o total de provas com meta `≥ 8/10` e a média geral (`📈 X,X/10`), além de incluir a média geral na linha de síntese do edital em `generateReportAndSaveText()`.

---

## [2026-11-27 (Atualização 8)] — Retomada inteligente no simulado, feedback V/F contextualizado e diagnóstico do edital

### Melhorias implementadas
1. **Simulado mais fluido: retomada na próxima questão em branco, auto-avanço no Modo Foco e pausa em modais (`index.html`, `app.js`, `style.css`)**
   - Atualizada `renderExamView()` para posicionar automaticamente `examCurrentIndex` na primeira questão ainda não respondida ao retomar um rascunho em andamento (rolando até ela na lista completa ou exibindo-a direto no Modo Foco), evitando cliques repetidos ao continuar provas pausadas.
   - Adicionado o toggle persistente **⚡ Auto-avanço: ON/OFF** (`#btn-toggle-exam-autoadvance` / `appState.examAutoAdvance`) no Modo Foco (`🎯 1 por vez`), avançando automaticamente após marcar uma alternativa, além de habilitar **🧹 Limpar marcações** também quando há apenas tempo decorrido salvo.
   - Adicionada pausa automática do cronômetro ao abrir **🔍 Glossário** ou **📊 Relatório / Save** durante uma prova (`pauseExamForModal()` / `resumeExamAfterModal()`), retomando automaticamente ao fechar a janela caso não estivesse pausado manualmente.

2. **Flashcards V/F com tópico no feedback, correções de estado e gabarito conectado aos erros (`index.html`, `app.js`, `style.css`)**
   - Exibida a tag do tópico/frente (`#vf-feedback-topic`) dentro do card de feedback `#vf-feedback-box` para contextualizar imediatamente o erro ou macete ao assunto estudado.
   - Corrigidos dois bugs sutis no fluxo V/F: limpeza consistente de `lastVfUndoSnapshot` ao avançar via teclado (`Enter`/`Espaço`) e proteção em `handleFlashcardAnswer()` caso o usuário volte ao painel durante a animação de saída do cartão.
   - Adicionados o botão **📖 Abrir / Recolher comentários** (`#btn-toggle-all-explanations`) no cabeçalho do **Gabarito Comentado** e o atalho direto **🧠 Treinar Erros de Prova (N)** na tela de resultado quando houver pendências na frente.

3. **Mapa das 9 Provas com metas batidas, resumo do edital no WhatsApp e blindagem do save (`app.js`)**
   - Atualizado o título do **📚 Mapa das 9 Provas** no Dashboard para indicar também quantas provas já atingiram a meta `≥ 8/10` (`X/9 feitas • Y c/ meta ✅`).
   - Enriquecido `generateReportAndSaveText()` com uma linha de síntese global do edital (provas únicas concluídas, aprovadas com meta `≥ 8/10` e totais de erros V/F e de prova pendentes).
   - Endurecida `loadState()` para validar `dayNumber` (inteiro `>= 1`), `theme` (`'light'` | `'dark'`), `examAutoAdvance` (booleano) e `NaN` em `bestScoreToday`.

---

## [2026-11-27 (Atualização 7)] — Auto-explicação nos erros V/F, rascunho no painel e revisão mista das 3 frentes

### Melhorias implementadas
1. **Explicação automática ao errar V/F e botão "Refazer esta prova" no Gabarito do Histórico (`app.js`)**
   - Atualizada `showCardFeedback()` para expandir automaticamente o bloco `#vf-explanation-content` sempre que a resposta for incorreta (mantendo-o recolhido nos acertos), garantindo leitura imediata do macete sem clique extra, e removido o listener morto `#btn-retry-errors-now`.
   - Adicionado o botão **🔁 Refazer esta prova (treino livre)** diretamente na tela de gabarito ao abrir uma prova pelo histórico ou pelo **📚 Mapa das 9 Provas** (`isHistoryReview`), conectando a revisão de notas passadas ao treino livre sem gastar tentativas diárias.

2. **Indicador de rascunho em andamento no Painel e limpeza individual de resposta (`app.js`, `style.css`)**
   - Atualizado `renderDashboard()` para detectar rascunhos e cronômetros salvos (`examDrafts` e `examDraftTimers`) na próxima prova disponível e exibir **📝 Continuar Prova X (Y/10 • ⏱️ MM:SS)** no botão principal da frente.
   - Adicionado o botão **↺ Limpar** (`.btn-clear-question`) no cabeçalho de cada questão respondida no simulado, permitindo desmarcar uma única alternativa (atualizando rascunho, barra de progresso, pílulas e Modo Foco) sem apagar o restante da prova.

3. **Revisão Mista Geral (Sem Spoiler) entre Química, Biologia e Física (`app.js`, `style.css`)**
   - Adicionado `getTotalPendingErrorsSummary()` e os atalhos **🎯 Erros V/F (N)** e **🧠 Erros de Prova (N)** no resumo global do painel (`#global-day-summary`) sempre que houver pendências em aberto.
   - Implementados `openMixedVfErrorDrill()` e `openMixedExamErrorDrill()`, permitindo treinar em sessão única e intercalada os erros pendentes das 3 frentes (com rótulo da matéria em cada item, suporte completo a Desfazer, Embaralhar, Modo Foco, Cronômetro e baixa real em `resolvedVfErrors` / `resolvedExamErrors` na frente correta de origem).

---

## [2026-11-27 (Atualização 6)] — Resolução real nos erros V/F, mapa das 9 provas e cronômetro/foco persistentes

### Melhorias implementadas
1. **Resolução real no Treino de Erros V/F e atalho para Desfazer (`index.html`, `app.js`, `style.css`)**
   - Adicionado `resolvedVfErrors` por frente no estado salvo (`loadState()` com retrocompatibilidade total): ao dominar um cartão até a Caixa 2 no modo **🎯 Treinar Erros V/F**, ele sai da fila de pendências (e retorna automaticamente se houver novo erro no futuro).
   - Atualizados o botão **🎯 Treinar Erros V/F**, os **Pontos de atenção V/F** e o **Glossário** para diferenciar erros ainda pendentes (`⚠️`) de erros já revisados (`✅ Revisado`), preservando **↩️ Desfazer** e adicionando os atalhos `U`/`Z` na tela de feedback V/F.

2. **Mapa das 9 Provas por frente e progresso do edital no Dashboard (`app.js`, `style.css`)**
   - Adicionado em cada card do painel o resumo recolhível **📚 Mapa das 9 Provas** (`P1` a `P9`) com a melhor nota obtida em cada prova já realizada (clique direto para abrir o gabarito comentado) e bloqueio visual (`🔒` / `Próx.`) para provas ainda não feitas, mantendo zero spoiler.
   - Adicionado ao `#global-day-summary` o total de provas únicas concluídas no edital (`X/27 provas do edital`).

3. **Persistência do Modo Foco, pausa/retomada do cronômetro de rascunho e header responsivo (`index.html`, `app.js`, `style.css`)**
   - Persistida a preferência `appState.examFocusMode` (`🎯 1 por vez / 📄 Ver todas`) entre sessões e exibido o status da questão atual (`✅ Respondida` / `⏳ Em branco`) no paginador `#exam-focus-pos`.
   - Persistido o tempo decorrido dos rascunhos em `appState.examDraftTimers` (preservado ao voltar ao painel ou recarregar via `pagehide`, e zerado ao entregar ou limpar marcações), adicionado o botão **⏸️ / ▶️** (`#btn-toggle-exam-timer`, atalho `P`) e pausa automática ao ocultar a aba (`visibilitychange`).
   - Ajustado o rótulo do cabeçalho para **🔍 Glossário** e adicionada quebra responsiva em `.app-header nav` para telas estreitas.

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
