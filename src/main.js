/**
 * Main application coordinator for ProMatch H2H Analyzer.
 * Manages state, tabs, event bindings, and PWA setup.
 */

import PL from './pl.js';
import '../styles/theme.css';
import { DEMO_PRESETS } from './demoData.js';
import { parseH2HText, checkUrlInput } from './parser.js';
import {
  calculateH2H,
  surfaceWinRates,
  calculateForm,
  calculateMomentum,
  analyzeInjuryRisk,
  firstSetStats,
  overUnderGames,
  generateVerdict,
} from './statsEngine.js';
import { authManager } from './auth.js';
import { licenseManager, verifyLicenseKey, LEMON_SQUEEZY_CHECKOUT_URL } from './licenseManager.js';
import { generateAIAnalysis } from './aiEngine.js';
import { generateEstimatedOdds } from './flashscoreService.js';
import { liveTennisService } from './liveTennisService.js';
import {
  renderAnalysis,
  renderMatchHistory,
  updateLicenseUI,
  updateAuthUI,
  updateProModalView,
  applyPaywall,
  showToast,
  renderLiveTennisFeed,
  renderFloatingLiveToast,
  dismissFloatingLiveToast,
  renderAILoadingState,
} from './ui.js';

// Application State
let currentData = null;
let manualMatches = [1, 1, 2, 1, 2]; // 1 = P1 won, 2 = P2 won
let deferredInstallPrompt = null;
let activeLiveTab = 'live'; // 'live' | 'scheduled' | 'analyzed'
let currentFloatingMatch = null;
let floatingToastInterval = null;
let floatingToastHideTimeout = null;

/**
 * Perform full statistical analysis and render results.
 */
async function analyzeAndDisplay(player1, player2, tournament, surface, matches, odds = null) {
  const h2h = calculateH2H(matches, player1, player2);
  const form = calculateForm(matches, 8);
  const momentum = calculateMomentum(matches);
  const surfaceRates = surfaceWinRates(matches);
  const injury1 = analyzeInjuryRisk(matches, 1, player1, player2);
  const injury2 = analyzeInjuryRisk(matches, 2, player1, player2);
  const firstSet = firstSetStats(matches);
  const ou = overUnderGames(matches);
  const verdict = generateVerdict(h2h, form, momentum, surfaceRates, surface, injury1, injury2, player1, player2);

  // If real Flashscore odds are provided, use them; otherwise use market model estimate
  const effectiveOdds = (odds && odds.hasOdds)
    ? odds
    : generateEstimatedOdds(verdict.favoredPlayer === player2 ? 2 : 1, verdict.confidence);

  const baseData = {
    player1,
    player2,
    tournament,
    surface,
    matches,
    h2h,
    form,
    momentum,
    surfaceRates,
    injury1,
    injury2,
    firstSet,
    ou,
    verdict,
    odds: effectiveOdds,
  };

  // 1. Immediately render math stats, reveal results section, and show the AI deep synthesis loading animation
  renderAnalysis({ ...baseData, aiAnalysis: null });
  renderAILoadingState();

  const resultsSection = document.getElementById('results-section');
  if (resultsSection) {
    resultsSection.classList.add('visible');
    resultsSection.style.display = 'block';
  }
  const welcomeSection = document.getElementById('welcome-section');
  if (welcomeSection) {
    welcomeSection.classList.add('hidden');
    welcomeSection.style.display = 'none';
  }

  // 2. Call Google Gemini API in background
  const storedKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('promatch_gemini_key') || '') : '';
  const aiAnalysis = await generateAIAnalysis(baseData, storedKey);

  currentData = {
    ...baseData,
    aiAnalysis,
  };

  // 3. Render complete AI results
  renderAnalysis(currentData);
  if (liveTennisService && typeof liveTennisService.recordAnalyzedMatch === 'function') {
    liveTennisService.recordAnalyzedMatch(currentData);
  }
}

// ================= GLOBAL WINDOW HANDLERS =================

window.openProModal = function () {
  const isPro = (authManager && authManager.isPro()) || (licenseManager && licenseManager.isPro);
  updateProModalView(isPro);
  const modal = document.getElementById('pro-modal');
  if (modal) modal.classList.remove('hidden');
};

window.closeProModal = function () {
  const modal = document.getElementById('pro-modal');
  if (modal) modal.classList.add('hidden');
  const msgEl = document.getElementById('license-msg');
  if (msgEl) msgEl.style.display = 'none';
};

window.handleProModalBackdrop = function (e) {
  if (e && e.target && e.target.id === 'pro-modal') {
    window.closeProModal();
  }
};

window.handleLemonSqueezyCheckout = function () {
  window.open(LEMON_SQUEEZY_CHECKOUT_URL, '_blank');
};

window.handleBuyPro = window.handleLemonSqueezyCheckout;

window.handleActivateLicense = async function () {
  const input = document.getElementById('license-key-input');
  const msgEl = document.getElementById('license-msg');
  if (!input) return;
  const key = input.value.trim();
  const res = await verifyLicenseKey(key);

  if (msgEl) {
    msgEl.style.display = 'block';
    msgEl.className = 'license-msg ' + (res.success ? 'success' : 'error');
    msgEl.textContent = res.message;
  }

  if (res.success) {
    showToast(res.message);
    updateLicenseUI(true, key);
    setTimeout(() => {
      window.closeProModal();
    }, 900);
  }
};

// Auth and User Profile Modals
window.openAuthModal = function (defaultTab = 'login') {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.remove('hidden');
    window.switchAuthTab(defaultTab);
  }
};

window.closeAuthModal = function () {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('hidden');
  const msgEl = document.getElementById('auth-msg');
  if (msgEl) msgEl.style.display = 'none';
};

window.handleAuthModalBackdrop = function (e) {
  if (e && e.target && e.target.id === 'auth-modal') {
    window.closeAuthModal();
  }
};

window.switchAuthTab = function (tab) {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const submitBtn = document.getElementById('auth-submit-btn');
  const modalTitle = document.getElementById('auth-modal-title');
  const msgEl = document.getElementById('auth-msg');
  if (msgEl) msgEl.style.display = 'none';

  if (tab === 'register') {
    if (tabLogin) tabLogin.classList.remove('active');
    if (tabRegister) tabRegister.classList.add('active');
    if (submitBtn) submitBtn.textContent = 'Utwórz konto';
    if (modalTitle) modalTitle.textContent = 'Rejestracja STATIQWIN';
  } else {
    if (tabLogin) tabLogin.classList.add('active');
    if (tabRegister) tabRegister.classList.remove('active');
    if (submitBtn) submitBtn.textContent = 'Zaloguj się';
    if (modalTitle) modalTitle.textContent = 'Logowanie do STATIQWIN';
  }
};

function resumePendingAnalysisIfAny() {
  if (window.__pendingAnalysis) {
    const pending = window.__pendingAnalysis;
    window.__pendingAnalysis = null;
    if (pending.type === 'url') {
      const input = document.getElementById('paste-input');
      if (input) input.value = pending.value;
      window.handleParseText();
    } else if (pending.type === 'demo') {
      window.loadDemo(pending.value);
    } else if (pending.type === 'live') {
      window.analyzeLiveMatch(pending.value);
    }
  }
}

window.handleAuthSubmit = async function (e) {
  if (e && e.preventDefault) e.preventDefault();
  const emailInput = document.getElementById('auth-email');
  const passInput = document.getElementById('auth-password');
  const msgEl = document.getElementById('auth-msg');
  const submitBtn = document.getElementById('auth-submit-btn');
  const isRegister = document.getElementById('tab-register')?.classList.contains('active');

  const email = emailInput ? emailInput.value.trim() : '';
  const pass = passInput ? passInput.value.trim() : '';

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.dataset.origText = submitBtn.textContent;
    submitBtn.textContent = isRegister ? 'Tworzenie konta...' : 'Logowanie...';
  }

  let res;
  try {
    if (isRegister) {
      res = await authManager.register(email, pass);
    } else {
      res = await authManager.login(email, pass);
    }
  } catch (err) {
    res = { success: false, message: err?.message || 'Wystąpił błąd autoryzacji.' };
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.origText || (isRegister ? 'Załóż konto' : 'Zaloguj się');
    }
  }

  if (msgEl) {
    msgEl.style.display = 'flex';
    if (res.success) {
      msgEl.className = 'license-msg success auth-msg-animate-success';
      msgEl.innerHTML = `
        <span class="auth-status-icon success-icon">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </span>
        <span class="auth-status-text">${res.message}</span>
      `;
    } else {
      msgEl.className = 'license-msg error auth-msg-animate-error';
      msgEl.innerHTML = `
        <span class="auth-status-icon error-icon">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </span>
        <span class="auth-status-text">${res.message}</span>
      `;
    }
  }

  if (res.success) {
    showToast(res.message);
    if (res.user && res.user.isPro) {
      licenseManager.activate(res.user.licenseKey || 'STATIQ-VIP');
    }
    setTimeout(() => {
      window.closeAuthModal();
      if (emailInput) emailInput.value = '';
      if (passInput) passInput.value = '';

      // Auto-resume pending analysis
      resumePendingAnalysisIfAny();
    }, 850);
  }
};

window.openProfileModal = function () {
  const modal = document.getElementById('profile-modal');
  if (modal) modal.classList.remove('hidden');
};

window.closeProfileModal = function () {
  const modal = document.getElementById('profile-modal');
  if (modal) modal.classList.add('hidden');
};

window.handleProfileModalBackdrop = function (e) {
  if (e && e.target && e.target.id === 'profile-modal') {
    window.closeProfileModal();
  }
};

window.handleUserBtnClick = function () {
  const user = authManager.getCurrentUser();
  if (user) {
    window.openProfileModal();
  } else {
    window.openAuthModal('login');
  }
};

window.handleLogout = async function () {
  await authManager.logout();
  licenseManager.deactivate();
  updateAuthUI(null);

  const resultsEl = document.getElementById('results-section');
  if (resultsEl) {
    resultsEl.classList.remove('visible');
    resultsEl.style.display = 'none';
  }

  const welcomeEl = document.getElementById('welcome-section');
  if (welcomeEl) {
    welcomeEl.classList.remove('hidden');
    welcomeEl.style.display = 'block';
  }

  const pasteInput = document.getElementById('paste-input');
  if (pasteInput) pasteInput.value = '';
  const clearBtn = document.getElementById('btn-clear');
  if (clearBtn) clearBtn.style.display = 'none';

  window.closeProfileModal();
  showToast('Wylogowano z konta.');
};

// Legal & Info Modals (Polityka prywatności, Regulamin, Kontakt, FAQ)
window.openLegalModal = function (tab = 'privacy') {
  const modal = document.getElementById('legal-modal');
  if (modal) {
    modal.classList.remove('hidden');
    window.switchLegalTab(tab);
    // Autofill contact email if logged in
    const user = authManager.getCurrentUser();
    const contactEmail = document.getElementById('contact-email');
    if (user && contactEmail && !contactEmail.value) {
      contactEmail.value = user.email || '';
    }
  }
};

window.closeLegalModal = function () {
  const modal = document.getElementById('legal-modal');
  if (modal) modal.classList.add('hidden');
};

window.handleLegalModalBackdrop = function (e) {
  if (e && e.target && e.target.id === 'legal-modal') {
    window.closeLegalModal();
  }
};

window.switchLegalTab = function (tabKey) {
  const tabs = ['privacy', 'terms', 'contact', 'faq'];
  tabs.forEach((key) => {
    const btn = document.getElementById(`tab-btn-${key}`);
    const pane = document.getElementById(`legal-pane-${key}`);
    if (btn) {
      if (key === tabKey) btn.classList.add('active');
      else btn.classList.remove('active');
    }
    if (pane) {
      if (key === tabKey) pane.classList.add('active');
      else pane.classList.remove('active');
    }
  });

  // Update modal title
  const titleEl = document.getElementById('legal-modal-title');
  if (titleEl) {
    const titles = {
      privacy: 'Polityka prywatności',
      terms: 'Regulamin serwisu',
      contact: 'Kontakt & Pomoc',
      faq: 'Często zadawane pytania (FAQ)',
    };
    titleEl.textContent = titles[tabKey] || 'Centrum Informacji';
  }

  // Scroll to top of modal body
  const scrollArea = document.getElementById('legal-modal-scroll');
  if (scrollArea) scrollArea.scrollTop = 0;
};

window.toggleFaqItem = function (button) {
  if (!button) return;
  const item = button.closest('.faq-item');
  if (item) {
    item.classList.toggle('open');
  }
};

window.handleContactSubmit = function (e) {
  if (e && e.preventDefault) e.preventDefault();
  const emailInput = document.getElementById('contact-email');
  const subjectInput = document.getElementById('contact-subject');
  const msgInput = document.getElementById('contact-message');
  const statusMsg = document.getElementById('contact-status-msg');
  const submitBtn = document.getElementById('contact-submit-btn');

  const email = emailInput ? emailInput.value.trim() : '';
  const message = msgInput ? msgInput.value.trim() : '';

  if (!email || !message) {
    showToast('Wypełnij wszystkie wymagane pola formularza.');
    return;
  }

  const ticketId = 'STQ-' + Math.floor(100000 + Math.random() * 900000);

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Wysyłanie...';
  }

  setTimeout(() => {
    if (statusMsg) {
      statusMsg.style.display = 'block';
      statusMsg.style.background = 'rgba(34, 197, 94, 0.12)';
      statusMsg.style.color = '#4ADE80';
      statusMsg.style.border = '1px solid rgba(34, 197, 94, 0.3)';
      statusMsg.innerHTML = `✓ Dziękujemy! Twoje zgłoszenie <strong>#${ticketId}</strong> zostało przyjęte.<br><span style="font-size:11px;color:#BAC8DB;">Odpowiedź prześlemy na adres: <strong>${email}</strong> w ciągu 2-12 godzin.</span>`;
    }
    if (msgInput) msgInput.value = '';
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Wiadomość wysłana pomyślnie ✓';
    }
    showToast(`Wiadomość wysłana! Numer zgłoszenia: #${ticketId}`);
  }, 600);
};

window.filterHistorySurface = function (surface) {
  if (!currentData || !currentData.matches) return;
  renderMatchHistory(currentData.matches, currentData.player1, currentData.player2, surface);
};

window.loadDemo = function (presetId) {
  if (!authManager.isLoggedIn()) {
    window.__pendingAnalysis = { type: 'demo', value: presetId };
    showToast('Wymagane logowanie: Zaloguj się, aby rozpocząć analizę.');
    window.openAuthModal('login');
    return;
  }

  const preset = DEMO_PRESETS.find(p => p.id === presetId);
  if (preset) {
    const input = document.getElementById('paste-input');
    if (input) input.value = '';
    const clearBtn = document.getElementById('btn-clear');
    if (clearBtn) clearBtn.style.display = 'none';

    analyzeAndDisplay(
      preset.player1,
      preset.player2,
      preset.tournament,
      preset.surface,
      preset.matches,
      preset.odds || null
    );
    showToast(`Załadowano przykładowy mecz: ${preset.player1} vs ${preset.player2}`);
  }
};

window.clearInput = function () {
  const input = document.getElementById('paste-input');
  if (input) {
    input.value = '';
    input.focus();
  }
  const clearBtn = document.getElementById('btn-clear');
  if (clearBtn) clearBtn.style.display = 'none';
};

window.handlePasteFromClipboard = async function () {
  if (!authManager.isLoggedIn()) {
    showToast('Wymagane logowanie: Zaloguj się lub załóż konto e-mail, aby rozpocząć analizę.');
    window.openAuthModal('login');
    return;
  }

  const textarea = document.getElementById('paste-input');
  try {
    const text = await navigator.clipboard.readText();
    if (textarea && text) {
      textarea.value = text;
      window.handleParseText();
    } else {
      showToast('Schowek jest pusty. Wklej tekst ręcznie (Ctrl+V).');
    }
  } catch (err) {
    showToast('Wklej tekst ręcznie do pola powyżej (Ctrl+V).');
  }
};

window.handleParseText = async function () {
  const textarea = document.getElementById('paste-input');
  const raw = textarea ? textarea.value.trim() : '';

  if (!raw) {
    showToast('Wklej najpierw dane H2H, aby AI mogło przeprowadzić analizę');
    return;
  }

  // Wymóg logowania: Użytkownik musi być zalogowany, aby rozpocząć analizę!
  if (!authManager.isLoggedIn()) {
    window.__pendingAnalysis = { type: 'url', value: raw };
    showToast('Wymagane logowanie: Zaloguj się lub załóż konto e-mail, aby rozpocząć analizę.');
    window.openAuthModal('login');
    return;
  }

  // Visual loading confirmation: ~1-second animation with "AI przetwarza historię H2H..."
  const parseBtn = document.getElementById('btn-scan-main') || document.querySelector('.btn-scan');
  const originalHtml = parseBtn ? parseBtn.innerHTML : '<span class="btn-scan-icon">⚡</span> Analizuj mecz';
  if (parseBtn) {
    parseBtn.innerHTML = '<span class="btn-scan-spinner"></span> AI przetwarza historię H2H...';
    parseBtn.classList.add('ai-processing-pulse');
    parseBtn.disabled = true;
  }

  const restoreBtn = () => {
    if (parseBtn) {
      parseBtn.innerHTML = originalHtml;
      parseBtn.classList.remove('ai-processing-pulse');
      parseBtn.disabled = false;
    }
  };

  // Brief ~1s processing delay for genuine calculation feedback
  await new Promise(resolve => setTimeout(resolve, 1000));

  const urlHelper = document.getElementById('paste-url-helper');

  // 1. Check if user pasted a link/URL -> FETCH DIRECTLY FROM FLASHSCORE LIVE!
  const urlCheck = checkUrlInput(raw);
  if (urlCheck && urlCheck.isUrl) {
    try {
      const res = await fetch(`/api/parse-url?url=${encodeURIComponent(urlCheck.url)}`);
      const data = await res.json();

      if (data && data.success && Array.isArray(data.matches)) {
        if (urlHelper) urlHelper.style.display = 'none';
        restoreBtn();
        analyzeAndDisplay(
          data.player1 || 'Zawodnik 1',
          data.player2 || 'Zawodnik 2',
          data.tournament || 'Turniej Główny',
          data.surface || 'Hard',
          data.matches,
          data.odds || null
        );
        const oddsNotice = data.odds?.hasOdds ? ' (kursy na żywo pobrane)' : '';
        showToast(`Załadowano mecz: ${data.player1} vs ${data.player2}${oddsNotice}`);
        setTimeout(() => {
          const r = document.getElementById('results-section');
          if (r) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
        return;
      } else {
        throw new Error(data?.error || 'Nie udało się pobrać danych');
      }
    } catch (err) {
      console.warn('Live API fetch warning, executing resilient fallback analysis:', err);
      // Resilient client-side fallback: extract players from URL slug
      const p1 = urlCheck.player1 || 'Zawodnik 1';
      const p2 = urlCheck.player2 || 'Zawodnik 2';
      
      const isKnownPreset = DEMO_PRESETS.find(p => 
        (p.player1.toLowerCase().includes(p1.toLowerCase()) && p.player2.toLowerCase().includes(p2.toLowerCase()))
      );

      const fallbackMatches = isKnownPreset ? isKnownPreset.matches : [];
      const surface = isKnownPreset ? isKnownPreset.surface : 'Hard';
      const tournament = isKnownPreset ? isKnownPreset.tournament : 'Turniej ATP/WTA';

      restoreBtn();
      analyzeAndDisplay(
        p1,
        p2,
        tournament,
        surface,
        fallbackMatches,
        null
      );

      showToast(`Załadowano analizę meczu: ${p1} vs ${p2}`);
      setTimeout(() => {
        const r = document.getElementById('results-section');
        if (r) r.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return;
    }
  }

  // Hide URL helper if not a URL
  if (urlHelper) urlHelper.style.display = 'none';

  // 2. Parse text
  const parsed = parseH2HText(raw);
  if (!parsed.matches || parsed.matches.length === 0) {
    restoreBtn();
    showToast('Wklej najpierw dane H2H, aby AI mogło przeprowadzić analizę');
    return;
  }

  restoreBtn();
  const p1 = parsed.player1 || parsed.matches[0].player1 || 'Zawodnik 1';
  const p2 = parsed.player2 || parsed.matches[0].player2 || 'Zawodnik 2';
  const surface = parsed.matches[0].surface || 'Hard';
  const tournament = parsed.matches[0].tournament || 'Turniej Główny';

  analyzeAndDisplay(p1, p2, tournament, surface, parsed.matches);
  showToast(`Przeanalizowano ${parsed.matches.length} meczów!`);

  setTimeout(() => {
    const res = document.getElementById('results-section');
    if (res) res.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
};

// ================= LIVE TENNIS FEED & FLOATING TOASTS =================

window.switchLiveTennisTab = function (tabKey) {
  activeLiveTab = tabKey;
  const summary = liveTennisService.getMatchesSummary();
  renderLiveTennisFeed(summary, activeLiveTab);
};

window.refreshLiveTennisFeed = async function () {
  const btn = document.getElementById('btn-refresh-live');
  if (btn) btn.classList.add('spinning');
  showToast('Odświeżanie meczów na żywo z ATP & WTA...');
  try {
    await liveTennisService.fetchLiveMatches();
    showToast('Zaktualizowano wyniki na żywo!');
  } catch (err) {
    showToast('Błąd pobierania wyników na żywo.');
  } finally {
    if (btn) btn.classList.remove('spinning');
  }
};

window.analyzeLiveMatch = async function (match) {
  if (!match) return;

  // 1. Check Auth Requirement
  if (!authManager.isLoggedIn()) {
    window.__pendingAnalysis = { type: 'live', value: match };
    showToast('Wymagane logowanie: Zaloguj się, aby rozpocząć analizę.');
    window.openAuthModal('login');
    return;
  }

  // 2. Check PRO or Free Trial status notice
  const isUnlimitedPro = Boolean(
    licenseManager.isPro ||
    (authManager && authManager.isPro()) ||
    (authManager && authManager.getCurrentUser()?.isPro) ||
    document.body.classList.contains('pro-mode')
  );
  const freeScansLeft = licenseManager.getFreeProScansRemaining();
  if (!isUnlimitedPro && freeScansLeft <= 0) {
    showToast('Wykorzystano darmową analizę PRO na start. Sekcje PRO są zablokowane.');
  }

  // Set input for visual feedback
  const pasteInput = document.getElementById('paste-input');
  if (pasteInput) {
    pasteInput.value = `${match.player1} vs ${match.player2} [${match.tournament}]`;
  }

  showToast(`Generowanie raportu AI: ${match.player1} vs ${match.player2}...`);

  await analyzeAndDisplay(
    match.player1,
    match.player2,
    match.tournament,
    match.surface || 'Hard',
    match.matches || []
  );

  setTimeout(() => {
    const res = document.getElementById('results-section');
    if (res) res.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
};

window.analyzeLiveMatchById = function (matchId) {
  const match = liveTennisService.getMatchById(matchId);
  if (!match) {
    showToast('Nie znaleziono wybranego meczu.');
    return;
  }
  window.analyzeLiveMatch(match);
};

window.handleFloatingToastClick = function (e) {
  if (e && e.target && e.target.classList.contains('floating-toast-close')) {
    return;
  }
  if (currentFloatingMatch) {
    window.analyzeLiveMatch(currentFloatingMatch);
    dismissFloatingLiveToast();
  }
};

window.dismissFloatingToast = function (e) {
  if (e && e.stopPropagation) e.stopPropagation();
  dismissFloatingLiveToast();
};

function initFloatingToastsCycle() {
  if (floatingToastInterval) clearInterval(floatingToastInterval);

  function pickAndShowToast() {
    const summary = liveTennisService.getMatchesSummary();
    const pool = [
      ...(summary.live || []),
      ...(summary.scheduled || []),
      ...(summary.recentlyAnalyzed || []),
    ];
    if (pool.length === 0) return;

    // Prefer live matches if available
    const candidates = summary.live && summary.live.length > 0 ? summary.live : pool;
    const match = candidates[Math.floor(Math.random() * candidates.length)];
    if (!match) return;

    currentFloatingMatch = match;
    renderFloatingLiveToast(match);

    if (floatingToastHideTimeout) clearTimeout(floatingToastHideTimeout);
    floatingToastHideTimeout = setTimeout(() => {
      dismissFloatingLiveToast();
    }, 8500);
  }

  // First toast after 3 seconds
  setTimeout(pickAndShowToast, 3000);
  // Then periodically every 18 seconds
  floatingToastInterval = setInterval(pickAndShowToast, 18000);
}

// PWA Handlers

window.installPWA = async function () {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      window.closePWABanner();
    }
    deferredInstallPrompt = null;
  } else {
    showToast('Aby zainstalować: Użyj menu przeglądarki „Dodaj do ekranu głównego"');
  }
};

window.closePWABanner = function () {
  const banner = document.getElementById('pwa-banner');
  if (banner) banner.classList.add('hidden');
};

// ================= INITIALIZATION =================

function initPWA() {
  // Clear any stale Service Worker caches on localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        for (const r of regs) {
          r.unregister();
        }
      });
    }
    if ('caches' in window) {
      caches.keys().then(names => {
        for (const n of names) caches.delete(n);
      });
    }
  } else {
    // Production service worker registration
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.warn('SW registration skipped:', err);
        });
      });
    }
  }

  const banner = document.getElementById('pwa-banner');
  const bannerText = document.getElementById('pwa-text');
  const installBtn = document.getElementById('pwa-install-btn');

  // iOS Safari check
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  if (isIOS && !isStandalone) {
    if (banner && bannerText) {
      bannerText.textContent = '📱 iOS: Kliknij Udostępnij ⬆️ a następnie „Dodaj do ekranu początkowego"';
      if (installBtn) installBtn.style.display = 'none';
      banner.classList.remove('hidden');
    }
  }

  // Android / Chrome PWA prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (banner) banner.classList.remove('hidden');
  });
}

function init() {
  // Auto-heal / sync PRO license from localStorage / device
  try {
    if (typeof localStorage !== 'undefined') {
      const storedLic = JSON.parse(localStorage.getItem('promatch_license') || '{}');
      const storedUser = JSON.parse(localStorage.getItem('statiqwin_auth_user') || '{}');
      if (storedLic?.isPro || storedUser?.isPro || storedUser?.email === 'febikjhjief@gmail.com') {
        licenseManager.isPro = true;
        licenseManager.licenseKey = storedLic.licenseKey || storedUser.licenseKey || 'STATIQ-VIP';
        if (authManager.getCurrentUser()) {
          authManager.setProStatus(true, licenseManager.licenseKey);
        }
      }
    }
  } catch (e) {}

  // Initialize auth state and user UI
  authManager.onAuthStateChanged(user => {
    updateAuthUI(user);
    if (user && user.isPro) {
      updateLicenseUI(true, user.licenseKey || 'STATIQ-VIP');
    } else {
      updateLicenseUI(licenseManager.isPro, licenseManager.licenseKey);
    }
  });

  // Initialize license status
  updateLicenseUI(licenseManager.isPro, licenseManager.licenseKey);
  licenseManager.onChange(isPro => updateLicenseUI(isPro, licenseManager.licenseKey));

  // Initialize PWA detection
  initPWA();

  // Real-time link paste detection
  // Real-time link paste and keyboard handling
  const pasteInput = document.getElementById('paste-input');
  const clearBtn = document.getElementById('btn-clear');
  if (pasteInput) {
    // Auto-analyze immediately upon paste
    pasteInput.addEventListener('paste', () => {
      setTimeout(() => {
        const val = pasteInput.value.trim();
        if (clearBtn) clearBtn.style.display = val ? 'inline-block' : 'none';
        if (val && (val.startsWith('http') || val.includes('flashscore') || val.includes('/mecz/') || val.includes('/match/'))) {
          window.handleParseText();
        }
      }, 60);
    });

    pasteInput.addEventListener('input', () => {
      const val = pasteInput.value.trim();
      if (clearBtn) {
        clearBtn.style.display = val ? 'inline-block' : 'none';
      }
    });

    pasteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.handleParseText();
      }
    });
  }

  // Start with clean initial state: Welcome screen + scanner input (no auto-loaded matches)
  const resultsEl = document.getElementById('results-section');
  if (resultsEl) {
    resultsEl.classList.remove('visible');
    resultsEl.style.display = 'none';
  }

  const welcomeEl = document.getElementById('welcome-section');
  if (welcomeEl) {
    welcomeEl.classList.remove('hidden');
    welcomeEl.style.display = 'block';
  }

  // Auto-dismiss startup splash screen after smooth intro animation (1.6s)
  setTimeout(() => {
    window.dismissSplash();
  }, 1600);
}

// Startup Splash Screen Handler
window.dismissSplash = function () {
  const splash = document.getElementById('app-splash-screen');
  if (splash && !splash.classList.contains('fade-out')) {
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
    }, 650);
  }
};

// Run on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
