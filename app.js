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
  const btnOpenReport = document.getElementById('btn-open-report');
  const dialogReport = document.getElementById('dialog-report');
  if (btnOpenReport && dialogReport) {
    btnOpenReport.addEventListener('click', () => {
      updateReportTextarea();
      if (!dialogReport.open) {
        dialogReport.showModal();
      }
    });
  }

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
        subjects: {},
      };
    }

    for (const key of Object.keys(subjects)) {
      const subjData = subjects[key];
      if (!subjData) continue;
      if (!saved.subjects[key]) {
        saved.subjects[key] = createDefaultSubjectState(subjData);
      } else {
        // Ensure all 30 cards exist in state
        const st = saved.subjects[key];
        for (const c of subjData.cards) {
          if (typeof st.cardBoxes[c.id] !== 'number') st.cardBoxes[c.id] = 0;
          if (typeof st.cardErrorsToday[c.id] !== 'number') st.cardErrorsToday[c.id] = 0;
          if (typeof st.cardErrorsTotal[c.id] !== 'number') st.cardErrorsTotal[c.id] = 0;
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

    saveState();
    if (shouldRender) {
      renderDashboard();
    }
  }

  function checkDailyRollover() {
    const today = getTodayString();
    if (!appState.currentDay || today <= appState.currentDay) return;

    if (isDayFullyFinished(appState)) {
      advanceToNextDay(false);
    } else {
      // Preserve partial progress (or untouched state) when moving to a new calendar date
      appState.currentDay = today;
      saveState();
    }
  }

  let appState = loadState();
  checkDailyRollover();
  let activeSubjectKey = null;
  let activeExamObj = null;

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

  // Views switcher
  function showView(viewId) {
    const views = ['view-dashboard', 'view-flashcards', 'view-exam', 'view-exam-result'];
    for (const id of views) {
      const el = document.getElementById(id);
      if (el) el.hidden = id !== viewId;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================================================
  // DASHBOARD RENDERING
  // ==========================================================================
  function renderDashboard() {
    const subjects = getSubjectsMap();
    const container = document.getElementById('subject-cards-container');
    const dateLabel = document.getElementById('today-date-label');
    if (dateLabel) {
      dateLabel.textContent = `Dia ${appState.dayNumber || 1} (${formatDateBR(appState.currentDay)})`;
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
      st.vfCompletedToday = vfDone;

      let chipClass = 'chip-pending';
      let chipText = 'Pendente';
      if (st.passedToday) {
        chipClass = 'chip-done';
        chipText = `Meta Batida (${st.bestScoreToday}/10) ✅`;
      } else if (st.examsTodayCount >= 3) {
        chipClass = 'chip-progress';
        chipText = `3/3 Provas Hoje (Melhor: ${st.bestScoreToday ?? 0}/10)`;
      } else if (vfDone || totalHits > 0) {
        chipClass = 'chip-progress';
        chipText = 'Em Andamento';
      }

      const nextExamNum = (st.nextExamIndex % subj.exams.length) + 1;
      const canTakeExam = vfDone && !st.passedToday && st.examsTodayCount < 3;

      const cardEl = document.createElement('article');
      cardEl.className = 'subject-card';
      cardEl.dataset.subject = key;

      cardEl.innerHTML = `
        <div>
          <header>
            <div class="subject-header-row">
              <h3>${subj.title}</h3>
              <span class="status-chip ${chipClass}">${chipText}</span>
            </div>
            <small class="subject-subtitle">${subj.subtitle}</small>
          </header>

          <div class="step-box">
            <div class="step-row">
              <span><strong>a) 30 Flashcards V/F</strong> (2 acertos cada)</span>
              <span><strong>${masteredCount}/${totalCards}</strong> ${vfDone ? '✅' : ''}</span>
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
          </div>
        </div>

        <div class="subject-actions">
          <button type="button" class="${vfDone ? 'outline secondary' : 'primary'}" data-action="start-vf" data-subject="${key}">
            ${vfDone ? '🔄 Revisar 30 V/F Novamente' : `🃏 Revisar Cartões V/F (${masteredCount}/30)`}
          </button>
          <button type="button" class="${canTakeExam ? 'primary' : 'outline secondary'}" data-action="start-exam" data-subject="${key}" ${!canTakeExam ? 'disabled' : ''}>
            ${
              st.passedToday
                ? `🏆 Concluído Hoje (Nota ${st.bestScoreToday}/10)`
                : st.examsTodayCount >= 3
                ? '🔒 Limite de 3 Provas Hoje Atingido'
                : !vfDone
                ? '🔒 Fazer Prova (Conclua os 30 V/F antes)'
                : `📝 Fazer Prova ${nextExamNum} (Tentativa ${st.examsTodayCount + 1}/3)`
            }
          </button>
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
      openFlashcards(subjKey);
    } else if (action === 'start-exam') {
      openExam(subjKey);
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

  function openFlashcards(subjKey) {
    activeSubjectKey = subjKey;
    const subj = getSubjectsMap()[subjKey];
    const st = appState.subjects[subjKey];

    // If all 30 are already mastered and she clicked "Revisar Novamente", reset boxes to 0 for a fresh practice
    const allMastered = subj.cards.every((c) => (st.cardBoxes[c.id] || 0) >= 2);
    if (allMastered) {
      for (const c of subj.cards) {
        st.cardBoxes[c.id] = 0;
      }
      rebuildQueueFromBoxes(st, subj);
      saveState();
    } else if (!st.vfQueue || st.vfQueue.length === 0) {
      rebuildQueueFromBoxes(st, subj);
      saveState();
    }

    document.getElementById('vf-subject-title').textContent = `${subj.title} — 30 V/F`;
    document.getElementById('vf-feedback-box').hidden = true;
    showView('view-flashcards');
    renderCurrentFlashcard();
  }

  function updateLeitnerCounters() {
    const subj = getSubjectsMap()[activeSubjectKey];
    const st = appState.subjects[activeSubjectKey];
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let totalPoints = 0;

    for (const c of subj.cards) {
      const box = st.cardBoxes[c.id] || 0;
      if (box === 0) b0++;
      else if (box === 1) b1++;
      else b2++;
      totalPoints += Math.min(2, box);
    }

    document.getElementById('count-box-0').textContent = b0;
    document.getElementById('count-box-1').textContent = b1;
    document.getElementById('count-box-2').textContent = b2;
    document.getElementById('vf-counter-badge').textContent = `${b2} / ${subj.cards.length} dominados`;

    const prog = document.getElementById('vf-progress-bar');
    prog.max = subj.cards.length * 2;
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
    const subj = getSubjectsMap()[activeSubjectKey];
    const st = appState.subjects[activeSubjectKey];
    const listEl = document.getElementById('vf-swipe-list');
    const feedbackBox = document.getElementById('vf-feedback-box');
    const swipeHint = document.getElementById('vf-swipe-hint');

    listEl.innerHTML = '';
    feedbackBox.hidden = true;

    // Filter queue to ensure only cards with box < 2 remain
    st.vfQueue = st.vfQueue.filter((id) => (st.cardBoxes[id] || 0) < 2);

    if (st.vfQueue.length === 0) {
      if (swipeHint) swipeHint.hidden = true;
      st.vfCompletedToday = true;
      saveState();

      const doneLi = document.createElement('li');
      doneLi.innerHTML = `
        <article style="text-align:center; padding: 2rem 1.25rem; border-top: 5px solid var(--vf-true-color);">
          <h2>🎉 Parabéns, Pantoja!</h2>
          <p>Você dominou todos os <strong>30 cartões V/F de ${subj.title}</strong> (revisão completa concluída)!</p>
          <p class="muted-text" style="margin-bottom: 1.25rem;">Agora as provas de ${subj.title} estão liberadas.</p>
          <div class="grid">
            <button type="button" class="primary" id="btn-go-to-exam-now">📝 Ir para a Prova Agora</button>
            <button type="button" class="outline secondary" id="btn-done-back-dash">← Voltar ao Painel</button>
          </div>
        </article>
      `;
      listEl.appendChild(doneLi);

      document.getElementById('btn-go-to-exam-now')?.addEventListener('click', () => {
        openExam(activeSubjectKey);
      });
      document.getElementById('btn-done-back-dash')?.addEventListener('click', () => {
        renderDashboard();
        showView('view-dashboard');
      });
      return;
    }

    if (swipeHint) swipeHint.hidden = false;

    const currentCardId = st.vfQueue[0];
    const cardObj = subj.cards.find((c) => c.id === currentCardId);
    const currentBox = st.cardBoxes[currentCardId] || 0;

    const li = document.createElement('li');
    li.className = 'SwipeableList-item';
    li.id = `card-item-${cardObj.id}`;

    li.innerHTML = `
      <div class="SwipeableList-track">
        <div class="SwipeableList-content">
          <div>
            <div class="card-meta-top">
              <span class="card-topic-tag">${cardObj.topic}</span>
              <span class="card-box-tag">Caixa ${currentBox} (${currentBox}/2 acertos)</span>
            </div>
            <p class="card-statement-text SwipeableList-label">${cardObj.statement}</p>
          </div>

          <div class="vf-button-pair">
            <button type="button" class="SwipeableList-action btn-vf-false" data-direction="right">
              👈 FALSO <span class="visually-hidden">${cardObj.statement}</span>
            </button>
            <button type="button" class="SwipeableList-action btn-vf-true" data-direction="left">
              VERDADEIRO 👉 <span class="visually-hidden">${cardObj.statement}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    listEl.appendChild(li);
  }

  function handleFlashcardAnswer(userAnswerBoolean) {
    const subj = getSubjectsMap()[activeSubjectKey];
    const st = appState.subjects[activeSubjectKey];
    if (!st.vfQueue || st.vfQueue.length === 0) return;

    const currentCardId = st.vfQueue.shift();
    const cardObj = subj.cards.find((c) => c.id === currentCardId);
    if (!cardObj) return;

    const isCorrect = Boolean(userAnswerBoolean) === Boolean(cardObj.answer);
    const liveStatus = document.getElementById('vf-live-status');

    if (isCorrect) {
      const prevBox = st.cardBoxes[currentCardId] || 0;
      const nextBox = prevBox + 1;
      st.cardBoxes[currentCardId] = nextBox;

      if (nextBox < 2) {
        // Still needs 1 more hit: place it in the second half of the queue so it doesn't repeat immediately
        const insertAt = Math.max(1, Math.floor(st.vfQueue.length * 0.6));
        st.vfQueue.splice(insertAt, 0, currentCardId);
      }

      const remaining = st.vfQueue.filter((id) => (st.cardBoxes[id] || 0) < 2);
      const queueEmpty = remaining.length === 0;
      if (queueEmpty) {
        st.vfCompletedToday = true;
      }

      if (liveStatus) {
        liveStatus.textContent = nextBox >= 2
          ? 'Acertou! Cartão dominado na Caixa 2.'
          : 'Acertou! Cartão subiu para a Caixa 1.';
      }

      saveState();
      updateLeitnerCounters();
      pulseLeitnerBox(Math.min(2, nextBox));
      showCardFeedback(cardObj, userAnswerBoolean, true, nextBox, queueEmpty);
    } else {
      // Wrong answer: resets to Box 0 and goes to middle/back of queue
      st.cardBoxes[currentCardId] = 0;
      st.cardErrorsToday[currentCardId] = (st.cardErrorsToday[currentCardId] || 0) + 1;
      st.cardErrorsTotal[currentCardId] = (st.cardErrorsTotal[currentCardId] || 0) + 1;

      const insertAt = Math.max(1, Math.min(4, st.vfQueue.length));
      st.vfQueue.splice(insertAt, 0, currentCardId);

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
    const swipeHint = document.getElementById('vf-swipe-hint');
    if (swipeHint) swipeHint.hidden = true;

    const feedbackBox = document.getElementById('vf-feedback-box');
    const titleEl = document.getElementById('vf-feedback-title');
    const badgeEl = document.getElementById('vf-feedback-badge');
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

    stmtEl.textContent = `"${cardObj.statement}"`;
    expText.textContent = cardObj.explanation;

    // Optional explanation button: hidden by default!
    expContent.hidden = true;
    btnToggleExp.textContent = '💡 Ver Explicação';
    btnNextCard.textContent = queueEmpty ? '🎉 Ver Conclusão →' : 'Próximo Card →';

    feedbackBox.hidden = false;
    btnNextCard.focus();
  }

  document.getElementById('btn-toggle-explanation').addEventListener('click', () => {
    const expContent = document.getElementById('vf-explanation-content');
    const btn = document.getElementById('btn-toggle-explanation');
    const willShow = expContent.hidden;
    expContent.hidden = !willShow;
    btn.textContent = willShow ? '🙈 Ocultar Explicação' : '💡 Ver Explicação';
  });

  document.getElementById('btn-next-card').addEventListener('click', () => {
    renderCurrentFlashcard();
  });

  document.getElementById('btn-back-from-vf').addEventListener('click', () => {
    renderDashboard();
    showView('view-dashboard');
  });

  // ==========================================================================
  // EXAM SIMULADO (10 Multiple-Choice Questions, No Immediate Spoiler)
  // ==========================================================================
  function openExam(subjKey) {
    activeSubjectKey = subjKey;
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
    activeExamObj = subj.exams[examIdx];

    document.getElementById('exam-subject-title').textContent = `${subj.title} — ${activeExamObj.title}`;
    document.getElementById('exam-attempt-label').textContent = `Tentativa ${st.examsTodayCount + 1} de 3 hoje • Meta: 8/10`;
    document.getElementById('exam-answered-badge').textContent = '0 / 10 respondidas';
    document.getElementById('exam-incomplete-msg').hidden = true;

    const qContainer = document.getElementById('exam-questions-container');
    qContainer.innerHTML = '';

    const letters = ['A', 'B', 'C', 'D'];

    activeExamObj.questions.forEach((q, idx) => {
      const article = document.createElement('article');
      article.className = 'question-card';

      const optionsHtml = q.options
        .map(
          (optText, optIdx) => `
          <label class="option-label">
            <input type="radio" name="q_${idx}" value="${optIdx}">
            <span><strong>${letters[optIdx]})</strong> ${optText}</span>
          </label>
        `
        )
        .join('');

      article.innerHTML = `
        <span class="question-num">Questão ${idx + 1} de 10</span>
        <p class="question-text">${q.text}</p>
        <div class="options-group">
          ${optionsHtml}
        </div>
      `;

      qContainer.appendChild(article);
    });

    showView('view-exam');
  }

  document.getElementById('exam-questions-container').addEventListener('change', () => {
    if (!activeExamObj) return;
    const form = document.getElementById('exam-form');
    let answered = 0;
    for (let i = 0; i < activeExamObj.questions.length; i++) {
      if (form.querySelector(`input[name="q_${i}"]:checked`)) {
        answered++;
      }
    }
    document.getElementById('exam-answered-badge').textContent = `${answered} / 10 respondidas`;
    if (answered === 10) {
      document.getElementById('exam-incomplete-msg').hidden = true;
    }
  });

  document.getElementById('exam-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!activeExamObj) return;

    const form = e.target;
    const userAnswers = [];

    for (let i = 0; i < activeExamObj.questions.length; i++) {
      const checked = form.querySelector(`input[name="q_${i}"]:checked`);
      if (!checked) {
        document.getElementById('exam-incomplete-msg').hidden = false;
        return;
      }
      userAnswers.push(Number(checked.value));
    }

    gradeAndShowExamResult(userAnswers);
  });

  function gradeAndShowExamResult(userAnswers) {
    const subj = getSubjectsMap()[activeSubjectKey];
    const st = appState.subjects[activeSubjectKey];
    const letters = ['A', 'B', 'C', 'D'];

    let score = 0;
    const wrongQuestions = [];

    activeExamObj.questions.forEach((q, idx) => {
      if (userAnswers[idx] === q.correct) {
        score++;
      } else {
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
      wrongQuestions,
    });

    saveState();

    // Render Result View
    document.getElementById('result-exam-title').textContent = `${subj.title} — ${activeExamObj.title}`;
    const heroCard = document.getElementById('result-summary-card');
    const scoreHeading = document.getElementById('result-score-heading');
    const statusMsg = document.getElementById('result-status-message');
    const ctaContainer = document.getElementById('result-cta-container');

    heroCard.className = `result-hero-card ${passed ? 'passed' : 'retry'}`;
    scoreHeading.textContent = `Nota: ${score} / 10 ${passed ? '🎉' : '💪'}`;

    ctaContainer.innerHTML = '';

    if (passed) {
      statusMsg.innerHTML = `<strong>Excelente, Pantoja!</strong> Você tirou <strong>${score}/10</strong> (meta era ≥ 8) e concluiu <strong>${subj.title}</strong> por hoje!`;
    } else if (st.examsTodayCount < 3) {
      const remaining = 3 - st.examsTodayCount;
      statusMsg.innerHTML = `Você tirou <strong>${score}/10</strong> (a meta é ≥ 8). Revise o gabarito abaixo com atenção e tente a próxima prova! Você ainda tem <strong>${remaining} tentativa(s)</strong> hoje em ${subj.title}.`;
      const btnRetry = document.createElement('button');
      btnRetry.type = 'button';
      btnRetry.className = 'primary';
      btnRetry.textContent = `📝 Fazer Próxima Prova de ${subj.title} (Tentativa ${st.examsTodayCount + 1}/3)`;
      btnRetry.addEventListener('click', () => openExam(activeSubjectKey));
      ctaContainer.appendChild(btnRetry);
    } else {
      statusMsg.innerHTML = `Você tirou <strong>${score}/10</strong> e completou o limite de <strong>3 provas de hoje</strong> em ${subj.title} (Melhor nota: ${st.bestScoreToday}/10). Revise o gabarito abaixo e mande o Relatório do Dia para o Peter ajustar a revisão de amanhã!`;
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

    // Render Question-by-Question Review
    const reviewContainer = document.getElementById('result-review-container');
    reviewContainer.innerHTML = '';

    activeExamObj.questions.forEach((q, idx) => {
      const userAns = userAnswers[idx];
      const isRight = userAns === q.correct;

      const card = document.createElement('article');
      card.className = `review-q-card ${isRight ? 'is-correct' : 'is-wrong'}`;

      card.innerHTML = `
        <span class="question-num">Questão ${idx + 1} • ${isRight ? '✅ Acertou' : '❌ Errou'}</span>
        <p class="question-text">${q.text}</p>
        <p class="review-ans-line">
          <strong>Sua resposta:</strong> ${letters[userAns]}) ${q.options[userAns]}
        </p>
        ${
          !isRight
            ? `<p class="review-ans-line" style="color: var(--vf-true-color);">
                <strong>Gabarito correto:</strong> ${letters[q.correct]}) ${q.options[q.correct]}
              </p>`
            : ''
        }
        <details ${!isRight ? 'open' : ''}>
          <summary><small><strong>💡 Comentário da questão</strong></small></summary>
          <p class="muted-text" style="margin-top:0.4rem;">${q.explanation}</p>
        </details>
      `;

      reviewContainer.appendChild(card);
    });

    showView('view-exam-result');
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
        lines.push(`• Cards V/F com erro hoje (${missedCards.length}): ${missedSummary}`);
      } else {
        lines.push(`• Cards V/F com erro hoje: Nenhum! 🎯`);
      }

      const todayExams = (st.examHistory || []).filter((h) => h.dayNumber === (appState.dayNumber || 1));
      if (todayExams.length > 0) {
        for (const ex of todayExams) {
          const wrongIds = (ex.wrongQuestions || []).map((w) => `Q${w.number}`).join(', ');
          lines.push(
            `• ${ex.examTitle}: Nota *${ex.score}/10* ${ex.passed ? '✅' : '⚠️'} ${
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

  function showToast(msg) {
    const toast = document.getElementById('report-feedback-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    setTimeout(() => {
      toast.hidden = true;
    }, 3500);
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
      applyTheme(appState.theme || 'light');
      renderDashboard();
      updateReportTextarea();
      showView('view-dashboard');
      showToast('✅ Save JSON carregado e aplicado com sucesso!');
    } catch (err) {
      showToast('❌ Erro ao ler o JSON. Verifique se copiou o texto completo.');
    }
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
  });

  document.getElementById('btn-dashboard-next-day')?.addEventListener('click', () => {
    advanceToNextDay();
  });

  document.getElementById('btn-advance-day').addEventListener('click', () => {
    advanceToNextDay();
    updateReportTextarea();
    showView('view-dashboard');
    showToast(`⏭️ Dia ${appState.dayNumber} iniciado! Os cartões com mais erros foram priorizados.`);
  });

  document.getElementById('btn-reset-all').addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    appState = loadState();
    renderDashboard();
    updateReportTextarea();
    showView('view-dashboard');
    showToast('🗑️ Progresso zerado.');
  });

  // Boot
  renderDashboard();
})();
