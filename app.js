/* ==========================================================================
   Revisão Ciências 8º Ano — Pantoja
   Engine: Leitner Boxes (0 -> 1 -> 2), Native Scroll-Snap Swipe, Simulado & Save JSON
   ========================================================================== */

(function () {
  'use strict';

  const STORAGE_KEY = 'pantoja_ciencias_v1';

  // Fallback for <dialog closedby="any"> when browser lacks native closedBy
  if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
    const outside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (e) => { pressedOutside = outside(e, dialog); });
      dialog.addEventListener('pointerup', (e) => { if (pressedOutside && outside(e, dialog)) dialog.close(); });
    }
  }

  // Fallback for declarative command="show-modal" if browser lacks Invoker Commands
  let examPausedByDialog = false;

  function pauseExamForModal() {
    const examView = document.getElementById('view-exam');
    if (examView && !examView.hidden && activeExamObj && !examTimerPaused) {
      pauseExamTimer();
      examPausedByDialog = true;
    }
  }

  function resumeExamAfterModal() {
    if (!examPausedByDialog) return;
    examPausedByDialog = false;
    const examView = document.getElementById('view-exam');
    if (examView && !examView.hidden && activeExamObj && examTimerPaused && !document.querySelector('dialog[open]')) {
      resumeExamTimer();
    }
  }

  const btnOpenReport = document.getElementById('btn-open-report');
  const dialogReport = document.getElementById('dialog-report');
  if (btnOpenReport && dialogReport) {
    btnOpenReport.addEventListener('click', () => {
      pauseExamForModal();
      updateReportTextarea();
      if (!dialogReport.open) {
        dialogReport.showModal();
      }
    });
  }

  const btnOpenGlossary = document.getElementById('btn-open-glossary');
  const dialogGlossary = document.getElementById('dialog-glossary');
  if (btnOpenGlossary && dialogGlossary) {
    btnOpenGlossary.addEventListener('click', () => {
      pauseExamForModal();
      renderGlossaryResults();
      if (!dialogGlossary.open) {
        dialogGlossary.showModal();
      }
      document.getElementById('glossary-search-input')?.focus();
    });
  }

  dialogGlossary?.addEventListener('close', () => {
    resumeExamAfterModal();
  });

  // Gather the 3 Science subjects
  function getSubjectsMap() {
    return {
      quimica: window.DATA_QUIMICA,
      biologia: window.DATA_BIOLOGIA,
      fisica: window.DATA_FISICA,
    };
  }

  function getTodayString() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatDateBR(isoDate) {
    const parts = (isoDate || '').split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}/${parts[1]}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function createDefaultSubjectState(subjectData) {
    const cardBoxes = {};
    const cardErrorsToday = {};
    const cardErrorsTotal = {};
    const queue = [];

    for (const c of subjectData.cards) {
      cardBoxes[c.id] = 0; // Box 0: needs 2 consecutive hits
      cardErrorsToday[c.id] = 0;
      cardErrorsTotal[c.id] = 0;
      queue.push(c.id);
    }

    return {
      vfQueue: queue,
      cardBoxes,
      cardErrorsToday,
      cardErrorsTotal,
      vfCompletedToday: false,
      examsTodayCount: 0,
      passedToday: false,
      bestScoreToday: null,
      nextExamIndex: 0, // 0 to 8
      examHistory: [], // { date, examId, examTitle, score, wrongQuestionIds }
      resolvedExamErrors: {}, // { [questionId]: true }
      resolvedVfErrors: {}, // { [cardId]: true }
    };
  }

  function loadState() {
    const subjects = getSubjectsMap();
    const today = getTodayString();
    let saved = null;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (err) {
      saved = null;
    }

    if (!saved || typeof saved !== 'object' || !saved.subjects) {
      saved = {
        student: 'Pantoja',
        grade: '8º Ano - 4º Bimestre',
        currentDay: today,
        dayNumber: 1,
        theme: 'light',
        examFocusMode: false,
        examAutoAdvance: false,
        examDrafts: {},
        examDraftFlags: {},
        examDraftTimers: {},
        subjects: {},
      };
    }
    if (typeof saved.dayNumber !== 'number' || Number.isNaN(saved.dayNumber) || saved.dayNumber < 1) {
      saved.dayNumber = 1;
    } else {
      saved.dayNumber = Math.floor(saved.dayNumber);
    }
    if (saved.theme !== 'dark' && saved.theme !== 'light') {
      saved.theme = 'light';
    }
    if (typeof saved.examFocusMode !== 'boolean') {
      saved.examFocusMode = false;
    }
    if (typeof saved.examAutoAdvance !== 'boolean') {
      saved.examAutoAdvance = false;
    }
    if (!saved.examDrafts || typeof saved.examDrafts !== 'object') {
      saved.examDrafts = {};
    }
    if (!saved.examDraftFlags || typeof saved.examDraftFlags !== 'object') {
      saved.examDraftFlags = {};
    }
    if (!saved.examDraftTimers || typeof saved.examDraftTimers !== 'object') {
      saved.examDraftTimers = {};
    }

    for (const key of Object.keys(subjects)) {
      const subjData = subjects[key];
      if (!subjData) continue;
      if (!saved.subjects[key]) {
        saved.subjects[key] = createDefaultSubjectState(subjData);
      } else {
        // Ensure all 30 cards and subject fields exist in state (handles legacy/partial saves)
        const st = saved.subjects[key];
        if (!st.cardBoxes || typeof st.cardBoxes !== 'object') st.cardBoxes = {};
        if (!st.cardErrorsToday || typeof st.cardErrorsToday !== 'object') st.cardErrorsToday = {};
        if (!st.cardErrorsTotal || typeof st.cardErrorsTotal !== 'object') st.cardErrorsTotal = {};
        if (!st.resolvedExamErrors || typeof st.resolvedExamErrors !== 'object') st.resolvedExamErrors = {};
        if (!st.resolvedVfErrors || typeof st.resolvedVfErrors !== 'object') st.resolvedVfErrors = {};
        if (!Array.isArray(st.examHistory)) st.examHistory = [];
        if (typeof st.examsTodayCount !== 'number' || Number.isNaN(st.examsTodayCount) || st.examsTodayCount < 0) st.examsTodayCount = 0;
        if (typeof st.nextExamIndex !== 'number' || Number.isNaN(st.nextExamIndex) || st.nextExamIndex < 0) {
          st.nextExamIndex = 0;
        } else {
          st.nextExamIndex = Math.floor(st.nextExamIndex);
        }
        if (typeof st.passedToday !== 'boolean') st.passedToday = false;
        if (typeof st.bestScoreToday !== 'number' || Number.isNaN(st.bestScoreToday)) st.bestScoreToday = null;
        if (typeof st.vfCompletedToday !== 'boolean') st.vfCompletedToday = false;

        for (const c of subjData.cards) {
          const rawBox = st.cardBoxes[c.id];
          st.cardBoxes[c.id] = typeof rawBox === 'number' && !Number.isNaN(rawBox)
            ? Math.min(2, Math.max(0, Math.floor(rawBox)))
            : 0;
          const rawTodayErr = st.cardErrorsToday[c.id];
          st.cardErrorsToday[c.id] = typeof rawTodayErr === 'number' && rawTodayErr > 0 ? Math.floor(rawTodayErr) : 0;
          const rawTotalErr = st.cardErrorsTotal[c.id];
          st.cardErrorsTotal[c.id] = typeof rawTotalErr === 'number' && rawTotalErr > 0 ? Math.floor(rawTotalErr) : 0;
        }
        if (!Array.isArray(st.vfQueue)) {
          rebuildQueueFromBoxes(st, subjData);
        }
      }
    }

    return saved;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (err) {
      // Ignore quota errors
    }
  }

  // Rebuild queue placing cards with higher error count and lower box first
  function rebuildQueueFromBoxes(st, subjData) {
    const pending = subjData.cards
      .filter((c) => (st.cardBoxes[c.id] || 0) < 2)
      .sort((a, b) => {
        const errDiff = (st.cardErrorsTotal[b.id] || 0) - (st.cardErrorsTotal[a.id] || 0);
        if (errDiff !== 0) return errDiff;
        return (st.cardBoxes[a.id] || 0) - (st.cardBoxes[b.id] || 0);
      })
      .map((c) => c.id);

    st.vfQueue = pending;
    st.vfCompletedToday = pending.length === 0;
  }

  function isDayFullyFinished(state) {
    if (!state || !state.subjects) return false;
    const keys = ['quimica', 'biologia', 'fisica'];
    return keys.every((k) => {
      const st = state.subjects[k];
      return st && (st.passedToday || st.examsTodayCount >= 3);
    });
  }

  function hasAnyProgressToday(state) {
    if (!state || !state.subjects) return false;
    return Object.values(state.subjects).some((st) => {
      if (!st) return false;
      if (st.examsTodayCount > 0 || st.passedToday || st.vfCompletedToday) return true;
      return Object.values(st.cardBoxes || {}).some((b) => b > 0);
    });
  }

  // Prepare next day's spaced repetition:
  // Cards she missed previously start at Box 0 (need 2 hits) and appear at the front of the queue;
  // Since the rule requires all 30 cards to be reviewed every day, we put all 30 in the queue,
  // with previous errors prioritized at the front of the deck!
  function advanceToNextDay(shouldRender = true) {
    const subjects = getSubjectsMap();
    appState.dayNumber = (appState.dayNumber || 1) + 1;
    appState.currentDay = getTodayString();

    for (const key of Object.keys(subjects)) {
      const subjData = subjects[key];
      const st = appState.subjects[key];
      if (!subjData || !st) continue;

      for (const c of subjData.cards) {
        const hadErrorYesterday = (st.cardErrorsToday[c.id] || 0) > 0;
        const totalErr = st.cardErrorsTotal[c.id] || 0;
        const isEasyMastered = Boolean(c.fastTrack) && !hadErrorYesterday;
        st.cardBoxes[c.id] = isEasyMastered ? 1 : 0;
        st.cardErrorsToday[c.id] = 0;
        c._weight = (isEasyMastered ? -50 : 0) + (hadErrorYesterday ? 20 : 0) + totalErr * 3 + Math.random();
      }

      const sortedQueue = [...subjData.cards]
        .sort((a, b) => b._weight - a._weight)
        .map((c) => c.id);

      for (const c of subjData.cards) {
        delete c._weight;
      }

      st.vfQueue = sortedQueue;
      st.vfCompletedToday = false;
      st.examsTodayCount = 0;
      st.passedToday = false;
      st.bestScoreToday = null;
    }

    appState.examDrafts = {};
    appState.examDraftFlags = {};
    appState.examDraftTimers = {};
    lastVfUndoSnapshot = null;
    saveState();
    if (shouldRender) {
      renderDashboard();
    }
  }

  function checkDailyRollover() {
    const today = getTodayString();
    if (!appState.currentDay || today <= appState.currentDay) return false;

    if (isDayFullyFinished(appState)) {
      advanceToNextDay(false);
    } else {
      // Preserve partial progress (or untouched state) when moving to a new calendar date
      appState.currentDay = today;
      saveState();
    }
    return true;
  }

  let appState = loadState();
  checkDailyRollover();
  let activeSubjectKey = null;
  let activeExamObj = null;
  let examSessionMode = 'official'; // 'official' | 'errors' | 'practice'
  let examFocusMode = Boolean(appState.examFocusMode);
  let examAutoAdvance = Boolean(appState.examAutoAdvance);
  let examAutoAdvanceTimer = null;
  let examCurrentIndex = 0;
  let examAccumulatedSeconds = 0;
  let examStartedAt = null;
  let examTimerPaused = false;
  let examTimerInterval = null;
  let lastVfUndoSnapshot = null;
  let vfSession = { mode: 'daily', cards: null, queue: [], boxes: {} };

  function formatDuration(totalSeconds) {
    const secs = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }

  function getCurrentExamDraftKey() {
    return activeSubjectKey && activeExamObj ? `${activeSubjectKey}:${activeExamObj.id}` : '';
  }

  function getElapsedExamSeconds() {
    if (examTimerPaused || !examStartedAt) return examAccumulatedSeconds;
    return examAccumulatedSeconds + Math.max(0, Math.floor((Date.now() - examStartedAt) / 1000));
  }

  function updateExamTimerBadge() {
    const badge = document.getElementById('exam-timer-badge');
    const stateIcon = document.getElementById('exam-timer-state');
    const btn = document.getElementById('btn-toggle-exam-timer');
    const elapsed = getElapsedExamSeconds();
    if (badge) {
      badge.textContent = `⏱️ ${formatDuration(elapsed)}`;
    }
    if (stateIcon) {
      stateIcon.textContent = examTimerPaused ? '▶️' : '⏸️';
    }
    if (btn) {
      btn.classList.toggle('is-paused', examTimerPaused);
      btn.setAttribute('aria-pressed', examTimerPaused ? 'true' : 'false');
      btn.title = examTimerPaused
        ? 'Cronômetro pausado — clique ou aperte P para retomar'
        : 'Pausar cronômetro (atalho P)';
    }
  }

  function persistExamDraftTimer() {
    const draftKey = getCurrentExamDraftKey();
    if (!draftKey) return;
    if (!appState.examDraftTimers || typeof appState.examDraftTimers !== 'object') {
      appState.examDraftTimers = {};
    }
    appState.examDraftTimers[draftKey] = getElapsedExamSeconds();
    saveState();
  }

  function startExamTimer(initialSeconds = 0) {
    stopExamTimer();
    examAccumulatedSeconds = Math.max(0, Math.floor(Number(initialSeconds) || 0));
    examTimerPaused = false;
    examStartedAt = Date.now();
    updateExamTimerBadge();
    examTimerInterval = setInterval(updateExamTimerBadge, 1000);
  }

  function pauseExamTimer() {
    if (examTimerPaused) return;
    examAccumulatedSeconds = getElapsedExamSeconds();
    examStartedAt = null;
    examTimerPaused = true;
    stopExamTimer();
    persistExamDraftTimer();
    updateExamTimerBadge();
  }

  function resumeExamTimer() {
    if (!examTimerPaused && examTimerInterval) return;
    examTimerPaused = false;
    examStartedAt = Date.now();
    updateExamTimerBadge();
    if (!examTimerInterval) {
      examTimerInterval = setInterval(updateExamTimerBadge, 1000);
    }
  }

  function stopExamTimer() {
    if (examTimerInterval) {
      clearInterval(examTimerInterval);
      examTimerInterval = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    const examView = document.getElementById('view-exam');
    if (document.hidden) {
      if (examView && !examView.hidden && activeExamObj && !examTimerPaused) {
        pauseExamTimer();
      }
      return;
    }
    if (checkDailyRollover()) {
      const dashView = document.getElementById('view-dashboard');
      if (dashView && !dashView.hidden) {
        renderDashboard();
      }
    }
  });

  window.addEventListener('pagehide', () => {
    const examView = document.getElementById('view-exam');
    if (examView && !examView.hidden && activeExamObj) {
      persistExamDraftTimer();
    }
  });

  // Apply theme
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    appState.theme = theme;
    saveState();
  }

  applyTheme(appState.theme || 'light');

  document.getElementById('btn-theme-toggle').addEventListener('click', () => {
    const next = appState.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });

  function clearExamAutoAdvanceTimer() {
    if (examAutoAdvanceTimer) {
      clearTimeout(examAutoAdvanceTimer);
      examAutoAdvanceTimer = null;
    }
  }

  // Views switcher
  function showView(viewId, scrollToTop = true) {
    const examView = document.getElementById('view-exam');
    if (viewId !== 'view-exam') {
      clearExamAutoAdvanceTimer();
      examPausedByDialog = false;
      if (examView && !examView.hidden && activeExamObj) {
        examAccumulatedSeconds = getElapsedExamSeconds();
        examStartedAt = null;
        persistExamDraftTimer();
      }
      stopExamTimer();
    }
    const views = ['view-dashboard', 'view-flashcards', 'view-exam', 'view-exam-result'];
    for (const id of views) {
      const el = document.getElementById(id);
      if (el) el.hidden = id !== viewId;
    }
    if (scrollToTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ==========================================================================
  // DASHBOARD RENDERING
  // ==========================================================================
  function findExamQuestion(subjData, examId, wrongItem) {
    if (!subjData || !Array.isArray(subjData.exams)) return null;
    const exam = subjData.exams.find((ex) => ex.id === examId);
    if (!exam || !Array.isArray(exam.questions)) return null;
    if (wrongItem.id) {
      const byId = exam.questions.find((q) => q.id === wrongItem.id);
      if (byId) return byId;
    }
    const idx = Number(wrongItem.number) - 1;
    return Number.isInteger(idx) && idx >= 0 && idx < exam.questions.length ? exam.questions[idx] : null;
  }

  function getExamQuestionKey(question, fallbackExamId, fallbackNumber) {
    return question?.id || `${fallbackExamId}#${fallbackNumber}`;
  }

  function getPendingExamErrorQuestions(subjData, st) {
    if (!subjData || !st || !Array.isArray(st.examHistory)) return [];
    const resolved = st.resolvedExamErrors || {};
    const collected = new Map();

    for (const h of st.examHistory) {
      const wrongList = Array.isArray(h.wrongQuestions) ? h.wrongQuestions : [];
      for (const w of wrongList) {
        const q = findExamQuestion(subjData, h.examId, w);
        if (!q) continue;
        const qKey = getExamQuestionKey(q, h.examId, w.number);
        if (resolved[qKey]) continue;
        if (!collected.has(qKey)) {
          collected.set(qKey, {
            ...q,
            _errorKey: qKey,
            _sourceExamTitle: h.examTitle,
          });
        }
      }
    }
    return Array.from(collected.values());
  }

  function getPendingVfErrorCards(subjData, st) {
    if (!subjData || !st) return [];
    const resolved = st.resolvedVfErrors || {};
    return subjData.cards
      .filter((c) => (st.cardErrorsTotal[c.id] || 0) > 0 && !resolved[c.id])
      .sort((a, b) => (st.cardErrorsTotal[b.id] || 0) - (st.cardErrorsTotal[a.id] || 0));
  }

  function getTotalPendingErrorsSummary() {
    const subjects = getSubjectsMap();
    let pendingVf = 0;
    let pendingExam = 0;
    for (const k of ['quimica', 'biologia', 'fisica']) {
      const subj = subjects[k];
      const st = appState.subjects[k];
      if (!subj || !st) continue;
      pendingVf += getPendingVfErrorCards(subj, st).length;
      pendingExam += getPendingExamErrorQuestions(subj, st).length;
    }
    return { pendingVf, pendingExam };
  }

  function renderDashboard() {
    const subjects = getSubjectsMap();
    const container = document.getElementById('subject-cards-container');
    const dateLabel = document.getElementById('today-date-label');
    if (dateLabel) {
      dateLabel.textContent = `Dia ${appState.dayNumber || 1} (${formatDateBR(appState.currentDay)})`;
    }

    const globalSummaryEl = document.getElementById('global-day-summary');
    if (globalSummaryEl) {
      const subjectKeys = ['quimica', 'biologia', 'fisica'];
      let totalCardsAll = 0;
      let totalMasteredAll = 0;
      let totalHitsAll = 0;
      let passedSubjects = 0;
      let totalExamsToday = 0;
      let totalUniqueExams = 0;
      let doneUniqueExams = 0;

      for (const k of subjectKeys) {
        const subj = subjects[k];
        const st = appState.subjects[k];
        if (!subj || !st) continue;
        totalCardsAll += subj.cards.length;
        for (const c of subj.cards) {
          const b = st.cardBoxes[c.id] || 0;
          if (b >= 2) totalMasteredAll++;
          totalHitsAll += Math.min(2, b);
        }
        if (st.passedToday) passedSubjects++;
        totalExamsToday += st.examsTodayCount || 0;
        totalUniqueExams += subj.exams.length;
        doneUniqueExams += subj.exams.filter((ex) =>
          (st.examHistory || []).some((h) => h.examId === ex.id || h.examTitle === ex.title)
        ).length;
      }

      const { pendingVf: totalPendingVfErrors, pendingExam: totalPendingExamErrors } = getTotalPendingErrorsSummary();
      const mixedActionsHtml = (totalPendingVfErrors > 0 || totalPendingExamErrors > 0)
        ? `<div class="global-mixed-actions">
            <small class="muted-text">🌐 <strong>Revisão mista (3 frentes):</strong></small>
            ${totalPendingVfErrors > 0 ? `<button type="button" class="outline secondary btn-xs" id="btn-mixed-vf-errors">🎯 Erros V/F (${totalPendingVfErrors})</button>` : ''}
            ${totalPendingExamErrors > 0 ? `<button type="button" class="outline secondary btn-xs" id="btn-mixed-exam-errors">🧠 Erros de Prova (${totalPendingExamErrors})</button>` : ''}
          </div>`
        : '';

      const maxSteps = totalCardsAll * 2 + subjectKeys.length * 2;
      const doneSteps = totalHitsAll + passedSubjects * 2;
      globalSummaryEl.innerHTML = `
        <div class="global-progress-row">
          <span>🎯 <strong>Meta geral do dia:</strong> ${passedSubjects}/${subjectKeys.length} frentes aprovadas</span>
          <span>🃏 <strong>${totalMasteredAll}/${totalCardsAll}</strong> V/F • 📝 <strong>${totalExamsToday}</strong> hoje • 📚 <strong>${doneUniqueExams}/${totalUniqueExams}</strong> provas do edital</span>
        </div>
        <progress value="${doneSteps}" max="${maxSteps}"></progress>
        ${mixedActionsHtml}
      `;
      document.getElementById('btn-mixed-vf-errors')?.addEventListener('click', () => openMixedVfErrorDrill());
      document.getElementById('btn-mixed-exam-errors')?.addEventListener('click', () => openMixedExamErrorDrill());
    }

    const nextDayBanner = document.getElementById('next-day-banner');
    if (nextDayBanner) {
      const finished = isDayFullyFinished(appState);
      nextDayBanner.hidden = !finished;
      if (finished) {
        const currentNum = appState.dayNumber || 1;
        const nextNum = currentNum + 1;
        const titleEl = document.getElementById('next-day-banner-title');
        const textEl = document.getElementById('next-day-banner-text');
        const btnNext = document.getElementById('btn-dashboard-next-day');
        if (titleEl) titleEl.textContent = `🏆 Dia ${currentNum} concluído com sucesso!`;
        if (textEl) textEl.textContent = `Amanhã o app vira sozinho para o Dia ${nextNum} (30 novos cards focados nos seus erros + próxima prova). Se quiser começar ou testar agora, clique ao lado.`;
        if (btnNext) btnNext.textContent = `🌅 Iniciar Dia ${nextNum} Agora`;
      }
    }

    container.innerHTML = '';

    for (const key of ['quimica', 'biologia', 'fisica']) {
      const subj = subjects[key];
      if (!subj) continue;
      const st = appState.subjects[key];

      const totalCards = subj.cards.length;
      let masteredCount = 0;
      let totalHits = 0;
      for (const c of subj.cards) {
        const b = st.cardBoxes[c.id] || 0;
        if (b >= 2) masteredCount++;
        totalHits += Math.min(2, b);
      }

      const vfDone = masteredCount === totalCards;
      if (vfDone && !st.vfCompletedToday) {
        st.vfCompletedToday = true;
        saveState();
      }
      const vfUnlocked = st.vfCompletedToday || vfDone;

      let chipClass = 'chip-pending';
      let chipText = 'Pendente';
      if (st.passedToday) {
        chipClass = 'chip-done';
        chipText = `Meta Batida (${st.bestScoreToday}/10) ✅`;
      } else if (st.examsTodayCount >= 3) {
        chipClass = 'chip-progress';
        chipText = `3/3 Provas Hoje (Melhor: ${st.bestScoreToday ?? 0}/10)`;
      } else if (vfUnlocked || totalHits > 0) {
        chipClass = 'chip-progress';
        chipText = 'Em Andamento';
      }

      const nextExamIdx = st.nextExamIndex % subj.exams.length;
      const nextExamNum = nextExamIdx + 1;
      const nextExamObj = subj.exams[nextExamIdx];
      const nextDraftKey = nextExamObj ? `${key}:${nextExamObj.id}` : '';
      const nextDraftMap = (nextDraftKey && appState.examDrafts && appState.examDrafts[nextDraftKey]) || {};
      const nextDraftAnswered = Object.values(nextDraftMap).filter((v) => v !== undefined && v !== null && v !== '').length;
      const nextDraftTimer = (nextDraftKey && Number(appState.examDraftTimers?.[nextDraftKey])) || 0;
      const hasNextDraft = nextDraftAnswered > 0 || nextDraftTimer > 0;
      const canTakeExam = vfUnlocked && !st.passedToday && st.examsTodayCount < 3;
      const pendingExamErrorsCount = getPendingExamErrorQuestions(subj, st).length;
      const pendingVfErrorsCount = getPendingVfErrorCards(subj, st).length;
      const totalCardErrors = Object.values(st.cardErrorsTotal || {}).reduce((acc, n) => acc + (n || 0), 0);
      const topAttentionCards = subj.cards
        .filter((c) => (st.cardErrorsTotal[c.id] || 0) > 0)
        .sort((a, b) => {
          const aPending = !(st.resolvedVfErrors && st.resolvedVfErrors[a.id]);
          const bPending = !(st.resolvedVfErrors && st.resolvedVfErrors[b.id]);
          if (aPending !== bPending) return Number(bPending) - Number(aPending);
          return (st.cardErrorsTotal[b.id] || 0) - (st.cardErrorsTotal[a.id] || 0);
        })
        .slice(0, 5);
      const attentionHtml = topAttentionCards.length > 0
        ? `
          <details class="exam-history-details">
            <summary>🎯 Pontos de atenção V/F (${topAttentionCards.length})</summary>
            <ul class="exam-history-list">
              ${topAttentionCards
                .map((c) => {
                  const isVfResolved = Boolean(st.resolvedVfErrors && st.resolvedVfErrors[c.id]);
                  return `
                  <li>
                    <details class="attention-card-details">
                      <summary>
                        <span>${escapeHtml(c.topic)}</span>
                        <span class="attention-count-tag${isVfResolved ? ' is-resolved' : ''}">${isVfResolved ? '✅ Revisado' : `${escapeHtml(st.cardErrorsTotal[c.id])}x erro(s)`} ▾</span>
                      </summary>
                      <div class="attention-card-body">
                        <p><strong>Afirmação (${c.answer ? 'V' : 'F'}):</strong> ${escapeHtml(c.statement)}</p>
                        <p class="muted-text">${escapeHtml(c.explanation)}</p>
                      </div>
                    </details>
                  </li>
                `;
                })
                .join('')}
            </ul>
          </details>
        `
        : '';

      const bestByExamId = new Map();
      (st.examHistory || []).forEach((h, idx) => {
        const matchedExam = subj.exams.find((ex) => ex.id === h.examId) || subj.exams.find((ex) => ex.title === h.examTitle);
        if (!matchedExam) return;
        const prev = bestByExamId.get(matchedExam.id);
        if (!prev || h.score > prev.score || (h.score === prev.score && idx > prev._idx)) {
          bestByExamId.set(matchedExam.id, { ...h, _idx: idx });
        }
      });
      const completedExamsCount = subj.exams.filter((ex) => bestByExamId.has(ex.id)).length;
      const passedExamsCount = subj.exams.filter((ex) => (bestByExamId.get(ex.id)?.score ?? -1) >= 8).length;
      const examMapHtml = `
        <details class="exam-history-details">
          <summary>📚 Mapa das ${subj.exams.length} Provas (${completedExamsCount}/${subj.exams.length} feitas${completedExamsCount > 0 ? ` • ${passedExamsCount} c/ meta ✅` : ''})</summary>
          <div class="exam-map-grid">
            ${subj.exams
              .map((ex, idx) => {
                const best = bestByExamId.get(ex.id);
                if (best) {
                  const pillCls = best.score >= 8 ? 'is-passed' : 'is-tried';
                  return `<button type="button" class="exam-map-pill ${pillCls}" data-action="review-history-exam" data-subject="${key}" data-history-index="${best._idx}" title="${escapeHtml(ex.title)}: melhor nota ${best.score}/10 (clique para abrir gabarito)"><span>P${idx + 1}</span><small>${best.score}/10</small></button>`;
                }
                const isNext = idx === (st.nextExamIndex % subj.exams.length);
                return `<button type="button" class="exam-map-pill${isNext ? ' is-next' : ''}" disabled title="${escapeHtml(ex.title)}: aguardando realização (sem spoiler)"><span>P${idx + 1}</span><small>${isNext ? 'Próx.' : '🔒'}</small></button>`;
              })
              .join('')}
          </div>
        </details>
      `;

      const letters = ['A', 'B', 'C', 'D'];
      const historyList = (st.examHistory || [])
        .map((h, idx) => ({ ...h, _idx: idx }))
        .reverse();
      const historyHtml = historyList.length > 0
        ? `
          <details class="exam-history-details">
            <summary>📜 Histórico de provas (${historyList.length})</summary>
            <ul class="exam-history-list">
              ${historyList
                .map((h) => {
                  const wrongList = Array.isArray(h.wrongQuestions) ? h.wrongQuestions : [];
                  const wrongNums = wrongList.map((w) => `Q${escapeHtml(w.number)}`).join(', ');
                  const wrongDetailsHtml = wrongList.length > 0
                    ? `
                      <details class="history-wrong-details">
                        <summary>Erros: ${wrongNums} (ver revisão)</summary>
                        <ul class="history-wrong-list">
                          ${wrongList
                            .map((w) => {
                              const fullQ = findExamQuestion(subj, h.examId, w);
                              const markedIdx = Array.isArray(h.userAnswers) ? h.userAnswers[Number(w.number) - 1] : null;
                              const userAnsLine = fullQ && typeof markedIdx === 'number' && fullQ.options[markedIdx] !== undefined
                                ? `<p><strong>Sua resposta:</strong> ${letters[markedIdx]}) ${escapeHtml(fullQ.options[markedIdx])}</p>`
                                : '';
                              const ansLine = fullQ
                                ? `<p><strong>Gabarito:</strong> ${letters[fullQ.correct]}) ${escapeHtml(fullQ.options[fullQ.correct])}</p><p class="muted-text">${escapeHtml(fullQ.explanation)}</p>`
                                : '';
                              return `
                                <li>
                                  <strong>Q${escapeHtml(w.number)}:</strong> ${escapeHtml(w.text)}
                                  ${userAnsLine}
                                  ${ansLine}
                                </li>
                              `;
                            })
                            .join('')}
                        </ul>
                      </details>
                    `
                    : '';
                  const durationPart = typeof h.durationSeconds === 'number' && h.durationSeconds > 0
                    ? ` • ⏱️ ${formatDuration(h.durationSeconds)}`
                    : '';
                  return `
                  <li>
                    <div class="history-item-main">
                      <span>Dia ${escapeHtml(h.dayNumber || 1)} • ${escapeHtml(h.examTitle)}${durationPart}</span>
                      ${wrongDetailsHtml}
                    </div>
                    <div class="history-item-side">
                      <strong>${escapeHtml(h.score)}/10 ${h.passed ? '✅' : '⚠️'}</strong>
                      <div class="history-item-side-actions">
                        <button type="button" class="outline secondary btn-xs" data-action="review-history-exam" data-subject="${key}" data-history-index="${h._idx}">
                          🔍 Gabarito
                        </button>
                        <button type="button" class="outline secondary btn-xs" data-action="retake-history-exam" data-subject="${key}" data-history-index="${h._idx}">
                          🔁 Refazer
                        </button>
                      </div>
                    </div>
                  </li>
                `;
                })
                .join('')}
            </ul>
          </details>
        `
        : '';

      const cardEl = document.createElement('article');
      cardEl.className = 'subject-card';
      cardEl.dataset.subject = key;

      cardEl.innerHTML = `
        <div>
          <header>
            <div class="subject-header-row">
              <h3>${escapeHtml(subj.title)}</h3>
              <span class="status-chip ${chipClass}">${escapeHtml(chipText)}</span>
            </div>
            <small class="subject-subtitle">${escapeHtml(subj.subtitle)}</small>
          </header>

          <div class="step-box">
            <div class="step-row">
              <span><strong>a) 30 Flashcards V/F</strong> (2 acertos cada)</span>
              <span><strong>${masteredCount}/${totalCards}</strong> ${vfUnlocked ? '✅' : ''}</span>
            </div>
            <progress value="${totalHits}" max="${totalCards * 2}"></progress>
            <div class="step-row">
              <span><strong>b) Provas no dia</strong> (meta ≥ 8/10)</span>
              <span><strong>${st.examsTodayCount}/3</strong> tentativas</span>
            </div>
            <div class="step-row">
              <span>Melhor nota de hoje:</span>
              <strong>${st.bestScoreToday !== null ? `${st.bestScoreToday} / 10` : '—'}</strong>
            </div>
            ${
              totalCardErrors > 0
                ? `<div class="step-row"><span>Erros acumulados V/F:</span><strong>${totalCardErrors}</strong></div>`
                : ''
            }
          </div>
          ${examMapHtml}
          ${attentionHtml}
          ${historyHtml}
        </div>

        <div class="subject-actions">
          <button type="button" class="${vfDone ? 'outline secondary' : 'primary'}" data-action="start-vf" data-subject="${key}">
            ${vfDone ? '🔄 Revisar 30 V/F Novamente' : `🃏 Revisar Cartões V/F (${masteredCount}/30)`}
          </button>
          ${
            pendingVfErrorsCount > 0
              ? `<button type="button" class="outline secondary" data-action="start-vf-errors" data-subject="${key}">
                  🎯 Treinar Erros V/F (${pendingVfErrorsCount})
                </button>`
              : ''
          }
          <button type="button" class="${canTakeExam ? 'primary' : 'outline secondary'}" data-action="start-exam" data-subject="${key}" ${!canTakeExam ? 'disabled' : ''}>
            ${
              st.passedToday
                ? `🏆 Concluído Hoje (Nota ${st.bestScoreToday}/10)`
                : st.examsTodayCount >= 3
                ? '🔒 Limite de 3 Provas Hoje Atingido'
                : !vfUnlocked
                ? '🔒 Fazer Prova (Conclua os 30 V/F antes)'
                : hasNextDraft
                ? `📝 Continuar Prova ${nextExamNum} (${nextDraftAnswered}/${nextExamObj.questions.length}${nextDraftTimer > 0 ? ` • ⏱️ ${formatDuration(nextDraftTimer)}` : ''})`
                : `📝 Fazer Prova ${nextExamNum} (Tentativa ${st.examsTodayCount + 1}/3)`
            }
          </button>
          ${
            pendingExamErrorsCount > 0
              ? `<button type="button" class="outline secondary" data-action="start-exam-errors" data-subject="${key}">
                  🧠 Treinar Erros de Prova (${pendingExamErrorsCount})
                </button>`
              : ''
          }
        </div>
      `;

      container.appendChild(cardEl);
    }
  }

  document.getElementById('subject-cards-container').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const subjKey = btn.dataset.subject;

    if (action === 'start-vf') {
      openFlashcards(subjKey, 'daily');
    } else if (action === 'start-vf-errors') {
      openFlashcards(subjKey, 'errors');
    } else if (action === 'start-exam') {
      openExam(subjKey);
    } else if (action === 'start-exam-errors') {
      openExamErrorDrill(subjKey);
    } else if (action === 'review-history-exam') {
      openHistoryExamResult(subjKey, Number(btn.dataset.historyIndex));
    } else if (action === 'retake-history-exam') {
      openHistoryExamPractice(subjKey, Number(btn.dataset.historyIndex));
    }
  });

  // ==========================================================================
  // FLASHCARDS V/F & NATIVE SCROLL-SNAP SWIPE (swipe-to-remove pattern)
  // ==========================================================================
  const needsScrollWorkaround = typeof CSS !== 'undefined' && !CSS.supports('scroll-initial-target', 'nearest');
  const swipeObservers = new WeakMap();

  const trackResizeObserver = needsScrollWorkaround
    ? new ResizeObserver((entries) => {
        for (const entry of entries) {
          entry.target.scrollLeft = entry.target.clientWidth;
        }
      })
    : null;

  const viewportObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const item = entry.target;
      if (entry.isIntersecting) {
        const handle = swipeObservers.get(item) ?? setupSwipeItem(item);
        handle.observer.observe(handle.content);
      } else {
        const handle = swipeObservers.get(item);
        if (handle) handle.observer.unobserve(handle.content);
      }
    }
  });

  function setupSwipeItem(item) {
    const track = item.querySelector('.SwipeableList-track');
    const content = track.querySelector('.SwipeableList-content');

    item.classList.add('is-initialized');

    if (needsScrollWorkaround) {
      track.scrollLeft = track.clientWidth;
      trackResizeObserver.observe(track);
    }

    const activateThreshold = 0.82;
    const commitThreshold = 0.25;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries.at(-1);
      const ratio = entry.intersectionRatio;

      // Positive offset means user pulled card RIGHT (revealing left green spacer = VERDADEIRO)
      // Negative offset means user pulled card LEFT (revealing right red spacer = FALSO)
      const direction = (entry.boundingClientRect.x - entry.rootBounds.x) > 0
        ? 'left'
        : 'right';

      if (ratio < commitThreshold) {
        commit(direction, entry);
        return;
      }

      item.classList.toggle('is-activating', ratio < activateThreshold);

      if (entry.boundingClientRect.x !== entry.rootBounds.x) {
        item.dataset.swipeDirection = direction;
      }
    }, {
      root: track,
      threshold: [commitThreshold, activateThreshold],
    });

    function commit(direction, entry) {
      if (item.classList.contains('is-removing')) return;
      viewportObserver.unobserve(item);
      if (needsScrollWorkaround) trackResizeObserver.unobserve(track);
      observer.disconnect();
      // direction === 'left' means left spacer revealed (user swiped RIGHT -> VERDADEIRO)
      // direction === 'right' means right spacer revealed (user swiped LEFT -> FALSO)
      const userAnswer = direction === 'left';
      animateAndAnswerCard(item, content, direction, entry, userAnswer);
    }

    const handle = { observer, content, track, commit };
    swipeObservers.set(item, handle);
    return handle;
  }

  async function animateAndAnswerCard(item, content, direction, entry, userAnswer) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const opts = { duration: reduce ? 120 : 240, easing: 'ease', fill: 'forwards' };

    const rect = entry.boundingClientRect;
    const x = rect.x - entry.rootBounds.x;
    const translate = direction === 'left'
      ? rect.width - x
      : -(x + rect.width);

    item.classList.add('is-removing');
    item.animate([{ height: `${rect.height}px` }, { height: '0px' }], opts);
    if (!reduce) {
      content.animate([{ translate: `${translate}px` }], opts);
    }
    await Promise.allSettled(
      item.getAnimations({ subtree: true }).map((a) => a.finished)
    );

    if (globalThis.GestureEvent) {
      item.inert = true;
      setTimeout(() => item.remove(), 5000);
    } else {
      item.remove();
    }

    handleFlashcardAnswer(userAnswer);
  }

  // Set up list delegation and MutationObserver once
  const vfSwipeList = document.getElementById('vf-swipe-list');
  if (vfSwipeList) {
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && node.matches('.SwipeableList-item')) {
            viewportObserver.observe(node);
          }
        }
      }
    }).observe(vfSwipeList, { childList: true });

    vfSwipeList.addEventListener('click', (event) => {
      const button = event.target.closest('.SwipeableList-action');
      const item = button?.closest('.SwipeableList-item');
      if (!item) return;
      const handle = swipeObservers.get(item) ?? setupSwipeItem(item);
      handle.commit(button.dataset.direction, {
        boundingClientRect: handle.content.getBoundingClientRect(),
        rootBounds: handle.track.getBoundingClientRect(),
      });
    });
  }

  function getVfCardSubjectKey(cardObj) {
    return cardObj?._subjKey || activeSubjectKey;
  }

  function getVfRuntime() {
    const subj = getSubjectsMap()[activeSubjectKey] || { title: 'Revisão Mista', cards: [] };
    const st = appState.subjects[activeSubjectKey] || null;
    if ((vfSession.mode === 'errors' || vfSession.mode === 'mixed-errors') && Array.isArray(vfSession.cards) && vfSession.cards.length > 0) {
      return {
        subj,
        st,
        isErrorMode: true,
        isMixedErrorMode: vfSession.mode === 'mixed-errors',
        cards: vfSession.cards,
        queue: vfSession.queue,
        setQueue: (q) => { vfSession.queue = q; },
        boxes: vfSession.boxes,
      };
    }
    return {
      subj,
      st,
      isErrorMode: false,
      isMixedErrorMode: false,
      cards: subj.cards,
      queue: st.vfQueue || [],
      setQueue: (q) => { st.vfQueue = q; },
      boxes: st.cardBoxes,
    };
  }

  function openMixedVfErrorDrill() {
    const subjects = getSubjectsMap();
    const mixedCards = [];
    for (const key of ['quimica', 'biologia', 'fisica']) {
      const subj = subjects[key];
      const st = appState.subjects[key];
      if (!subj || !st) continue;
      for (const c of getPendingVfErrorCards(subj, st)) {
        mixedCards.push({ ...c, _subjKey: key, _subjTitle: subj.title });
      }
    }

    if (mixedCards.length === 0) {
      showToast('🎉 Não há erros V/F pendentes nas 3 frentes!');
      return;
    }

    mixedCards.sort((a, b) => {
      const errA = appState.subjects[a._subjKey]?.cardErrorsTotal[a.id] || 0;
      const errB = appState.subjects[b._subjKey]?.cardErrorsTotal[b.id] || 0;
      return errB - errA;
    });

    activeSubjectKey = 'mixed';
    lastVfUndoSnapshot = null;
    vfSession = {
      mode: 'mixed-errors',
      cards: mixedCards,
      queue: mixedCards.map((c) => c.id),
      boxes: Object.fromEntries(mixedCards.map((c) => [c.id, 0])),
    };

    document.getElementById('vf-subject-title').textContent = 'Revisão Mista — Erros V/F';
    const modeLabel = document.getElementById('vf-mode-label');
    if (modeLabel) {
      modeLabel.textContent = `🌐 Foco em ${mixedCards.length} card(s) pendente(s) nas 3 frentes • Progresso diário preservado`;
      modeLabel.hidden = false;
    }
    document.getElementById('vf-feedback-box').hidden = true;
    showView('view-flashcards');
    renderCurrentFlashcard();
  }

  function openFlashcards(subjKey, mode = 'daily') {
    activeSubjectKey = subjKey;
    lastVfUndoSnapshot = null;
    const subj = getSubjectsMap()[subjKey];
    const st = appState.subjects[subjKey];
    const modeLabel = document.getElementById('vf-mode-label');

    if (mode === 'errors') {
      const errorCards = getPendingVfErrorCards(subj, st);

      if (errorCards.length > 0) {
        vfSession = {
          mode: 'errors',
          cards: errorCards,
          queue: errorCards.map((c) => c.id),
          boxes: Object.fromEntries(errorCards.map((c) => [c.id, 0])),
        };
        document.getElementById('vf-subject-title').textContent = `${subj.title} — Treino de Erros`;
        if (modeLabel) {
          modeLabel.textContent = `🎯 Foco em ${errorCards.length} card(s) pendente(s) • Progresso diário preservado`;
          modeLabel.hidden = false;
        }
        document.getElementById('vf-feedback-box').hidden = true;
        showView('view-flashcards');
        renderCurrentFlashcard();
        return;
      }
      showToast('🎉 Não há erros V/F pendentes nesta frente!');
      return;
    }

    vfSession = { mode: 'daily', cards: null, queue: [], boxes: {} };

    // If all 30 are already mastered and she clicked "Revisar Novamente", reset boxes to 0 for a fresh practice
    const allMastered = subj.cards.every((c) => (st.cardBoxes[c.id] || 0) >= 2);
    if (allMastered) {
      st.vfCompletedToday = true;
      for (const c of subj.cards) {
        st.cardBoxes[c.id] = 0;
      }
      rebuildQueueFromBoxes(st, subj);
      // Keep daily unlock active once 30/30 was already completed today
      st.vfCompletedToday = true;
      saveState();
    } else if (!st.vfQueue || st.vfQueue.length === 0) {
      rebuildQueueFromBoxes(st, subj);
      saveState();
    }

    document.getElementById('vf-subject-title').textContent = `${subj.title} — 30 V/F`;
    if (modeLabel) {
      if (st.vfCompletedToday && !subj.cards.every((c) => (st.cardBoxes[c.id] || 0) >= 2)) {
        modeLabel.textContent = '🔄 Revisão extra • Provas do dia continuam liberadas';
        modeLabel.hidden = false;
      } else {
        modeLabel.textContent = '';
        modeLabel.hidden = true;
      }
    }
    document.getElementById('vf-feedback-box').hidden = true;
    showView('view-flashcards');
    renderCurrentFlashcard();
  }

  function updateLeitnerCounters() {
    const { cards, queue, boxes } = getVfRuntime();
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let totalPoints = 0;

    for (const c of cards) {
      const box = boxes[c.id] || 0;
      if (box === 0) b0++;
      else if (box === 1) b1++;
      else b2++;
      totalPoints += Math.min(2, box);
    }

    document.getElementById('count-box-0').textContent = b0;
    document.getElementById('count-box-1').textContent = b1;
    document.getElementById('count-box-2').textContent = b2;
    document.getElementById('vf-counter-badge').textContent = `${b2} / ${cards.length} dominados`;
    const queueBadge = document.getElementById('vf-queue-badge');
    if (queueBadge) {
      const qLen = queue.filter((id) => (boxes[id] || 0) < 2).length;
      queueBadge.textContent = `Fila: ${qLen}`;
    }

    const prog = document.getElementById('vf-progress-bar');
    prog.max = cards.length * 2;
    prog.value = totalPoints;
  }

  function pulseLeitnerBox(boxNum) {
    const boxEl = document.querySelector(`.leitner-box.box-${boxNum}`);
    if (!boxEl) return;
    boxEl.classList.remove('is-pulse');
    void boxEl.offsetWidth;
    boxEl.classList.add('is-pulse');
  }

  function renderCurrentFlashcard() {
    updateLeitnerCounters();
    const { subj, st, isErrorMode, isMixedErrorMode, cards, queue, setQueue, boxes } = getVfRuntime();
    const listEl = document.getElementById('vf-swipe-list');
    const feedbackBox = document.getElementById('vf-feedback-box');
    const swipeHint = document.getElementById('vf-swipe-hint');
    const keyboardHint = document.getElementById('vf-keyboard-hint');

    listEl.innerHTML = '';
    feedbackBox.hidden = true;

    // Filter queue to ensure only cards with box < 2 remain
    const filteredQueue = queue.filter((id) => (boxes[id] || 0) < 2);
    setQueue(filteredQueue);

    const shuffleBtn = document.getElementById('btn-shuffle-vf');
    if (shuffleBtn) {
      shuffleBtn.disabled = filteredQueue.length <= 1;
    }
    const undoBtn = document.getElementById('btn-undo-vf');
    if (undoBtn) {
      undoBtn.hidden = true;
    }

    if (filteredQueue.length === 0) {
      if (swipeHint) swipeHint.hidden = true;
      if (keyboardHint) keyboardHint.hidden = true;
      if (!isErrorMode && st) {
        st.vfCompletedToday = true;
        saveState();
      }

      const canTakeExamNow = !isMixedErrorMode && st && st.vfCompletedToday && !st.passedToday && st.examsTodayCount < 3;
      const pendingVfErrorsCount = !isMixedErrorMode && st ? getPendingVfErrorCards(subj, st).length : 0;

      const doneLi = document.createElement('li');
      if (isErrorMode) {
        doneLi.innerHTML = `
          <article style="text-align:center; padding: 2rem 1.25rem; border-top: 5px solid var(--vf-true-color);">
            <h2>🎯 ${isMixedErrorMode ? 'Revisão mista de erros concluída!' : 'Treino de erros concluído!'}</h2>
            <p>Você dominou e deu baixa em todos os <strong>${cards.length} cartões pendentes ${isMixedErrorMode ? 'das 3 frentes' : `de ${escapeHtml(subj.title)}`}</strong>.</p>
            <p class="muted-text" style="margin-bottom: 1.25rem;">Seu progresso principal no painel foi mantido intacto e esses erros saíram da lista de pendências.</p>
            <div class="grid">
              ${
                canTakeExamNow
                  ? '<button type="button" class="primary" id="btn-go-to-exam-now">📝 Ir para a Prova Agora</button>'
                  : ''
              }
              <button type="button" class="outline secondary" id="btn-done-back-dash">← Voltar ao Painel</button>
            </div>
          </article>
        `;
      } else {
        doneLi.innerHTML = `
          <article style="text-align:center; padding: 2rem 1.25rem; border-top: 5px solid var(--vf-true-color);">
            <h2>🎉 Parabéns, Pantoja!</h2>
            <p>Você dominou todos os <strong>30 cartões V/F de ${escapeHtml(subj.title)}</strong> (revisão completa concluída)!</p>
            <p class="muted-text" style="margin-bottom: 1.25rem;">Agora as provas de ${escapeHtml(subj.title)} estão liberadas.</p>
            <div class="grid">
              ${
                canTakeExamNow
                  ? '<button type="button" class="primary" id="btn-go-to-exam-now">📝 Ir para a Prova Agora</button>'
                  : ''
              }
              ${
                pendingVfErrorsCount > 0
                  ? `<button type="button" class="outline secondary" id="btn-go-to-errors-now">🎯 Treinar Erros V/F (${pendingVfErrorsCount})</button>`
                  : ''
              }
              <button type="button" class="outline secondary" id="btn-done-back-dash">← Voltar ao Painel</button>
            </div>
          </article>
        `;
      }
      listEl.appendChild(doneLi);

      document.getElementById('btn-go-to-exam-now')?.addEventListener('click', () => {
        openExam(activeSubjectKey);
      });
      document.getElementById('btn-go-to-errors-now')?.addEventListener('click', () => {
        openFlashcards(activeSubjectKey, 'errors');
      });
      document.getElementById('btn-done-back-dash')?.addEventListener('click', () => {
        renderDashboard();
        showView('view-dashboard');
      });
      return;
    }

    if (swipeHint) swipeHint.hidden = false;
    if (keyboardHint) keyboardHint.hidden = false;

    const currentCardId = filteredQueue[0];
    const cardObj = cards.find((c) => c.id === currentCardId) || subj.cards.find((c) => c.id === currentCardId);
    const cardSt = appState.subjects[getVfCardSubjectKey(cardObj)] || st;
    const currentBox = boxes[currentCardId] || 0;
    const totalErrs = cardSt?.cardErrorsTotal[currentCardId] || 0;
    const topicLabel = isMixedErrorMode && cardObj._subjTitle
      ? `${cardObj._subjTitle} • ${cardObj.topic}`
      : cardObj.topic;
    const flagBadge = totalErrs > 0
      ? `<span class="card-flag-tag">⚠️ Reforço (${totalErrs}x)</span>`
      : cardObj.fastTrack
      ? '<span class="card-flag-tag is-fast">⚡ Fast-track</span>'
      : '';

    const li = document.createElement('li');
    li.className = 'SwipeableList-item';
    li.id = `card-item-${cardObj.id}`;

    li.innerHTML = `
      <div class="SwipeableList-track">
        <div class="SwipeableList-content">
          <div>
            <div class="card-meta-top">
              <span class="card-topic-tag">${escapeHtml(topicLabel)}</span>
              <div class="card-badge-group">
                ${flagBadge}
                <span class="card-box-tag">Caixa ${currentBox} (${currentBox}/2 acertos)</span>
              </div>
            </div>
            <p class="card-statement-text SwipeableList-label">${escapeHtml(cardObj.statement)}</p>
          </div>

          <div class="vf-button-pair">
            <button type="button" class="SwipeableList-action btn-vf-false" data-direction="right">
              👈 FALSO <span class="visually-hidden">${escapeHtml(cardObj.statement)}</span>
            </button>
            <button type="button" class="SwipeableList-action btn-vf-true" data-direction="left">
              VERDADEIRO 👉 <span class="visually-hidden">${escapeHtml(cardObj.statement)}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    listEl.appendChild(li);
  }

  function handleFlashcardAnswer(userAnswerBoolean) {
    if (document.getElementById('view-flashcards')?.hidden) return;
    const { subj, st, isErrorMode, cards, queue, boxes } = getVfRuntime();
    if (!queue || queue.length === 0) return;

    const queueSnapshot = [...queue];
    const currentCardId = queue.shift();
    const cardObj = cards.find((c) => c.id === currentCardId) || subj.cards.find((c) => c.id === currentCardId);
    if (!cardObj) return;
    const cardSubjKey = getVfCardSubjectKey(cardObj);
    const cardSt = appState.subjects[cardSubjKey] || st;
    if (!cardSt) return;

    lastVfUndoSnapshot = {
      sessionSubjectKey: activeSubjectKey,
      sessionMode: vfSession.mode,
      subjKey: cardSubjKey,
      isErrorMode,
      cardId: currentCardId,
      queue: queueSnapshot,
      boxValue: boxes[currentCardId] || 0,
      errToday: cardSt.cardErrorsToday[currentCardId] || 0,
      errTotal: cardSt.cardErrorsTotal[currentCardId] || 0,
      vfCompletedToday: Boolean(cardSt.vfCompletedToday),
      wasResolvedVf: Boolean(cardSt.resolvedVfErrors && cardSt.resolvedVfErrors[currentCardId]),
    };

    const isCorrect = Boolean(userAnswerBoolean) === Boolean(cardObj.answer);
    const liveStatus = document.getElementById('vf-live-status');

    if (isCorrect) {
      const prevBox = boxes[currentCardId] || 0;
      const nextBox = prevBox + 1;
      boxes[currentCardId] = nextBox;

      if (nextBox < 2) {
        // Still needs 1 more hit: place it in the second half of the queue so it doesn't repeat immediately
        const insertAt = Math.max(1, Math.floor(queue.length * 0.6));
        queue.splice(insertAt, 0, currentCardId);
      } else if (isErrorMode) {
        if (!cardSt.resolvedVfErrors || typeof cardSt.resolvedVfErrors !== 'object') {
          cardSt.resolvedVfErrors = {};
        }
        cardSt.resolvedVfErrors[currentCardId] = true;
      }

      const remaining = queue.filter((id) => (boxes[id] || 0) < 2);
      const queueEmpty = remaining.length === 0;
      if (queueEmpty && !isErrorMode) {
        cardSt.vfCompletedToday = true;
      }

      if (liveStatus) {
        liveStatus.textContent = nextBox >= 2
          ? 'Acertou! Cartão dominado na Caixa 2.'
          : 'Acertou! Cartão subiu para a Caixa 1.';
      }

      if (!isErrorMode || nextBox >= 2) {
        saveState();
      }
      updateLeitnerCounters();
      pulseLeitnerBox(Math.min(2, nextBox));
      showCardFeedback(cardObj, userAnswerBoolean, true, nextBox, queueEmpty);
    } else {
      // Wrong answer: resets to Box 0 and goes to middle/back of queue
      boxes[currentCardId] = 0;
      cardSt.cardErrorsToday[currentCardId] = (cardSt.cardErrorsToday[currentCardId] || 0) + 1;
      cardSt.cardErrorsTotal[currentCardId] = (cardSt.cardErrorsTotal[currentCardId] || 0) + 1;
      if (cardSt.resolvedVfErrors && cardSt.resolvedVfErrors[currentCardId]) {
        delete cardSt.resolvedVfErrors[currentCardId];
      }

      const insertAt = Math.max(1, Math.min(4, queue.length));
      queue.splice(insertAt, 0, currentCardId);

      if (liveStatus) {
        liveStatus.textContent = 'Errou! Cartão voltou para a Caixa 0.';
      }

      saveState();
      updateLeitnerCounters();
      pulseLeitnerBox(0);
      showCardFeedback(cardObj, userAnswerBoolean, false, 0, false);
    }
  }

  function showCardFeedback(cardObj, userAnswerBoolean, isCorrect, nextBox, queueEmpty) {
    if (document.getElementById('view-flashcards')?.hidden) return;
    const swipeHint = document.getElementById('vf-swipe-hint');
    const keyboardHint = document.getElementById('vf-keyboard-hint');
    if (swipeHint) swipeHint.hidden = true;
    if (keyboardHint) keyboardHint.hidden = true;

    const feedbackBox = document.getElementById('vf-feedback-box');
    const titleEl = document.getElementById('vf-feedback-title');
    const badgeEl = document.getElementById('vf-feedback-badge');
    const topicEl = document.getElementById('vf-feedback-topic');
    const stmtEl = document.getElementById('vf-feedback-statement');
    const ansEl = document.getElementById('vf-feedback-correct-ans');
    const expContent = document.getElementById('vf-explanation-content');
    const expText = document.getElementById('vf-explanation-text');
    const btnToggleExp = document.getElementById('btn-toggle-explanation');
    const btnNextCard = document.getElementById('btn-next-card');

    feedbackBox.classList.toggle('is-correct', isCorrect);
    feedbackBox.classList.toggle('is-wrong', !isCorrect);

    if (isCorrect) {
      if (nextBox >= 2) {
        titleEl.textContent = '🌟 Dominado! Cartão concluído!';
        badgeEl.textContent = 'Caixa 2 • Dominado ✅';
      } else {
        titleEl.textContent = '✅ Acertou! Mandou bem!';
        badgeEl.textContent = 'Subiu p/ Caixa 1 (1/2)';
      }
      ansEl.textContent = `Você marcou ${userAnswerBoolean ? 'VERDADEIRO' : 'FALSO'} e acertou! 🎉`;
    } else {
      titleEl.textContent = '❌ Ops, você errou!';
      badgeEl.textContent = 'Voltou p/ Caixa 0';
      ansEl.textContent = `Você marcou ${userAnswerBoolean ? 'VERDADEIRO' : 'FALSO'}, mas o gabarito é ${cardObj.answer ? 'VERDADEIRO ✅' : 'FALSO ❌'}.`;
    }

    if (topicEl) {
      const subjLabel = cardObj._subjTitle ? `${cardObj._subjTitle} • ` : '';
      const fullTopic = `${subjLabel}${cardObj.topic || ''}`.trim();
      topicEl.textContent = fullTopic;
      topicEl.hidden = !fullTopic;
    }
    stmtEl.textContent = `"${cardObj.statement}"`;
    expText.textContent = cardObj.explanation;

    // Auto-expand explanation on wrong answers so the student immediately sees the macete; keep collapsed when right
    const showExpNow = !isCorrect;
    expContent.hidden = !showExpNow;
    btnToggleExp.textContent = showExpNow ? '🙈 Ocultar Explicação' : '💡 Ver Explicação';
    const btnUndo = document.getElementById('btn-undo-vf');
    if (btnUndo) {
      btnUndo.hidden = !lastVfUndoSnapshot;
    }
    btnNextCard.textContent = queueEmpty ? '🎉 Ver Conclusão →' : 'Próximo Card →';

    feedbackBox.hidden = false;
    btnNextCard.focus();
  }

  document.getElementById('btn-undo-vf')?.addEventListener('click', () => {
    const snap = lastVfUndoSnapshot;
    if (!snap || snap.sessionSubjectKey !== activeSubjectKey || snap.sessionMode !== vfSession.mode) return;
    const { isErrorMode, setQueue, boxes } = getVfRuntime();
    const cardSt = appState.subjects[snap.subjKey];
    if (!cardSt || Boolean(isErrorMode) !== Boolean(snap.isErrorMode)) return;

    boxes[snap.cardId] = snap.boxValue;
    setQueue([...snap.queue]);
    cardSt.cardErrorsToday[snap.cardId] = snap.errToday;
    cardSt.cardErrorsTotal[snap.cardId] = snap.errTotal;
    if (!cardSt.resolvedVfErrors || typeof cardSt.resolvedVfErrors !== 'object') {
      cardSt.resolvedVfErrors = {};
    }
    if (snap.wasResolvedVf) {
      cardSt.resolvedVfErrors[snap.cardId] = true;
    } else {
      delete cardSt.resolvedVfErrors[snap.cardId];
    }
    if (!isErrorMode) {
      cardSt.vfCompletedToday = snap.vfCompletedToday;
    }
    lastVfUndoSnapshot = null;
    saveState();
    renderCurrentFlashcard();
    showToast('↩️ Última resposta desfeita!');
  });

  document.getElementById('btn-shuffle-vf')?.addEventListener('click', () => {
    const { isErrorMode, queue, setQueue, boxes } = getVfRuntime();
    const pending = queue.filter((id) => (boxes[id] || 0) < 2);
    if (pending.length <= 1) {
      showToast('Já há apenas 1 cartão restante na fila.');
      return;
    }
    for (let i = pending.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pending[i], pending[j]] = [pending[j], pending[i]];
    }
    setQueue(pending);
    lastVfUndoSnapshot = null;
    if (!isErrorMode) {
      saveState();
    }
    renderCurrentFlashcard();
    showToast('🔀 Fila de cartões embaralhada!');
  });

  document.getElementById('btn-toggle-explanation').addEventListener('click', () => {
    const expContent = document.getElementById('vf-explanation-content');
    const btn = document.getElementById('btn-toggle-explanation');
    const willShow = expContent.hidden;
    expContent.hidden = !willShow;
    btn.textContent = willShow ? '🙈 Ocultar Explicação' : '💡 Ver Explicação';
  });

  document.getElementById('btn-next-card').addEventListener('click', () => {
    lastVfUndoSnapshot = null;
    renderCurrentFlashcard();
  });

  document.getElementById('btn-back-from-vf').addEventListener('click', () => {
    lastVfUndoSnapshot = null;
    renderDashboard();
    showView('view-dashboard');
  });

  // Keyboard shortcuts for Flashcards V/F view
  document.addEventListener('keydown', (e) => {
    const vfView = document.getElementById('view-flashcards');
    if (!vfView || vfView.hidden) return;
    if (document.querySelector('dialog[open]')) return;

    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const feedbackBox = document.getElementById('vf-feedback-box');
    const feedbackOpen = feedbackBox && !feedbackBox.hidden;
    const key = e.key.toLowerCase();

    if (feedbackOpen) {
      if (e.key === 'Enter' || e.key === ' ') {
        const activeBtn = document.activeElement?.closest('button');
        if (activeBtn && activeBtn.id !== 'btn-next-card') {
          return;
        }
        e.preventDefault();
        lastVfUndoSnapshot = null;
        renderCurrentFlashcard();
      } else if (key === 'e') {
        e.preventDefault();
        document.getElementById('btn-toggle-explanation')?.click();
      } else if ((key === 'u' || key === 'z') && lastVfUndoSnapshot) {
        e.preventDefault();
        document.getElementById('btn-undo-vf')?.click();
      }
      return;
    }

    const activeItem = vfSwipeList?.querySelector('.SwipeableList-item:not(.is-removing)');
    if (!activeItem) return;

    if (e.key === 'ArrowLeft' || key === 'f') {
      e.preventDefault();
      activeItem.querySelector('.btn-vf-false')?.click();
    } else if (e.key === 'ArrowRight' || key === 'v') {
      e.preventDefault();
      activeItem.querySelector('.btn-vf-true')?.click();
    }
  });

  // ==========================================================================
  // EXAM SIMULADO (10 Multiple-Choice Questions, No Immediate Spoiler)
  // ==========================================================================
  let examVisibleObserver = null;

  function getExamQuestionDraftKey(q, idx) {
    return examSessionMode === 'errors' ? (q?._errorKey || q?.id || String(idx)) : String(idx);
  }

  function setCurrentExamPill(qIndex) {
    const numIdx = Number(qIndex);
    if (!Number.isNaN(numIdx) && numIdx >= 0) {
      examCurrentIndex = numIdx;
    }
    const qNav = document.getElementById('exam-question-nav');
    if (!qNav) return;
    for (const pill of qNav.querySelectorAll('.exam-nav-pill')) {
      const isCurrent = pill.dataset.qIndex === String(examCurrentIndex);
      pill.classList.toggle('is-current', isCurrent);
      if (isCurrent) {
        pill.setAttribute('aria-current', 'location');
      } else {
        pill.removeAttribute('aria-current');
      }
    }
  }

  function applyExamFocusLayout() {
    if (!activeExamObj) return;
    const totalQ = activeExamObj.questions.length;
    if (examCurrentIndex < 0 || examCurrentIndex >= totalQ) {
      examCurrentIndex = 0;
    }

    const qContainer = document.getElementById('exam-questions-container');
    if (qContainer) {
      for (const card of qContainer.querySelectorAll('.question-card')) {
        const idx = Number(card.dataset.qIndex);
        card.hidden = examFocusMode && idx !== examCurrentIndex;
      }
    }

    const btnToggle = document.getElementById('btn-toggle-exam-focus');
    if (btnToggle) {
      btnToggle.textContent = examFocusMode ? '📄 Ver todas' : '🎯 1 por vez';
      btnToggle.disabled = totalQ <= 1;
    }

    const btnAutoAdv = document.getElementById('btn-toggle-exam-autoadvance');
    if (btnAutoAdv) {
      btnAutoAdv.hidden = !examFocusMode || totalQ <= 1;
      btnAutoAdv.textContent = examAutoAdvance ? '⚡ Auto-avanço: ON' : '⚡ Auto-avanço: OFF';
      btnAutoAdv.classList.toggle('is-active', examAutoAdvance);
      btnAutoAdv.setAttribute('aria-pressed', examAutoAdvance ? 'true' : 'false');
    }

    const pager = document.getElementById('exam-focus-pager');
    const posEl = document.getElementById('exam-focus-pos');
    const prevBtn = document.getElementById('btn-exam-prev-q');
    const nextBtn = document.getElementById('btn-exam-next-q');
    const isCurrentAnswered = Boolean(
      document.getElementById('exam-form')?.querySelector(`input[name="q_${examCurrentIndex}"]:checked`)
    );
    if (pager) pager.hidden = !examFocusMode || totalQ <= 1;
    if (posEl) {
      posEl.textContent = `Questão ${examCurrentIndex + 1} de ${totalQ} • ${isCurrentAnswered ? '✅ Respondida' : '⏳ Em branco'}`;
    }
    if (prevBtn) prevBtn.disabled = examCurrentIndex <= 0;
    if (nextBtn) nextBtn.disabled = examCurrentIndex >= totalQ - 1;

    setCurrentExamPill(examCurrentIndex);
  }

  function navigateExamToIndex(targetIdx, shouldScroll = true) {
    if (!activeExamObj) return;
    const totalQ = activeExamObj.questions.length;
    if (totalQ === 0) return;
    const clamped = Math.max(0, Math.min(totalQ - 1, Number(targetIdx) || 0));
    examCurrentIndex = clamped;
    applyExamFocusLayout();
    if (shouldScroll) {
      const card = document.querySelector(`.question-card[data-q-index="${clamped}"]`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function setupExamVisibilityObserver() {
    if (examVisibleObserver) {
      examVisibleObserver.disconnect();
      examVisibleObserver = null;
    }
    if (examFocusMode) return;
    const qContainer = document.getElementById('exam-questions-container');
    if (!qContainer || typeof IntersectionObserver === 'undefined') return;

    examVisibleObserver = new IntersectionObserver(
      (entries) => {
        let bestEntry = null;
        for (const entry of entries) {
          if (entry.isIntersecting && (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio)) {
            bestEntry = entry;
          }
        }
        if (bestEntry) {
          setCurrentExamPill(bestEntry.target.dataset.qIndex);
        }
      },
      { rootMargin: '-30% 0px -45% 0px', threshold: [0.1, 0.4, 0.7] }
    );

    for (const card of qContainer.querySelectorAll('.question-card')) {
      examVisibleObserver.observe(card);
    }
  }

  let submitConfirmTimer = null;
  const DEFAULT_SUBMIT_LABEL = '✅ Entregar Prova e Ver Nota';

  function resetSubmitExamConfirm() {
    const btnSubmit = document.getElementById('btn-submit-exam');
    if (!btnSubmit) return;
    btnSubmit.dataset.confirmPending = 'false';
    if (examSessionMode === 'errors') {
      btnSubmit.textContent = '✅ Finalizar Treino de Erros';
    } else if (examSessionMode === 'practice') {
      btnSubmit.textContent = '✅ Finalizar Treino Livre';
    } else {
      btnSubmit.textContent = DEFAULT_SUBMIT_LABEL;
    }
    btnSubmit.classList.remove('is-confirming');
    if (submitConfirmTimer) {
      clearTimeout(submitConfirmTimer);
      submitConfirmTimer = null;
    }
  }

  function renderExamView({ subjKey, subj, examObj, attemptLabel, noticeHtml, mode }) {
    clearExamAutoAdvanceTimer();
    examPausedByDialog = false;
    activeSubjectKey = subjKey;
    examSessionMode = mode;
    activeExamObj = examObj;
    examFocusMode = Boolean(appState.examFocusMode);
    examAutoAdvance = Boolean(appState.examAutoAdvance);
    const draftKey = `${subjKey}:${activeExamObj.id}`;
    const savedDraft = (appState.examDrafts && appState.examDrafts[draftKey]) || {};
    const savedFlags = (appState.examDraftFlags && appState.examDraftFlags[draftKey]) || {};
    const savedTimer = (appState.examDraftTimers && appState.examDraftTimers[draftKey]) || 0;
    const totalQ = activeExamObj.questions.length;
    const firstUnansweredIdx = activeExamObj.questions.findIndex((q, idx) => {
      const val = savedDraft[getExamQuestionDraftKey(q, idx)];
      return val === undefined || val === null || val === '';
    });
    const hasAnySavedAnswer = Object.values(savedDraft).some((v) => v !== undefined && v !== null && v !== '');
    examCurrentIndex = hasAnySavedAnswer && firstUnansweredIdx !== -1 ? firstUnansweredIdx : 0;

    document.getElementById('exam-subject-title').textContent = `${subj.title} — ${activeExamObj.title}`;
    document.getElementById('exam-attempt-label').textContent = attemptLabel;
    document.getElementById('exam-incomplete-msg').hidden = true;
    const noticeEl = document.getElementById('exam-simulado-notice-text');
    if (noticeEl) noticeEl.innerHTML = noticeHtml;

    resetClearDraftConfirm?.();
    resetSubmitExamConfirm();

    const qContainer = document.getElementById('exam-questions-container');
    const qNav = document.getElementById('exam-question-nav');
    qContainer.innerHTML = '';
    if (qNav) {
      qNav.innerHTML = '';
      qNav.style.gridTemplateColumns = totalQ < 10 ? `repeat(${Math.max(1, totalQ)}, minmax(0, 1fr))` : '';
    }

    const letters = ['A', 'B', 'C', 'D'];

    activeExamObj.questions.forEach((q, idx) => {
      const dKey = getExamQuestionDraftKey(q, idx);
      const isFlagged = Boolean(savedFlags[dKey]);
      const article = document.createElement('article');
      article.className = `question-card${isFlagged ? ' is-flagged' : ''}`;
      article.dataset.qIndex = String(idx);
      article.dataset.draftKey = dKey;
      const savedChoice = savedDraft[dKey];
      const hasSavedChoice = savedChoice !== undefined && savedChoice !== null && savedChoice !== '';

      const optionsHtml = q.options
        .map(
          (optText, optIdx) => `
          <label class="option-label">
            <input type="radio" name="q_${idx}" value="${optIdx}" ${hasSavedChoice && Number(savedChoice) === optIdx ? 'checked' : ''}>
            <span><strong>${letters[optIdx]})</strong> ${escapeHtml(optText)}</span>
          </label>
        `
        )
        .join('');

      article.innerHTML = `
        <div class="question-card-top">
          <span class="question-num">Questão ${idx + 1} de ${totalQ}${q._sourceExamTitle ? ` • ${escapeHtml(q._sourceExamTitle)}` : ''}</span>
          <div class="question-card-actions">
            <button type="button" class="btn-clear-question outline secondary btn-xs" data-q-index="${idx}" ${hasSavedChoice ? '' : 'hidden'} title="Desmarcar resposta desta questão">
              ↺ Limpar
            </button>
            <button type="button" class="btn-flag-question outline secondary btn-xs${isFlagged ? ' is-flagged' : ''}" data-q-index="${idx}" aria-pressed="${isFlagged ? 'true' : 'false'}">
              ${isFlagged ? '🚩 Marcada p/ revisar' : '🏳️ Revisar depois'}
            </button>
          </div>
        </div>
        <p class="question-text">${escapeHtml(q.text)}</p>
        <div class="options-group">
          ${optionsHtml}
        </div>
      `;

      qContainer.appendChild(article);

      if (qNav) {
        const navBtn = document.createElement('button');
        navBtn.type = 'button';
        navBtn.className = `exam-nav-pill${isFlagged ? ' is-flagged' : ''}`;
        navBtn.dataset.qIndex = String(idx);
        navBtn.textContent = String(idx + 1);
        navBtn.setAttribute('aria-label', `Ir para a questão ${idx + 1}`);
        qNav.appendChild(navBtn);
      }
    });

    startExamTimer(savedTimer);
    updateExamNavAndProgress();
    applyExamFocusLayout();
    setupExamVisibilityObserver();
    const shouldScrollResumed = !examFocusMode && examCurrentIndex > 0;
    showView('view-exam', !shouldScrollResumed);
    if (shouldScrollResumed) {
      const resumedCard = document.querySelector(`.question-card[data-q-index="${examCurrentIndex}"]`);
      resumedCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function openExam(subjKey) {
    const subj = getSubjectsMap()[subjKey];
    const st = appState.subjects[subjKey];

    if (!st.vfCompletedToday) {
      openFlashcards(subjKey);
      return;
    }

    if (st.passedToday || st.examsTodayCount >= 3) {
      renderDashboard();
      showView('view-dashboard');
      return;
    }

    const examIdx = st.nextExamIndex % subj.exams.length;
    const examObj = subj.exams[examIdx];
    renderExamView({
      subjKey,
      subj,
      examObj,
      attemptLabel: `Tentativa ${st.examsTodayCount + 1} de 3 hoje • Meta: 8/10`,
      noticeHtml: '📝 <strong>Modo Simulado:</strong> Responda as 10 questões com calma. A nota e o gabarito comentado aparecem ao entregar a prova no final.',
      mode: 'official',
    });
  }

  function openExamErrorDrill(subjKey) {
    const subj = getSubjectsMap()[subjKey];
    const st = appState.subjects[subjKey];
    const errorQuestions = getPendingExamErrorQuestions(subj, st);
    if (errorQuestions.length === 0) {
      showToast('🎉 Não há erros de prova pendentes nesta frente!');
      renderDashboard();
      showView('view-dashboard');
      return;
    }

    renderExamView({
      subjKey,
      subj,
      examObj: {
        id: 'error-drill',
        title: 'Treino de Erros de Prova',
        questions: errorQuestions,
      },
      attemptLabel: `🧠 ${errorQuestions.length} questão(ões) errada(s) anteriormente • Não consome tentativas`,
      noticeHtml: '🧠 <strong>Treino Focado de Erros:</strong> Questões que você acertar aqui saem da lista de pendências sem gastar suas 3 provas do dia.',
      mode: 'errors',
    });
  }

  function openMixedExamErrorDrill() {
    const subjects = getSubjectsMap();
    const mixedQuestions = [];
    for (const key of ['quimica', 'biologia', 'fisica']) {
      const subj = subjects[key];
      const st = appState.subjects[key];
      if (!subj || !st) continue;
      for (const q of getPendingExamErrorQuestions(subj, st)) {
        mixedQuestions.push({
          ...q,
          _subjKey: key,
          _subjTitle: subj.title,
          _rawErrorKey: q._errorKey,
          _errorKey: `${key}:${q._errorKey}`,
          _sourceExamTitle: `${subj.title} • ${q._sourceExamTitle}`,
        });
      }
    }

    if (mixedQuestions.length === 0) {
      showToast('🎉 Não há erros de prova pendentes nas 3 frentes!');
      renderDashboard();
      showView('view-dashboard');
      return;
    }

    renderExamView({
      subjKey: 'mixed',
      subj: { title: 'Revisão Mista' },
      examObj: {
        id: 'mixed-error-drill',
        title: 'Erros de Prova (3 Frentes)',
        questions: mixedQuestions,
      },
      attemptLabel: `🌐 ${mixedQuestions.length} questão(ões) errada(s) nas 3 frentes • Não consome tentativas`,
      noticeHtml: '🌐 <strong>Simulado Misto de Erros:</strong> Questões que você acertar aqui saem da lista de pendências da respectiva frente sem gastar suas 3 provas do dia.',
      mode: 'errors',
    });
  }

  function openHistoryExamPractice(subjKey, historyIndex) {
    const subj = getSubjectsMap()[subjKey];
    const st = appState.subjects[subjKey];
    if (!subj || !st || !Array.isArray(st.examHistory)) return;
    const entry = st.examHistory[historyIndex];
    if (!entry) return;
    const sourceExam = subj.exams.find((ex) => ex.id === entry.examId) || subj.exams.find((ex) => ex.title === entry.examTitle);
    if (!sourceExam) return;

    renderExamView({
      subjKey,
      subj,
      examObj: {
        id: `practice-${sourceExam.id}`,
        title: `${sourceExam.title} (Treino Livre)`,
        questions: sourceExam.questions,
        _sourceExamId: sourceExam.id,
        _sourceExamTitle: sourceExam.title,
      },
      attemptLabel: `🔁 Refazendo em modo treino livre • Não consome tentativas do dia`,
      noticeHtml: '🔁 <strong>Treino Livre:</strong> Refaça esta prova sem gastar suas 3 tentativas diárias. Questões acertadas aqui também saem da lista de pendências.',
      mode: 'practice',
    });
  }

  function updateExamNavAndProgress() {
    if (!activeExamObj) return;
    const form = document.getElementById('exam-form');
    const qNav = document.getElementById('exam-question-nav');
    const progBar = document.getElementById('exam-progress-bar');
    const total = activeExamObj.questions.length;
    const draftKey = activeSubjectKey ? `${activeSubjectKey}:${activeExamObj.id}` : '';
    const savedFlags = (draftKey && appState.examDraftFlags && appState.examDraftFlags[draftKey]) || {};
    let answered = 0;
    let flaggedCount = 0;

    for (let i = 0; i < total; i++) {
      const dKey = getExamQuestionDraftKey(activeExamObj.questions[i], i);
      const isChecked = Boolean(form?.querySelector(`input[name="q_${i}"]:checked`));
      const isFlagged = Boolean(savedFlags[dKey]);
      if (isChecked) answered++;
      if (isFlagged) flaggedCount++;
      const pill = qNav?.querySelector(`.exam-nav-pill[data-q-index="${i}"]`);
      if (pill) {
        pill.classList.toggle('is-answered', isChecked);
        pill.classList.toggle('is-flagged', isFlagged);
        if (isChecked) pill.classList.remove('is-missing');
      }
    }

    const badge = document.getElementById('exam-answered-badge');
    if (badge) badge.textContent = `${answered} / ${total} respondidas`;
    const stickyStatus = document.getElementById('exam-sticky-status');
    if (stickyStatus) stickyStatus.innerHTML = `<strong>${answered} / ${total}</strong> respondidas`;
    const jumpUnanswered = document.getElementById('exam-jump-unanswered');
    if (jumpUnanswered) jumpUnanswered.hidden = answered >= total;
    const flaggedStatus = document.getElementById('exam-flagged-status');
    if (flaggedStatus) {
      flaggedStatus.hidden = flaggedCount === 0;
      flaggedStatus.textContent = `🚩 ${flaggedCount} para revisar ↻`;
    }
    if (flaggedCount === 0) {
      resetSubmitExamConfirm();
    }
    const btnClearDraft = document.getElementById('btn-clear-exam-draft');
    if (btnClearDraft) {
      btnClearDraft.disabled = answered === 0 && flaggedCount === 0 && getElapsedExamSeconds() === 0;
    }
    if (progBar) {
      progBar.max = total;
      progBar.value = answered;
    }
    if (answered === total) {
      const incMsg = document.getElementById('exam-incomplete-msg');
      if (incMsg) incMsg.hidden = true;
    }
    if (examFocusMode) {
      const posEl = document.getElementById('exam-focus-pos');
      const isCurrentAnswered = Boolean(form?.querySelector(`input[name="q_${examCurrentIndex}"]:checked`));
      if (posEl) {
        posEl.textContent = `Questão ${examCurrentIndex + 1} de ${total} • ${isCurrentAnswered ? '✅ Respondida' : '⏳ Em branco'}`;
      }
    }
  }

  function jumpToExamQuestionByPredicate(predicate) {
    if (!activeExamObj) return;
    const total = activeExamObj.questions.length;
    const qNav = document.getElementById('exam-question-nav');
    const currentPill = qNav?.querySelector('.exam-nav-pill.is-current');
    const startIdx = currentPill ? (Number(currentPill.dataset.qIndex) + 1) % total : 0;

    for (let offset = 0; offset < total; offset++) {
      const idx = (startIdx + offset) % total;
      if (predicate(idx)) {
        navigateExamToIndex(idx, true);
        return;
      }
    }
  }

  document.getElementById('btn-toggle-exam-focus')?.addEventListener('click', () => {
    clearExamAutoAdvanceTimer();
    examFocusMode = !examFocusMode;
    appState.examFocusMode = examFocusMode;
    saveState();
    applyExamFocusLayout();
    setupExamVisibilityObserver();
  });

  document.getElementById('btn-toggle-exam-autoadvance')?.addEventListener('click', () => {
    clearExamAutoAdvanceTimer();
    examAutoAdvance = !examAutoAdvance;
    appState.examAutoAdvance = examAutoAdvance;
    saveState();
    applyExamFocusLayout();
    showToast(examAutoAdvance
      ? '⚡ Auto-avanço ativado no modo 1 por vez!'
      : '⚡ Auto-avanço desativado.');
  });

  document.getElementById('btn-toggle-exam-timer')?.addEventListener('click', () => {
    if (!activeExamObj) return;
    if (examTimerPaused) {
      resumeExamTimer();
      showToast('▶️ Cronômetro retomado!');
    } else {
      pauseExamTimer();
      showToast('⏸️ Cronômetro pausado.');
    }
  });

  document.getElementById('btn-exam-prev-q')?.addEventListener('click', () => {
    navigateExamToIndex(examCurrentIndex - 1, true);
  });

  document.getElementById('btn-exam-next-q')?.addEventListener('click', () => {
    navigateExamToIndex(examCurrentIndex + 1, true);
  });

  document.getElementById('exam-flagged-status')?.addEventListener('click', () => {
    if (!activeExamObj || !activeSubjectKey) return;
    const draftKey = `${activeSubjectKey}:${activeExamObj.id}`;
    const savedFlags = (appState.examDraftFlags && appState.examDraftFlags[draftKey]) || {};
    jumpToExamQuestionByPredicate((idx) => Boolean(savedFlags[getExamQuestionDraftKey(activeExamObj.questions[idx], idx)]));
  });

  document.getElementById('exam-jump-unanswered')?.addEventListener('click', () => {
    const form = document.getElementById('exam-form');
    jumpToExamQuestionByPredicate((idx) => !form?.querySelector(`input[name="q_${idx}"]:checked`));
  });

  document.getElementById('exam-question-nav')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.exam-nav-pill');
    if (!btn) return;
    navigateExamToIndex(Number(btn.dataset.qIndex), true);
  });

  document.getElementById('exam-questions-container').addEventListener('click', (e) => {
    const clearBtn = e.target.closest('.btn-clear-question');
    if (clearBtn && activeExamObj && activeSubjectKey) {
      const qIdx = Number(clearBtn.dataset.qIndex);
      const dKey = getExamQuestionDraftKey(activeExamObj.questions[qIdx], qIdx);
      const draftKey = `${activeSubjectKey}:${activeExamObj.id}`;
      const form = document.getElementById('exam-form');
      const checked = form?.querySelector(`input[name="q_${qIdx}"]:checked`);
      if (checked) checked.checked = false;
      if (appState.examDrafts && appState.examDrafts[draftKey]) {
        delete appState.examDrafts[draftKey][dKey];
        saveState();
      }
      clearBtn.hidden = true;
      setCurrentExamPill(qIdx);
      updateExamNavAndProgress();
      return;
    }

    const flagBtn = e.target.closest('.btn-flag-question');
    if (!flagBtn || !activeExamObj || !activeSubjectKey) return;

    const qIdx = Number(flagBtn.dataset.qIndex);
    const dKey = getExamQuestionDraftKey(activeExamObj.questions[qIdx], qIdx);
    const draftKey = `${activeSubjectKey}:${activeExamObj.id}`;
    if (!appState.examDraftFlags || typeof appState.examDraftFlags !== 'object') {
      appState.examDraftFlags = {};
    }
    if (!appState.examDraftFlags[draftKey]) {
      appState.examDraftFlags[draftKey] = {};
    }

    const willFlag = !appState.examDraftFlags[draftKey][dKey];
    if (willFlag) {
      appState.examDraftFlags[draftKey][dKey] = true;
    } else {
      delete appState.examDraftFlags[draftKey][dKey];
    }
    saveState();

    const card = flagBtn.closest('.question-card');
    if (card) card.classList.toggle('is-flagged', willFlag);
    flagBtn.classList.toggle('is-flagged', willFlag);
    flagBtn.setAttribute('aria-pressed', willFlag ? 'true' : 'false');
    flagBtn.textContent = willFlag ? '🚩 Marcada p/ revisar' : '🏳️ Revisar depois';
    resetSubmitExamConfirm();
    setCurrentExamPill(qIdx);
    updateExamNavAndProgress();
  });

  document.getElementById('exam-questions-container').addEventListener('change', (e) => {
    if (!activeExamObj || !activeSubjectKey) return;
    const radio = e.target.closest('input[type="radio"]');
    if (radio && radio.name.startsWith('q_')) {
      const qIdx = Number(radio.name.slice(2));
      const dKey = getExamQuestionDraftKey(activeExamObj.questions[qIdx], qIdx);
      const draftKey = `${activeSubjectKey}:${activeExamObj.id}`;
      if (!appState.examDrafts || typeof appState.examDrafts !== 'object') {
        appState.examDrafts = {};
      }
      if (!appState.examDrafts[draftKey]) {
        appState.examDrafts[draftKey] = {};
      }
      appState.examDrafts[draftKey][dKey] = Number(radio.value);
      saveState();

      const card = radio.closest('.question-card');
      if (card) {
        card.classList.remove('is-missing');
        const clearBtn = card.querySelector('.btn-clear-question');
        if (clearBtn) clearBtn.hidden = false;
      }
      setCurrentExamPill(qIdx);
      updateExamNavAndProgress();

      if (examFocusMode && examAutoAdvance && qIdx === examCurrentIndex && qIdx + 1 < activeExamObj.questions.length) {
        clearExamAutoAdvanceTimer();
        examAutoAdvanceTimer = setTimeout(() => {
          examAutoAdvanceTimer = null;
          const examView = document.getElementById('view-exam');
          if (examView && !examView.hidden && activeExamObj && examFocusMode && examAutoAdvance && examCurrentIndex === qIdx) {
            navigateExamToIndex(qIdx + 1, true);
          }
        }, 280);
      }
      return;
    }

    updateExamNavAndProgress();
  });

  // Keyboard shortcuts for Exam view
  document.addEventListener('keydown', (e) => {
    const examView = document.getElementById('view-exam');
    if (!examView || examView.hidden || !activeExamObj) return;
    if (document.querySelector('dialog[open]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const activeEl = document.activeElement;
    const tag = activeEl?.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (tag === 'INPUT' && activeEl.type !== 'radio') return;

    const key = e.key.toLowerCase();
    const optionMap = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3 };
    if (key in optionMap) {
      const optIdx = optionMap[key];
      const radio = document.querySelector(`#exam-form input[name="q_${examCurrentIndex}"][value="${optIdx}"]`);
      if (radio) {
        e.preventDefault();
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }

    if (key === 'r') {
      const flagBtn = document.querySelector(`.question-card[data-q-index="${examCurrentIndex}"] .btn-flag-question`);
      if (flagBtn) {
        e.preventDefault();
        flagBtn.click();
      }
      return;
    }

    if (key === 'p') {
      e.preventDefault();
      document.getElementById('btn-toggle-exam-timer')?.click();
      return;
    }

    if (e.key === '[' || (e.key === 'ArrowLeft' && activeEl?.type !== 'radio')) {
      e.preventDefault();
      navigateExamToIndex(examCurrentIndex - 1, true);
    } else if (e.key === ']' || (e.key === 'ArrowRight' && activeEl?.type !== 'radio')) {
      e.preventDefault();
      navigateExamToIndex(examCurrentIndex + 1, true);
    }
  });

  document.getElementById('exam-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!activeExamObj) return;

    const form = e.target;
    const qNav = document.getElementById('exam-question-nav');
    const userAnswers = [];
    const missingIndices = [];

    for (let i = 0; i < activeExamObj.questions.length; i++) {
      const card = form.querySelector(`.question-card[data-q-index="${i}"]`);
      const pill = qNav?.querySelector(`.exam-nav-pill[data-q-index="${i}"]`);
      const checked = form.querySelector(`input[name="q_${i}"]:checked`);
      if (!checked) {
        missingIndices.push(i);
        if (card) card.classList.add('is-missing');
        if (pill) pill.classList.add('is-missing');
      } else {
        if (card) card.classList.remove('is-missing');
        if (pill) pill.classList.remove('is-missing');
        userAnswers.push(Number(checked.value));
      }
    }

    if (missingIndices.length > 0) {
      const msgEl = document.getElementById('exam-incomplete-msg');
      msgEl.textContent = `⚠️ Falta responder a(s) questão(ões): ${missingIndices.map((idx) => idx + 1).join(', ')}`;
      msgEl.hidden = false;
      navigateExamToIndex(missingIndices[0], true);
      return;
    }

    const draftKey = activeSubjectKey ? `${activeSubjectKey}:${activeExamObj.id}` : '';
    const savedFlags = (draftKey && appState.examDraftFlags && appState.examDraftFlags[draftKey]) || {};
    const flaggedCount = activeExamObj.questions.filter((q, idx) => Boolean(savedFlags[getExamQuestionDraftKey(q, idx)])).length;
    const btnSubmit = document.getElementById('btn-submit-exam');
    if (flaggedCount > 0 && btnSubmit && btnSubmit.dataset.confirmPending !== 'true') {
      btnSubmit.dataset.confirmPending = 'true';
      btnSubmit.textContent = `⚠️ Há ${flaggedCount} marcada(s) p/ revisar — Clique de novo para entregar`;
      btnSubmit.classList.add('is-confirming');
      if (submitConfirmTimer) clearTimeout(submitConfirmTimer);
      submitConfirmTimer = setTimeout(resetSubmitExamConfirm, 5000);
      return;
    }

    resetSubmitExamConfirm();
    clearExamAutoAdvanceTimer();
    examPausedByDialog = false;
    const durationSeconds = Math.max(1, getElapsedExamSeconds());
    stopExamTimer();
    examStartedAt = null;
    examTimerPaused = false;
    if (examSessionMode === 'errors') {
      gradeAndShowErrorDrillResult(userAnswers, durationSeconds);
    } else if (examSessionMode === 'practice') {
      gradeAndShowPracticeResult(userAnswers, durationSeconds);
    } else {
      gradeAndShowExamResult(userAnswers, durationSeconds);
    }
  });

  function updateToggleAllExplanationsBtn() {
    const reviewContainer = document.getElementById('result-review-container');
    const toggleBtn = document.getElementById('btn-toggle-all-explanations');
    if (!reviewContainer || !toggleBtn) return;
    const visibleDetails = Array.from(reviewContainer.querySelectorAll('.review-q-card:not([hidden]) details'));
    toggleBtn.disabled = visibleDetails.length === 0;
    const anyClosed = visibleDetails.some((d) => !d.open);
    toggleBtn.textContent = anyClosed ? '📖 Abrir comentários' : '🙈 Recolher comentários';
  }

  function applyResultReviewFilter(filterMode) {
    const reviewContainer = document.getElementById('result-review-container');
    const btnAll = document.getElementById('btn-filter-all');
    const btnWrong = document.getElementById('btn-filter-wrong');
    if (!reviewContainer || !btnAll || !btnWrong) return;

    const showOnlyWrong = filterMode === 'wrong';
    btnAll.className = showOnlyWrong ? 'btn-sm outline secondary' : 'btn-sm primary';
    btnWrong.className = showOnlyWrong ? 'btn-sm primary' : 'btn-sm outline secondary';

    for (const card of reviewContainer.querySelectorAll('.review-q-card')) {
      card.hidden = showOnlyWrong && card.classList.contains('is-correct');
    }
    updateToggleAllExplanationsBtn();
  }

  document.getElementById('result-filter-bar')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn || btn.disabled) return;
    applyResultReviewFilter(btn.dataset.filter);
  });

  document.getElementById('btn-toggle-all-explanations')?.addEventListener('click', () => {
    const reviewContainer = document.getElementById('result-review-container');
    if (!reviewContainer) return;
    const visibleDetails = Array.from(reviewContainer.querySelectorAll('.review-q-card:not([hidden]) details'));
    if (visibleDetails.length === 0) return;
    const shouldOpen = visibleDetails.some((d) => !d.open);
    for (const d of visibleDetails) {
      d.open = shouldOpen;
    }
    updateToggleAllExplanationsBtn();
  });

  function buildExamErrorsWhatsAppText({ subj, examObj, score, userAnswers, wrongQuestions }) {
    const letters = ['A', 'B', 'C', 'D'];
    const totalQ = examObj.questions.length;
    const hasUserAnswers = Array.isArray(userAnswers) && userAnswers.length === totalQ;
    const wrongById = new Set((wrongQuestions || []).map((w) => w.id).filter(Boolean));
    const wrongByNum = new Set((wrongQuestions || []).map((w) => Number(w.number)).filter((n) => !Number.isNaN(n)));

    const lines = [];
    lines.push(`❓ *DÚVIDA DE PROVA — ${subj.title.toUpperCase()} (${examObj.title})*`);
    lines.push(`Nota: ${score}/${totalQ}`);
    lines.push('');

    examObj.questions.forEach((q, idx) => {
      const userAns = hasUserAnswers ? userAnswers[idx] : null;
      const isRight = hasUserAnswers
        ? userAns === q.correct
        : !(wrongById.has(q.id) || wrongByNum.has(idx + 1));
      if (isRight) return;

      lines.push(`*Q${idx + 1}${q._sourceExamTitle ? ` (${q._sourceExamTitle})` : ''}:* ${q.text}`);
      if (hasUserAnswers && q.options[userAns] !== undefined) {
        lines.push(`❌ Marquei: ${letters[userAns]}) ${q.options[userAns]}`);
      }
      lines.push(`✅ Gabarito: ${letters[q.correct]}) ${q.options[q.correct]}`);
      lines.push('');
    });

    return lines.join('\n').trim();
  }

  function renderExamResultView({ subjKey, subj, st, examObj, score, passed, userAnswers, wrongQuestions, isHistoryReview = false, historyIndex = null, isErrorDrill = false, isPracticeMode = false, dayNumber = 1, durationSeconds = null }) {
    const letters = ['A', 'B', 'C', 'D'];
    const totalQ = examObj.questions.length;

    document.getElementById('result-exam-title').textContent = `${subj.title} — ${examObj.title}`;
    const heroCard = document.getElementById('result-summary-card');
    const scoreHeading = document.getElementById('result-score-heading');
    const statusMsg = document.getElementById('result-status-message');
    const ctaContainer = document.getElementById('result-cta-container');

    heroCard.className = `result-hero-card ${passed ? 'passed' : 'retry'}`;
    scoreHeading.textContent = isErrorDrill
      ? `Acertos no treino: ${score} / ${totalQ} ${score === totalQ ? '🎉' : '💪'}`
      : `Nota: ${score} / ${totalQ} ${passed ? '🎉' : '💪'}`;

    ctaContainer.innerHTML = '';
    const durationNote = typeof durationSeconds === 'number' && durationSeconds > 0
      ? ` (⏱️ Tempo: <strong>${formatDuration(durationSeconds)}</strong>)`
      : '';

    if (isErrorDrill) {
      const isMixedDrill = subjKey === 'mixed';
      const remainingErrors = isMixedDrill
        ? getTotalPendingErrorsSummary().pendingExam
        : getPendingExamErrorQuestions(subj, st).length;
      statusMsg.innerHTML = remainingErrors === 0
        ? `<strong>Mandou muito bem, Pantoja!</strong> Você acertou todas as <strong>${totalQ}</strong> questões que tinha errado antes ${isMixedDrill ? 'nas <strong>3 frentes</strong>' : `em <strong>${escapeHtml(subj.title)}</strong>`}!${durationNote}`
        : `Você resolveu <strong>${score}/${totalQ}</strong> questão(ões) neste treino${durationNote}. Ainda restam <strong>${remainingErrors}</strong> pendente(s) para revisar sem gastar tentativas do dia.`;
      if (remainingErrors > 0) {
        const btnRetryErrors = document.createElement('button');
        btnRetryErrors.type = 'button';
        btnRetryErrors.className = 'primary';
        btnRetryErrors.textContent = `🧠 Treinar Erros Restantes (${remainingErrors})`;
        btnRetryErrors.addEventListener('click', () => {
          if (isMixedDrill) {
            openMixedExamErrorDrill();
          } else {
            openExamErrorDrill(subjKey);
          }
        });
        ctaContainer.appendChild(btnRetryErrors);
      }
    } else if (isPracticeMode) {
      statusMsg.innerHTML = `🔁 <strong>Treino Livre concluído:</strong> você acertou <strong>${score}/${totalQ}</strong>${durationNote} sem gastar suas tentativas do dia.`;
      const btnRetake = document.createElement('button');
      btnRetake.type = 'button';
      btnRetake.className = 'primary';
      btnRetake.textContent = '🔁 Refazer este treino';
      btnRetake.addEventListener('click', () => {
        renderExamView({
          subjKey,
          subj,
          examObj,
          attemptLabel: `🔁 Refazendo em modo treino livre • Não consome tentativas do dia`,
          noticeHtml: '🔁 <strong>Treino Livre:</strong> Refaça esta prova sem gastar suas 3 tentativas diárias. Questões acertadas aqui também saem da lista de pendências.',
          mode: 'practice',
        });
      });
      ctaContainer.appendChild(btnRetake);
    } else if (isHistoryReview) {
      statusMsg.innerHTML = `📜 <strong>Revisão do Histórico (Dia ${escapeHtml(dayNumber)}):</strong> você tirou <strong>${score}/${totalQ}</strong> nesta tentativa${durationNote}. Confira abaixo todas as questões e comentários.`;
      if (typeof historyIndex === 'number' && historyIndex >= 0) {
        const btnRetakeHistory = document.createElement('button');
        btnRetakeHistory.type = 'button';
        btnRetakeHistory.className = 'primary';
        btnRetakeHistory.textContent = '🔁 Refazer esta prova (treino livre)';
        btnRetakeHistory.addEventListener('click', () => openHistoryExamPractice(subjKey, historyIndex));
        ctaContainer.appendChild(btnRetakeHistory);
      }
    } else if (passed) {
      statusMsg.innerHTML = `<strong>Excelente, Pantoja!</strong> Você tirou <strong>${score}/${totalQ}</strong>${durationNote} (meta era ≥ 8) e concluiu <strong>${escapeHtml(subj.title)}</strong> por hoje!`;
    } else if (st.examsTodayCount < 3) {
      const remaining = 3 - st.examsTodayCount;
      statusMsg.innerHTML = `Você tirou <strong>${score}/${totalQ}</strong>${durationNote} (a meta é ≥ 8). Revise o gabarito abaixo com atenção e tente a próxima prova! Você ainda tem <strong>${remaining} tentativa(s)</strong> hoje em ${escapeHtml(subj.title)}.`;
      const btnRetry = document.createElement('button');
      btnRetry.type = 'button';
      btnRetry.className = 'primary';
      btnRetry.textContent = `📝 Fazer Próxima Prova de ${subj.title} (Tentativa ${st.examsTodayCount + 1}/3)`;
      btnRetry.addEventListener('click', () => openExam(subjKey));
      ctaContainer.appendChild(btnRetry);
    } else {
      statusMsg.innerHTML = `Você tirou <strong>${score}/${totalQ}</strong>${durationNote} e completou o limite de <strong>3 provas de hoje</strong> em ${escapeHtml(subj.title)} (Melhor nota: ${st.bestScoreToday}/${totalQ}). Revise o gabarito abaixo e mande o Relatório do Dia para o Peter ajustar a revisão de amanhã!`;
    }

    const hasUserAnswers = Array.isArray(userAnswers) && userAnswers.length === totalQ;
    const wrongById = new Set((wrongQuestions || []).map((w) => w.id).filter(Boolean));
    const wrongByNum = new Set((wrongQuestions || []).map((w) => Number(w.number)).filter((n) => !Number.isNaN(n)));
    const wrongCount = hasUserAnswers
      ? examObj.questions.filter((q, idx) => userAnswers[idx] !== q.correct).length
      : (wrongQuestions || []).length;

    if (wrongCount > 0) {
      const btnCopyErrors = document.createElement('button');
      btnCopyErrors.type = 'button';
      btnCopyErrors.className = 'outline secondary';
      btnCopyErrors.textContent = `💬 Copiar ${wrongCount} erro(s) p/ dúvida`;
      btnCopyErrors.addEventListener('click', async () => {
        const text = buildExamErrorsWhatsAppText({ subj, examObj, score, userAnswers, wrongQuestions });
        try {
          await navigator.clipboard.writeText(text);
          showToast('💬 Erros copiados! Só colar no WhatsApp para tirar dúvida.');
        } catch (err) {
          showToast('⚠️ Não foi possível copiar automaticamente.');
        }
      });
      ctaContainer.appendChild(btnCopyErrors);
    }

    if (!isErrorDrill && subjKey !== 'mixed' && subj && st) {
      const pendingSubjectErrors = getPendingExamErrorQuestions(subj, st).length;
      if (pendingSubjectErrors > 0) {
        const btnPracticeSubjectErrors = document.createElement('button');
        btnPracticeSubjectErrors.type = 'button';
        btnPracticeSubjectErrors.className = 'outline secondary';
        btnPracticeSubjectErrors.textContent = `🧠 Treinar Erros de Prova (${pendingSubjectErrors})`;
        btnPracticeSubjectErrors.addEventListener('click', () => openExamErrorDrill(subjKey));
        ctaContainer.appendChild(btnPracticeSubjectErrors);
      }
    }

    const btnBackDash = document.createElement('button');
    btnBackDash.type = 'button';
    btnBackDash.className = 'outline secondary';
    btnBackDash.textContent = '← Voltar ao Painel Principal';
    btnBackDash.addEventListener('click', () => {
      renderDashboard();
      showView('view-dashboard');
    });
    ctaContainer.appendChild(btnBackDash);

    const btnAll = document.getElementById('btn-filter-all');
    const btnWrong = document.getElementById('btn-filter-wrong');
    if (btnAll && btnWrong) {
      btnAll.textContent = `Todas (${totalQ})`;
      btnWrong.textContent = `Apenas Erros (${wrongCount})`;
      btnWrong.disabled = wrongCount === 0;
      applyResultReviewFilter('all');
    }

    const reviewContainer = document.getElementById('result-review-container');
    reviewContainer.innerHTML = '';

    examObj.questions.forEach((q, idx) => {
      const userAns = hasUserAnswers ? userAnswers[idx] : null;
      const isRight = hasUserAnswers
        ? userAns === q.correct
        : !(wrongById.has(q.id) || wrongByNum.has(idx + 1));

      const card = document.createElement('article');
      card.className = `review-q-card ${isRight ? 'is-correct' : 'is-wrong'}`;

      const optionsReviewHtml = Array.isArray(q.options)
        ? `<ul class="review-options-list">
            ${q.options
              .map((optText, optIdx) => {
                const isCorrectOpt = optIdx === q.correct;
                const isUserOpt = hasUserAnswers && userAns === optIdx;
                const itemCls = isCorrectOpt
                  ? 'is-correct-opt'
                  : isUserOpt
                  ? 'is-user-wrong-opt'
                  : '';
                const tag = isCorrectOpt
                  ? '<span class="review-opt-tag">✅ Correta</span>'
                  : isUserOpt
                  ? '<span class="review-opt-tag">❌ Sua resposta</span>'
                  : '';
                return `<li class="review-opt-item ${itemCls}"><span><strong>${letters[optIdx]})</strong> ${escapeHtml(optText)}</span>${tag}</li>`;
              })
              .join('')}
          </ul>`
        : '';

      const legacyChoiceLine = !hasUserAnswers
        ? `<p class="review-ans-line muted-text"><strong>Sua resposta:</strong> ${isRight ? 'Acertou (alternativa não registrada no histórico antigo)' : 'Errou (alternativa não registrada no histórico antigo)'}</p>`
        : '';

      card.innerHTML = `
        <span class="question-num">Questão ${idx + 1}${q._sourceExamTitle ? ` • ${escapeHtml(q._sourceExamTitle)}` : ''} • ${isRight ? '✅ Acertou' : '❌ Errou'}</span>
        <p class="question-text">${escapeHtml(q.text)}</p>
        ${legacyChoiceLine}
        ${optionsReviewHtml}
        <details ${!isRight ? 'open' : ''}>
          <summary><small><strong>💡 Comentário da questão</strong></small></summary>
          <p class="muted-text" style="margin-top:0.4rem;">${escapeHtml(q.explanation)}</p>
        </details>
      `;

      reviewContainer.appendChild(card);
    });

    updateToggleAllExplanationsBtn();
    showView('view-exam-result');
  }

  function openHistoryExamResult(subjKey, historyIndex) {
    const subj = getSubjectsMap()[subjKey];
    const st = appState.subjects[subjKey];
    if (!subj || !st || !Array.isArray(st.examHistory)) return;
    const entry = st.examHistory[historyIndex];
    if (!entry) return;
    const examObj = subj.exams.find((ex) => ex.id === entry.examId) || subj.exams.find((ex) => ex.title === entry.examTitle);
    if (!examObj) return;

    renderExamResultView({
      subjKey,
      subj,
      st,
      examObj,
      score: entry.score,
      passed: Boolean(entry.passed),
      userAnswers: entry.userAnswers,
      wrongQuestions: entry.wrongQuestions,
      isHistoryReview: true,
      historyIndex,
      dayNumber: entry.dayNumber || 1,
      durationSeconds: entry.durationSeconds ?? null,
    });
  }

  function gradeAndShowExamResult(userAnswers, durationSeconds = null) {
    const subj = getSubjectsMap()[activeSubjectKey];
    const st = appState.subjects[activeSubjectKey];
    const draftKey = `${activeSubjectKey}:${activeExamObj.id}`;
    if (appState.examDrafts && appState.examDrafts[draftKey]) {
      delete appState.examDrafts[draftKey];
    }
    if (appState.examDraftFlags && appState.examDraftFlags[draftKey]) {
      delete appState.examDraftFlags[draftKey];
    }
    if (appState.examDraftTimers && appState.examDraftTimers[draftKey]) {
      delete appState.examDraftTimers[draftKey];
    }

    let score = 0;
    const wrongQuestions = [];

    activeExamObj.questions.forEach((q, idx) => {
      const qKey = getExamQuestionKey(q, activeExamObj.id, idx + 1);
      if (userAnswers[idx] === q.correct) {
        score++;
      } else {
        if (st.resolvedExamErrors && st.resolvedExamErrors[qKey]) {
          delete st.resolvedExamErrors[qKey];
        }
        wrongQuestions.push({
          id: q.id,
          number: idx + 1,
          text: q.text,
        });
      }
    });

    st.examsTodayCount += 1;
    st.nextExamIndex = (st.nextExamIndex + 1) % subj.exams.length;
    if (st.bestScoreToday === null || score > st.bestScoreToday) {
      st.bestScoreToday = score;
    }

    const passed = score >= 8;
    if (passed) {
      st.passedToday = true;
    }

    st.examHistory.push({
      date: appState.currentDay,
      dayNumber: appState.dayNumber || 1,
      examId: activeExamObj.id,
      examTitle: activeExamObj.title,
      score,
      passed,
      durationSeconds,
      userAnswers: [...userAnswers],
      wrongQuestions,
    });

    saveState();

    renderExamResultView({
      subjKey: activeSubjectKey,
      subj,
      st,
      examObj: activeExamObj,
      score,
      passed,
      userAnswers,
      wrongQuestions,
      isHistoryReview: false,
      dayNumber: appState.dayNumber || 1,
      durationSeconds,
    });
  }

  function gradeAndShowErrorDrillResult(userAnswers, durationSeconds = null) {
    const isMixedDrill = activeSubjectKey === 'mixed';
    const subj = isMixedDrill ? { title: 'Revisão Mista' } : getSubjectsMap()[activeSubjectKey];
    const st = isMixedDrill ? null : appState.subjects[activeSubjectKey];
    const draftKey = `${activeSubjectKey}:${activeExamObj.id}`;
    if (appState.examDrafts && appState.examDrafts[draftKey]) {
      delete appState.examDrafts[draftKey];
    }
    if (appState.examDraftFlags && appState.examDraftFlags[draftKey]) {
      delete appState.examDraftFlags[draftKey];
    }
    if (appState.examDraftTimers && appState.examDraftTimers[draftKey]) {
      delete appState.examDraftTimers[draftKey];
    }

    let score = 0;
    const wrongQuestions = [];

    activeExamObj.questions.forEach((q, idx) => {
      const targetSubjKey = q._subjKey || activeSubjectKey;
      const targetSt = appState.subjects[targetSubjKey];
      const qKey = q._rawErrorKey || q._errorKey || getExamQuestionKey(q, activeExamObj.id, idx + 1);
      if (userAnswers[idx] === q.correct) {
        score++;
        if (targetSt) {
          if (!targetSt.resolvedExamErrors || typeof targetSt.resolvedExamErrors !== 'object') {
            targetSt.resolvedExamErrors = {};
          }
          targetSt.resolvedExamErrors[qKey] = true;
        }
      } else {
        wrongQuestions.push({
          id: q.id,
          number: idx + 1,
          text: q.text,
        });
      }
    });

    saveState();

    renderExamResultView({
      subjKey: activeSubjectKey,
      subj,
      st,
      examObj: activeExamObj,
      score,
      passed: wrongQuestions.length === 0,
      userAnswers,
      wrongQuestions,
      isErrorDrill: true,
      dayNumber: appState.dayNumber || 1,
      durationSeconds,
    });
  }

  function gradeAndShowPracticeResult(userAnswers, durationSeconds = null) {
    const subj = getSubjectsMap()[activeSubjectKey];
    const st = appState.subjects[activeSubjectKey];
    const draftKey = `${activeSubjectKey}:${activeExamObj.id}`;
    if (appState.examDrafts && appState.examDrafts[draftKey]) {
      delete appState.examDrafts[draftKey];
    }
    if (appState.examDraftFlags && appState.examDraftFlags[draftKey]) {
      delete appState.examDraftFlags[draftKey];
    }
    if (appState.examDraftTimers && appState.examDraftTimers[draftKey]) {
      delete appState.examDraftTimers[draftKey];
    }
    if (!st.resolvedExamErrors || typeof st.resolvedExamErrors !== 'object') {
      st.resolvedExamErrors = {};
    }

    const baseExamId = activeExamObj._sourceExamId || activeExamObj.id;
    let score = 0;
    const wrongQuestions = [];

    activeExamObj.questions.forEach((q, idx) => {
      const qKey = getExamQuestionKey(q, baseExamId, idx + 1);
      if (userAnswers[idx] === q.correct) {
        score++;
        st.resolvedExamErrors[qKey] = true;
      } else {
        delete st.resolvedExamErrors[qKey];
        wrongQuestions.push({
          id: q.id,
          number: idx + 1,
          text: q.text,
        });
      }
    });

    saveState();

    renderExamResultView({
      subjKey: activeSubjectKey,
      subj,
      st,
      examObj: activeExamObj,
      score,
      passed: score >= 8,
      userAnswers,
      wrongQuestions,
      isPracticeMode: true,
      dayNumber: appState.dayNumber || 1,
      durationSeconds,
    });
  }

  document.getElementById('btn-back-from-exam').addEventListener('click', () => {
    renderDashboard();
    showView('view-dashboard');
  });

  document.getElementById('btn-back-from-result').addEventListener('click', () => {
    renderDashboard();
    showView('view-dashboard');
  });

  // ==========================================================================
  // DAILY REPORT & JSON SAVE / RESTORE
  // ==========================================================================
  function generateReportAndSaveText() {
    const subjects = getSubjectsMap();
    const lines = [];
    lines.push(`📊 *RELATÓRIO DE REVISÃO — PANTOJA (8º ANO)*`);
    lines.push(`📅 Dia ${appState.dayNumber || 1} (${formatDateBR(appState.currentDay)})`);

    let totalUniqueExams = 0;
    let doneUniqueExams = 0;
    let passedUniqueExams = 0;
    for (const key of ['quimica', 'biologia', 'fisica']) {
      const subj = subjects[key];
      const st = appState.subjects[key];
      if (!subj || !st) continue;
      totalUniqueExams += subj.exams.length;
      for (const ex of subj.exams) {
        const matches = (st.examHistory || []).filter((h) => h.examId === ex.id || h.examTitle === ex.title);
        if (matches.length > 0) {
          doneUniqueExams++;
          if (matches.some((h) => h.score >= 8 || h.passed)) passedUniqueExams++;
        }
      }
    }
    const { pendingVf, pendingExam } = getTotalPendingErrorsSummary();
    lines.push(`📚 Edital: ${doneUniqueExams}/${totalUniqueExams} provas feitas (${passedUniqueExams} com meta ≥8) • Pendências: ${pendingVf} V/F, ${pendingExam} de prova`);
    lines.push('');

    for (const key of ['quimica', 'biologia', 'fisica']) {
      const subj = subjects[key];
      const st = appState.subjects[key];
      if (!subj || !st) continue;

      const mastered = subj.cards.filter((c) => (st.cardBoxes[c.id] || 0) >= 2).length;
      const missedCards = subj.cards
        .filter((c) => (st.cardErrorsToday[c.id] || 0) > 0)
        .sort((a, b) => (st.cardErrorsToday[b.id] || 0) - (st.cardErrorsToday[a.id] || 0));

      lines.push(`🔹 *${subj.title.toUpperCase()}*`);
      lines.push(`• V/F Dominados: ${mastered}/30 ${st.vfCompletedToday ? '✅' : '⏳'}`);

      if (missedCards.length > 0) {
        const missedSummary = missedCards
          .slice(0, 6)
          .map((c) => `${c.id} (${c.topic}: ${st.cardErrorsToday[c.id]}x)`)
          .join(', ');
        const extraNote = missedCards.length > 6 ? ` (+ ${missedCards.length - 6} outro(s))` : '';
        lines.push(`• Cards V/F com erro hoje (${missedCards.length}): ${missedSummary}${extraNote}`);
      } else {
        lines.push(`• Cards V/F com erro hoje: Nenhum! 🎯`);
      }

      const todayExams = (st.examHistory || []).filter((h) => h.dayNumber === (appState.dayNumber || 1));
      if (todayExams.length > 0) {
        for (const ex of todayExams) {
          const wrongIds = (ex.wrongQuestions || []).map((w) => `Q${w.number}`).join(', ');
          const durText = typeof ex.durationSeconds === 'number' && ex.durationSeconds > 0
            ? ` [${formatDuration(ex.durationSeconds)}]`
            : '';
          lines.push(
            `• ${ex.examTitle}: Nota *${ex.score}/10*${durText} ${ex.passed ? '✅' : '⚠️'} ${
              wrongIds ? `(Errou: ${wrongIds})` : '(Gabaritou!)'
            }`
          );
        }
      } else {
        lines.push(`• Provas realizadas hoje: 0/3`);
      }
      lines.push('');
    }

    lines.push('--- SAVE_JSON_START ---');
    lines.push(JSON.stringify(appState));
    lines.push('--- SAVE_JSON_END ---');

    return lines.join('\n');
  }

  function updateReportTextarea() {
    const ta = document.getElementById('report-textarea');
    if (ta) {
      ta.value = generateReportAndSaveText();
    }
  }

  let toastTimer = null;
  let glossaryToastTimer = null;
  let globalToastTimer = null;

  function showToast(msg) {
    const isReportOpen = Boolean(dialogReport && dialogReport.open);
    const isGlossaryOpen = Boolean(dialogGlossary && dialogGlossary.open);
    const toast = isReportOpen
      ? document.getElementById('report-feedback-toast')
      : isGlossaryOpen
      ? document.getElementById('glossary-feedback-toast')
      : document.getElementById('global-toast');
    if (!toast) return;

    if (isReportOpen) {
      if (toastTimer) clearTimeout(toastTimer);
      toast.textContent = msg;
      toast.hidden = false;
      toastTimer = setTimeout(() => {
        toast.hidden = true;
        toastTimer = null;
      }, 3500);
    } else if (isGlossaryOpen) {
      if (glossaryToastTimer) clearTimeout(glossaryToastTimer);
      toast.textContent = msg;
      toast.hidden = false;
      glossaryToastTimer = setTimeout(() => {
        toast.hidden = true;
        glossaryToastTimer = null;
      }, 3500);
    } else {
      if (globalToastTimer) clearTimeout(globalToastTimer);
      toast.textContent = msg;
      toast.hidden = false;
      globalToastTimer = setTimeout(() => {
        toast.hidden = true;
        globalToastTimer = null;
      }, 3500);
    }
  }

  document.getElementById('btn-copy-report').addEventListener('click', async () => {
    updateReportTextarea();
    const ta = document.getElementById('report-textarea');
    try {
      await navigator.clipboard.writeText(ta.value);
      showToast('✅ Relatório + Save JSON copiado! Só colar no WhatsApp do Peter.');
    } catch (err) {
      ta.select();
      document.execCommand('copy');
      showToast('✅ Relatório copiado para a área de transferência!');
    }
  });

  document.getElementById('btn-download-json').addEventListener('click', () => {
    const jsonStr = JSON.stringify(appState, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pantoja-save-dia-${appState.dayNumber || 1}-${appState.currentDay}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('💾 Arquivo JSON baixado com sucesso!');
  });

  function importSaveFromText(rawText) {
    if (!rawText || !rawText.trim()) {
      showToast('⚠️ Cole um JSON válido primeiro.');
      return;
    }

    let jsonCandidate = rawText.trim();
    const startMarker = '--- SAVE_JSON_START ---';
    const endMarker = '--- SAVE_JSON_END ---';
    if (jsonCandidate.includes(startMarker) && jsonCandidate.includes(endMarker)) {
      jsonCandidate = jsonCandidate.split(startMarker)[1].split(endMarker)[0].trim();
    }

    try {
      const parsed = JSON.parse(jsonCandidate);
      if (!parsed || typeof parsed !== 'object' || !parsed.subjects) {
        throw new Error('Formato inválido');
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      appState = loadState();
      checkDailyRollover();
      examFocusMode = Boolean(appState.examFocusMode);
      examAutoAdvance = Boolean(appState.examAutoAdvance);
      lastVfUndoSnapshot = null;
      saveState();
      applyTheme(appState.theme || 'light');
      renderDashboard();
      updateReportTextarea();
      const importTextarea = document.getElementById('import-json-textarea');
      if (importTextarea) importTextarea.value = '';
      showView('view-dashboard');
      showToast('✅ Save JSON carregado e aplicado com sucesso!');
    } catch (err) {
      showToast('❌ Erro ao ler o JSON. Verifique se copiou o texto completo.');
    }
  }

  function setupTwoStepConfirm(buttonEl, confirmLabel, onConfirm, shouldConfirmFn = () => true) {
    if (!buttonEl) return null;
    const defaultLabel = buttonEl.textContent;
    let confirmTimer = null;

    const resetButton = () => {
      buttonEl.dataset.confirmPending = 'false';
      buttonEl.textContent = defaultLabel;
      buttonEl.classList.remove('is-confirming');
      if (confirmTimer) {
        clearTimeout(confirmTimer);
        confirmTimer = null;
      }
    };

    buttonEl.addEventListener('click', () => {
      if (!shouldConfirmFn() || buttonEl.dataset.confirmPending === 'true') {
        resetButton();
        onConfirm();
        return;
      }
      buttonEl.dataset.confirmPending = 'true';
      buttonEl.textContent = confirmLabel;
      buttonEl.classList.add('is-confirming');
      confirmTimer = setTimeout(resetButton, 4000);
    });

    return resetButton;
  }

  document.getElementById('btn-import-json-text').addEventListener('click', () => {
    const raw = document.getElementById('import-json-textarea').value;
    importSaveFromText(raw);
  });

  document.getElementById('input-import-file').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      importSaveFromText(String(reader.result || ''));
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('btn-dashboard-next-day')?.addEventListener('click', () => {
    advanceToNextDay();
    showToast(`🌅 Dia ${appState.dayNumber} iniciado! Cartões com erros foram priorizados.`);
  });

  // ==========================================================================
  // GLOSSARY / QUICK CONCEPT SEARCH MODAL
  // ==========================================================================
  let glossarySubjectFilter = 'all';
  let glossarySource = 'cards'; // 'cards' | 'exams'
  let lastGlossaryExportText = '';

  function normalizeSearchText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function highlightSearchMatch(text, normalizedQuery) {
    const raw = String(text ?? '');
    if (!normalizedQuery) return escapeHtml(raw);

    let norm = '';
    const starts = [];
    const ends = [];
    let origPos = 0;

    for (const ch of raw) {
      const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      for (const bCh of base) {
        norm += bCh;
        starts.push(origPos);
        ends.push(origPos + ch.length);
      }
      origPos += ch.length;
    }

    const qLen = normalizedQuery.length;
    if (!norm.includes(normalizedQuery)) return escapeHtml(raw);

    let out = '';
    let lastOrigIdx = 0;
    let searchFrom = 0;

    while (searchFrom < norm.length) {
      const matchIdx = norm.indexOf(normalizedQuery, searchFrom);
      if (matchIdx === -1) break;
      const origStart = starts[matchIdx];
      const origEnd = ends[matchIdx + qLen - 1];
      if (origStart > lastOrigIdx) {
        out += escapeHtml(raw.slice(lastOrigIdx, origStart));
      }
      out += `<mark>${escapeHtml(raw.slice(origStart, origEnd))}</mark>`;
      lastOrigIdx = origEnd;
      searchFrom = matchIdx + qLen;
    }

    if (lastOrigIdx < raw.length) {
      out += escapeHtml(raw.slice(lastOrigIdx));
    }
    return out;
  }

  function renderGlossaryResults() {
    const listEl = document.getElementById('glossary-results-list');
    const countEl = document.getElementById('glossary-count-label');
    const pendingWrap = document.getElementById('glossary-pending-wrap');
    const copyBtn = document.getElementById('btn-copy-glossary');
    if (!listEl || !countEl) return;

    if (pendingWrap) {
      pendingWrap.hidden = glossarySource !== 'cards';
    }

    const query = normalizeSearchText(document.getElementById('glossary-search-input')?.value);
    const onlyErrors = Boolean(document.getElementById('glossary-only-errors')?.checked);
    const onlyPending = Boolean(document.getElementById('glossary-only-pending')?.checked);
    const subjects = getSubjectsMap();
    const keys = glossarySubjectFilter === 'all' ? ['quimica', 'biologia', 'fisica'] : [glossarySubjectFilter];

    if (glossarySource === 'exams') {
      const letters = ['A', 'B', 'C', 'D'];
      const matches = [];
      let totalAttempted = 0;

      for (const key of keys) {
        const subj = subjects[key];
        const st = appState.subjects[key];
        if (!subj || !st || !Array.isArray(st.examHistory)) continue;

        const seenExams = new Set();
        const wrongSet = new Set();
        for (const h of st.examHistory) {
          const examObj = subj.exams.find((ex) => ex.id === h.examId) || subj.exams.find((ex) => ex.title === h.examTitle);
          if (!examObj) continue;
          seenExams.add(examObj.id);
          for (const w of h.wrongQuestions || []) {
            const qObj = findExamQuestion(subj, examObj.id, w);
            if (qObj) wrongSet.add(getExamQuestionKey(qObj, examObj.id, w.number));
          }
        }

        for (const examObj of subj.exams) {
          if (!seenExams.has(examObj.id)) continue;
          examObj.questions.forEach((q, idx) => {
            totalAttempted++;
            const qKey = getExamQuestionKey(q, examObj.id, idx + 1);
            const wasWrong = wrongSet.has(qKey);
            const isResolved = Boolean(st.resolvedExamErrors && st.resolvedExamErrors[qKey]);
            if (onlyErrors && !wasWrong) return;

            if (query) {
              const haystack = normalizeSearchText(
                `${subj.title} ${examObj.title} ${q.text} ${(q.options || []).join(' ')} ${q.explanation}`
              );
              if (!haystack.includes(query)) return;
            }

            matches.push({
              subjTitle: subj.title,
              examTitle: examObj.title,
              qNumber: idx + 1,
              question: q,
              wasWrong,
              isResolved,
            });
          });
        }
      }

      matches.sort((a, b) => Number(b.wasWrong && !b.isResolved) - Number(a.wasWrong && !a.isResolved) || Number(b.wasWrong) - Number(a.wasWrong));
      countEl.textContent = `Exibindo ${matches.length} de ${totalAttempted} questões de provas já feitas`;
      if (copyBtn) copyBtn.disabled = matches.length === 0;

      lastGlossaryExportText = matches
        .map((m) => `${m.subjTitle} • ${m.examTitle} Q${m.qNumber}\n${m.question.text}\nGabarito: ${letters[m.question.correct]}) ${m.question.options[m.question.correct]}\nComentário: ${m.question.explanation}`)
        .join('\n\n');

      if (totalAttempted === 0) {
        listEl.innerHTML = '<p class="muted-text">As questões de prova aparecem aqui automaticamente depois que você concluir sua primeira prova (sem dar spoiler das próximas!).</p>';
        return;
      }

      if (matches.length === 0) {
        listEl.innerHTML = '<p class="muted-text">Nenhuma questão encontrada para esse filtro.</p>';
        return;
      }

      listEl.innerHTML = matches
        .map(({ subjTitle, examTitle, qNumber, question, wasWrong, isResolved }) => {
          const correctLetter = letters[question.correct] || '?';
          const correctText = question.options?.[question.correct] || '';
          const errBadge = wasWrong
            ? isResolved
              ? '<span class="glossary-ans-pill is-true">✅ Erro revisado</span>'
              : '<span class="card-flag-tag">⚠️ Erro pendente</span>'
            : '';
          return `
            <article class="glossary-item">
              <div class="glossary-item-head">
                <span class="card-topic-tag">${escapeHtml(subjTitle)} • ${escapeHtml(examTitle)} Q${qNumber}</span>
                <div class="glossary-item-badges">
                  ${errBadge}
                  <span class="glossary-ans-pill is-true">Gabarito: ${correctLetter}</span>
                </div>
              </div>
              <p class="glossary-item-stmt">${highlightSearchMatch(question.text, query)}</p>
              <p class="glossary-item-stmt"><strong>${correctLetter})</strong> ${highlightSearchMatch(correctText, query)}</p>
              <p class="muted-text glossary-item-exp">${highlightSearchMatch(question.explanation, query)}</p>
            </article>
          `;
        })
        .join('');
      return;
    }

    const matches = [];
    let totalScope = 0;

    for (const key of keys) {
      const subj = subjects[key];
      const st = appState.subjects[key];
      if (!subj || !st) continue;

      for (const c of subj.cards) {
        totalScope++;
        const errCount = st.cardErrorsTotal[c.id] || 0;
        const isResolvedErr = errCount > 0 && Boolean(st.resolvedVfErrors && st.resolvedVfErrors[c.id]);
        const boxVal = st.cardBoxes[c.id] || 0;
        if (onlyErrors && errCount === 0) continue;
        if (onlyPending && boxVal >= 2) continue;

        if (query) {
          const haystack = normalizeSearchText(`${c.topic} ${c.statement} ${c.explanation} ${subj.title}`);
          if (!haystack.includes(query)) continue;
        }

        matches.push({ key, subjTitle: subj.title, card: c, errCount, isResolvedErr, boxVal });
      }
    }

    matches.sort((a, b) => Number(b.errCount > 0 && !b.isResolvedErr) - Number(a.errCount > 0 && !a.isResolvedErr) || b.errCount - a.errCount);
    countEl.textContent = `Exibindo ${matches.length} de ${totalScope} cartões V/F`;
    if (copyBtn) copyBtn.disabled = matches.length === 0;

    lastGlossaryExportText = matches
      .map(({ subjTitle, card }) => `[${subjTitle} • ${card.topic}] (${card.answer ? 'V' : 'F'}) ${card.statement}\n→ ${card.explanation}`)
      .join('\n\n');

    if (matches.length === 0) {
      listEl.innerHTML = '<p class="muted-text">Nenhum conceito encontrado para esse filtro.</p>';
      return;
    }

    listEl.innerHTML = matches
      .map(
        ({ subjTitle, card, errCount, isResolvedErr, boxVal }) => `
        <article class="glossary-item">
          <div class="glossary-item-head">
            <span class="card-topic-tag">${highlightSearchMatch(`${subjTitle} • ${card.topic}`, query)}</span>
            <div class="glossary-item-badges">
              <span class="card-box-tag">Caixa ${boxVal}/2</span>
              ${
                errCount > 0
                  ? isResolvedErr
                    ? `<span class="glossary-ans-pill is-true">✅ Revisado (${errCount}x)</span>`
                    : `<span class="card-flag-tag">⚠️ ${errCount}x erro</span>`
                  : ''
              }
              <span class="glossary-ans-pill ${card.answer ? 'is-true' : 'is-false'}">
                ${card.answer ? 'VERDADEIRO ✅' : 'FALSO ❌'}
              </span>
            </div>
          </div>
          <p class="glossary-item-stmt">${highlightSearchMatch(card.statement, query)}</p>
          <p class="muted-text glossary-item-exp">${highlightSearchMatch(card.explanation, query)}</p>
        </article>
      `
      )
      .join('');
  }

  document.getElementById('glossary-search-input')?.addEventListener('input', () => {
    renderGlossaryResults();
  });

  document.getElementById('glossary-only-errors')?.addEventListener('change', () => {
    renderGlossaryResults();
  });

  document.getElementById('glossary-only-pending')?.addEventListener('change', () => {
    renderGlossaryResults();
  });

  document.getElementById('glossary-source-tabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-source]');
    if (!btn) return;
    glossarySource = btn.dataset.source;
    for (const b of e.currentTarget.querySelectorAll('button[data-source]')) {
      b.className = b === btn ? 'btn-xs primary' : 'btn-xs outline secondary';
    }
    renderGlossaryResults();
  });

  document.getElementById('glossary-subject-filters')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-subj]');
    if (!btn) return;
    glossarySubjectFilter = btn.dataset.subj;
    for (const b of e.currentTarget.querySelectorAll('button[data-subj]')) {
      b.className = b === btn ? 'btn-xs primary' : 'btn-xs outline secondary';
    }
    renderGlossaryResults();
  });

  document.getElementById('btn-copy-glossary')?.addEventListener('click', async () => {
    if (!lastGlossaryExportText) return;
    try {
      await navigator.clipboard.writeText(lastGlossaryExportText);
      showToast('📋 Lista copiada para revisar!');
    } catch (err) {
      showToast('⚠️ Não foi possível copiar automaticamente.');
    }
  });

  const resetClearDraftConfirm = setupTwoStepConfirm(
    document.getElementById('btn-clear-exam-draft'),
    '⚠️ Clique de novo para limpar',
    () => {
      if (!activeExamObj || !activeSubjectKey) return;
      clearExamAutoAdvanceTimer();
      const draftKey = `${activeSubjectKey}:${activeExamObj.id}`;
      if (appState.examDrafts && appState.examDrafts[draftKey]) {
        delete appState.examDrafts[draftKey];
      }
      if (appState.examDraftFlags && appState.examDraftFlags[draftKey]) {
        delete appState.examDraftFlags[draftKey];
      }
      if (appState.examDraftTimers && appState.examDraftTimers[draftKey]) {
        delete appState.examDraftTimers[draftKey];
      }
      startExamTimer(0);
      saveState();
      const form = document.getElementById('exam-form');
      if (form) {
        for (const input of form.querySelectorAll('input[type="radio"]:checked')) {
          input.checked = false;
        }
        for (const card of form.querySelectorAll('.question-card')) {
          card.classList.remove('is-missing', 'is-flagged');
        }
        for (const flagBtn of form.querySelectorAll('.btn-flag-question')) {
          flagBtn.classList.remove('is-flagged');
          flagBtn.setAttribute('aria-pressed', 'false');
          flagBtn.textContent = '🏳️ Revisar depois';
        }
        for (const clearBtn of form.querySelectorAll('.btn-clear-question')) {
          clearBtn.hidden = true;
        }
      }
      const incMsg = document.getElementById('exam-incomplete-msg');
      if (incMsg) incMsg.hidden = true;
      resetSubmitExamConfirm();
      updateExamNavAndProgress();
    }
  );

  const resetAdvanceDayConfirm = setupTwoStepConfirm(
    document.getElementById('btn-advance-day'),
    '⚠️ Dia incompleto — Clique de novo para virar',
    () => {
      advanceToNextDay();
      updateReportTextarea();
      showView('view-dashboard');
      showToast(`⏭️ Dia ${appState.dayNumber} iniciado! Os cartões com mais erros foram priorizados.`);
    },
    () => !isDayFullyFinished(appState)
  );

  const resetAllConfirm = setupTwoStepConfirm(
    document.getElementById('btn-reset-all'),
    '⚠️ Clique de novo para ZERAR TUDO',
    () => {
      localStorage.removeItem(STORAGE_KEY);
      lastVfUndoSnapshot = null;
      clearExamAutoAdvanceTimer();
      examPausedByDialog = false;
      stopExamTimer();
      appState = loadState();
      examFocusMode = Boolean(appState.examFocusMode);
      examAutoAdvance = Boolean(appState.examAutoAdvance);
      renderDashboard();
      updateReportTextarea();
      showView('view-dashboard');
      showToast('🗑️ Progresso zerado.');
    }
  );

  dialogReport?.addEventListener('close', () => {
    resetAdvanceDayConfirm?.();
    resetAllConfirm?.();
    resumeExamAfterModal();
  });

  // Boot
  renderDashboard();
})();
