/**
 * UI Rendering functions for ProMatch Tennis AI.
 * Clean, restrained, professional sports analytics interface.
 * 100% Polish user-facing text without AI clichés or emoji clutter.
 */

import { SURFACE_PL } from './parser.js';
import { licenseManager, getFreeScansRemaining, useFreeScan } from './licenseManager.js';
import { authManager } from './auth.js';

/**
 * Show a quick, clean toast notification.
 */
export function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

/**
 * Render full analysis results across all sections.
 */
export function renderAnalysis(data) {
  const {
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
  } = data;

  const surfacePL = SURFACE_PL[surface] || surface;

  // Show results container and hide welcome section
  const resultsEl = document.getElementById('results-section');
  if (resultsEl) {
    resultsEl.classList.add('visible');
    resultsEl.style.display = 'block';
  }
  const welcomeEl = document.getElementById('welcome-section');
  if (welcomeEl) {
    welcomeEl.classList.add('hidden');
    welcomeEl.style.display = 'none';
  }

  // 1. Scoreboard / Matchup Header
  const headerEl = document.getElementById('h2h-header');
  const hasH2H = h2h && h2h.total > 0;
  const p1H2HPct = hasH2H ? Math.round((h2h.p1Wins / h2h.total) * 100) : null;
  const p2H2HPct = hasH2H ? 100 - p1H2HPct : null;

  const bestP1 = data.odds?.bestP1;
  const bestP2 = data.odds?.bestP2;

  if (headerEl) {
    const meetingCountText = h2h.total === 0
      ? 'Brak wcześniejszych spotkań'
      : h2h.total === 1
        ? '1 bezpośrednie spotkanie'
        : `${h2h.total} bezpośrednich spotkań`;

    headerEl.innerHTML = `
      <div class="scoreboard-meta">
        <span class="tournament-name">${tournament}</span>
        <span class="surface-badge-header">${surfacePL}</span>
      </div>
      <div class="scoreboard-matchup">
        <div class="player-box p1">
          <span class="player-name">${player1}</span>
          <span class="player-winrate">${hasH2H ? `${p1H2HPct}% H2H (${h2h.p1Wins}W)` : 'Brak wcześniejszych spotkań'}</span>
          ${bestP1 ? `
            <div class="header-odds-pill" title="Najwyższy kurs: ${bestP1.bookmaker}">
              <span class="odds-pill-bookie">${bestP1.bookmaker}</span>
              <span class="odds-pill-val">${bestP1.odds.toFixed(2)}</span>
            </div>
          ` : ''}
        </div>
        <div class="h2h-center-score">
          <div class="h2h-score-label">Bilans H2H</div>
          <div class="h2h-score-val">${h2h.p1Wins} : ${h2h.p2Wins}</div>
          <div class="h2h-score-sub">${meetingCountText}</div>
          ${data.odds?.hasOdds ? `<div class="odds-live-status-badge">Kursy live: Flashscore</div>` : ''}
        </div>
        <div class="player-box p2">
          <span class="player-name">${player2}</span>
          <span class="player-winrate">${hasH2H ? `${p2H2HPct}% H2H (${h2h.p2Wins}W)` : 'Brak wcześniejszych spotkań'}</span>
          ${bestP2 ? `
            <div class="header-odds-pill" title="Najwyższy kurs: ${bestP2.bookmaker}">
              <span class="odds-pill-bookie">${bestP2.bookmaker}</span>
              <span class="odds-pill-val">${bestP2.odds.toFixed(2)}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // 1.5. Live Market Odds Card
  const oddsContentEl = document.getElementById('odds-content');
  const oddsCardEl = document.getElementById('odds-card');
  if (oddsContentEl && data.odds && data.odds.matchWinner && data.odds.matchWinner.length > 0) {
    if (oddsCardEl) oddsCardEl.style.display = 'block';
    const { odds } = data;
    const bestP1Val = odds.bestP1 ? odds.bestP1.odds : 0;
    const bestP2Val = odds.bestP2 ? odds.bestP2.odds : 0;

    oddsContentEl.innerHTML = `
      <div class="card-title">
        <span>Kursy bukmacherskie na żywo</span>
        <span class="odds-source-badge">${odds.source || 'Live Flashscore'}</span>
      </div>

      <div class="odds-summary-strip">
        <div class="odds-summary-col">
          <span class="odds-summary-lbl">Najwyższy kurs na ${player1}:</span>
          <span class="odds-summary-val p1">${odds.bestP1 ? `${odds.bestP1.odds.toFixed(2)} (${odds.bestP1.bookmaker})` : '—'}</span>
        </div>
        <div class="odds-summary-col" style="text-align:right;">
          <span class="odds-summary-lbl">Najwyższy kurs na ${player2}:</span>
          <span class="odds-summary-val p2">${odds.bestP2 ? `${odds.bestP2.odds.toFixed(2)} (${odds.bestP2.bookmaker})` : '—'}</span>
        </div>
      </div>

      <div class="table-container">
        <table class="odds-table">
          <thead>
            <tr>
              <th>Bukmacher</th>
              <th style="text-align:right;">1 (${player1.split(' ').pop()})</th>
              <th style="text-align:right;">2 (${player2.split(' ').pop()})</th>
              <th style="text-align:right;">1. Set</th>
              <th style="text-align:right;">Gemy (${odds.primaryOU ? odds.primaryOU.line : '22.5'})</th>
            </tr>
          </thead>
          <tbody>
            ${(odds.matchWinner || []).map(b => {
              const isBest1 = b.p1 === bestP1Val;
              const isBest2 = b.p2 === bestP2Val;
              const fs = (odds.firstSetWinner || []).find(f => f.bookmaker === b.bookmaker);
              const ou = (odds.overUnderGames || []).find(o => o.bookmaker === b.bookmaker && o.line === (odds.primaryOU ? odds.primaryOU.line : '22.5'));

              return `
                <tr>
                  <td class="bm-name-cell">
                    <strong>${b.bookmaker}</strong>
                  </td>
                  <td style="text-align:right;">
                    <span class="odds-cell-val ${isBest1 ? 'best-odds' : ''}">${b.p1.toFixed(2)}</span>
                    ${isBest1 ? '<span class="best-badge">MAX</span>' : ''}
                  </td>
                  <td style="text-align:right;">
                    <span class="odds-cell-val ${isBest2 ? 'best-odds' : ''}">${b.p2.toFixed(2)}</span>
                    ${isBest2 ? '<span class="best-badge">MAX</span>' : ''}
                  </td>
                  <td style="text-align:right;color:#8E9BAE;font-size:11px;">
                    ${fs ? `${fs.p1.toFixed(2)} / ${fs.p2.toFixed(2)}` : '—'}
                  </td>
                  <td style="text-align:right;color:#8E9BAE;font-size:11px;">
                    ${ou ? `O ${ou.over.toFixed(2)} / U ${ou.under.toFixed(2)}` : '—'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div class="odds-footer-meta">
        <span>Średni kurs: <strong>${odds.avgP1 || '—'}</strong> vs <strong>${odds.avgP2 || '—'}</strong></span>
        <span>${odds.source === 'Flashscore Live' ? 'Pobrano bezpośrednio z Flashscore' : 'Szacunkowe kursy rynkowe'}</span>
      </div>
    `;
  } else if (oddsCardEl) {
    oddsCardEl.style.display = 'none';
  }

  // 2. Autorski System AI (Predykcje & Analiza Taktyczna)
  const aiContentEl = document.getElementById('ai-advisor-content');
  if (aiContentEl) {
    if (data.aiAnalysis) {
      const ai = data.aiAnalysis;
      aiContentEl.innerHTML = `
        <div class="card-title">
          <span>Prognoza & Analiza Taktyczna AI</span>
          <span class="odds-source-badge" style="background:rgba(34,197,94,0.15);color:#22C55E;border-color:rgba(34,197,94,0.35);font-weight:800;">
            Pewność: ${ai.confidence}%
          </span>
        </div>
        <div style="font-size:11px;color:#22C55E;font-weight:700;display:flex;align-items:center;gap:6px;margin:-4px 0 14px 0;">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#22C55E;box-shadow:0 0 10px rgba(34,197,94,0.8);"></span>
          <span>${ai.modelName || 'Autorski model analityczny STATIQWIN AI (Google Gemini Live API)'}</span>
        </div>

        <div class="ai-pred-grid">
          <div class="ai-pred-box">
            <div class="ai-pred-label">Faworyt i wynik setowy</div>
            <div class="ai-pred-val">${ai.predictedScore}</div>
            <div class="ai-pred-sub">Wskazanie: <strong>${ai.predictedWinner}</strong> (${ai.confidence}%)</div>
          </div>
          <div class="ai-pred-box">
            <div class="ai-pred-label">Szacowana suma gemów</div>
            <div class="ai-pred-val">~${ai.estimatedGames} gemów</div>
            <div class="ai-pred-sub" style="color:#38BDF8;">Rekomendacja: <strong>${ai.estimatedGames > 22.5 ? 'OVER 21.5 / 22.5' : 'UNDER 22.5 / 23.5'}</strong></div>
          </div>
        </div>

        ${ai.styleMatchup ? `
          <div class="ai-analysis-block">
            <div class="ai-block-header">
              <span class="ai-block-icon">🎾</span>
              <span class="ai-block-title">Matchup stylów i przystosowanie do nawierzchni (${surfacePL})</span>
            </div>
            <div class="ai-block-body">${ai.styleMatchup}</div>
          </div>
        ` : ''}

        ${ai.physicalAssessment ? `
          <div class="ai-analysis-block">
            <div class="ai-block-header">
              <span class="ai-block-icon">🩺</span>
              <span class="ai-block-title">Ocena ryzyka zdrowotnego, kondycji i obciążenia turniejowego</span>
            </div>
            <div class="ai-block-body">${ai.physicalAssessment}</div>
          </div>
        ` : ''}

        ${ai.tacticalAnalysis && ai.tacticalAnalysis.length > 0 ? `
          <div class="ai-tactical-box">
            <div class="ai-section-title">Kluczowe wnioski taktyczne</div>
            ${ai.tacticalAnalysis.map(t => `<div class="ai-bullet">${t}</div>`).join('')}
          </div>
        ` : ''}

        <div class="ai-tactical-box">
          <div class="ai-section-title">Rekomendowane zakłady i selekcje (+EV)</div>
          ${ai.bets.map(b => `
            <div class="bet-item ${b.isValueBet ? 'bet-item-value' : ''}">
              <div style="flex:1;padding-right:10px;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
                  <span class="bet-type-badge">${b.type}</span>
                  ${b.isValueBet ? '<span class="bet-value-tag">⚡ VALUE BET</span>' : ''}
                  <div class="bet-title">${b.title}</div>
                </div>
                <div class="bet-reason">${b.reason}</div>
              </div>
              <div style="text-align:right;flex-shrink:0;">
                ${b.odds ? `<span class="bet-odds-badge ${b.isValueBet ? 'odds-value-glow' : ''}">Kurs ${b.odds}</span>` : ''}
                <div style="font-size:11px;color:#8E9BAE;margin-top:4px;font-weight:700;">${b.confidence}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      renderAILoadingState();
    }
  }

  // 3. Surface Breakdown Card
  const currentSr = surfaceRates[surface] || { p1: 0, p2: 0, total: 0, p1Pct: 0, p2Pct: 0 };
  const surfaceContentEl = document.getElementById('surface-content');
  if (surfaceContentEl) {
    const sTag = (surface || 'Hard').toLowerCase();
    surfaceContentEl.innerHTML = `
      <div class="card-title">
        <span>Bilans na nawierzchniach</span>
        <span class="surface-tag ${sTag}">${surfacePL}</span>
      </div>
      
      <div style="background-color:#080B11;border:1px solid #161D2B;border-radius:6px;padding:8px 10px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;">
          <span style="color:#8E9BAE;">Skuteczność na tej nawierzchni:</span>
          <span style="font-weight:700;"><span style="color:#22C55E;">${player1} (${currentSr.p1Pct}%)</span> vs <span style="color:#EF4444;">${player2} (${currentSr.p2Pct}%)</span></span>
        </div>
        <div style="font-size:11px;color:#64748B;margin-top:2px;">
          Mecze bezpośrednie: <strong>${currentSr.p1}W - ${currentSr.p2}L</strong> (${currentSr.total} spotkań)
        </div>
      </div>

      <table class="surface-table">
        <thead>
          <tr>
            <th>Nawierzchnia</th>
            <th style="text-align:right;">${player1}</th>
            <th style="text-align:right;">${player2}</th>
          </tr>
        </thead>
        <tbody>
          ${['Hard', 'Clay', 'Grass', 'Indoor'].map(s => {
            const rate = surfaceRates[s] || { p1Pct: 0, p2Pct: 0, p1: 0, p2: 0, total: 0 };
            const isCurrent = s.toLowerCase() === surface.toLowerCase();
            const tagClass = s.toLowerCase();
            return `
              <tr>
                <td>
                  <span class="surface-tag ${tagClass}">${SURFACE_PL[s] || s}</span>
                  ${isCurrent ? '<span style="font-size:10px;color:#38BDF8;margin-left:4px;">(obecna)</span>' : ''}
                </td>
                <td style="text-align:right;color:#22C55E;font-weight:700;">
                  ${rate.total > 0 ? `${rate.p1Pct}% (${rate.p1}W)` : '<span style="color:#475569;font-weight:400;">—</span>'}
                </td>
                <td style="text-align:right;color:#EF4444;font-weight:700;">
                  ${rate.total > 0 ? `${rate.p2Pct}% (${rate.p2}W)` : '<span style="color:#475569;font-weight:400;">—</span>'}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // 4. Basic Stats Card
  const basicStatsEl = document.getElementById('basic-stats-card');
  if (basicStatsEl) {
    if (!hasH2H) {
      basicStatsEl.innerHTML = `
        <div class="card-title">Bilans bezpośredni (H2H)</div>
        <div class="stat-row">
          <span class="stat-label">Bilans bezpośredni</span>
          <span class="stat-val"><strong>0 : 0</strong> (Brak wcześniejszych spotkań)</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Liczba spotkań ogółem</span>
          <span class="stat-val">0</span>
        </div>
        <div style="background-color:rgba(15,23,42,0.6);border:1px dashed #243049;border-radius:6px;padding:10px;margin-top:10px;font-size:12px;color:#94A3B8;text-align:center;">
          Zawodnicy spotykają się po raz pierwszy. Brak wcześniejszych bezpośrednich pojedynków.
        </div>
      `;
    } else {
      basicStatsEl.innerHTML = `
        <div class="card-title">Bilans bezpośredni (H2H)</div>
        <div class="stat-row">
          <span class="stat-label">Zwycięstwa zawodników</span>
          <span class="stat-val">${player1} <strong>${h2h.p1Wins} : ${h2h.p2Wins}</strong> ${player2}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Liczba spotkań ogółem</span>
          <span class="stat-val">${h2h.total === 1 ? '1 bezpośrednie spotkanie' : `${h2h.total} bezpośrednich spotkań`}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Rozkład procentowy</span>
          <span class="stat-val"><span style="color:#22C55E;">${p1H2HPct}%</span> vs <span style="color:#EF4444;">${p2H2HPct}%</span></span>
        </div>
        <div class="stat-bar">
          <div class="p1" style="width: ${p1H2HPct}%;"></div>
          <div class="p2" style="width: ${p2H2HPct}%;"></div>
        </div>
      `;
    }
  }

  // 5. Form & Momentum Card
  const momentumText = momentum.streakCount >= 2
    ? `${momentum.streakPlayer === 1 ? player1 : player2} ma serię ${momentum.streakCount} zwycięstw z rzędu w bezpośrednich starciach.`
    : 'Brak jednostronnej dominacji w ostatnich spotkaniach.';

  const formEl = document.getElementById('form-card');
  if (formEl) {
    formEl.innerHTML = `
      <div class="card-title">Forma ostatnich meczów</div>
      <div class="stat-row">
        <span class="stat-label">Ważona forma zawodników</span>
        <span class="stat-val"><span style="color:#22C55E;">${player1}: ${form.p1}%</span> | <span style="color:#EF4444;">${player2}: ${form.p2}%</span></span>
      </div>
      <div class="stat-bar">
        <div class="p1" style="width: ${form.p1}%;"></div>
        <div class="p2" style="width: ${100 - form.p1}%;"></div>
      </div>
      <div style="background-color:#080B11;border:1px solid #161D2B;border-radius:6px;padding:8px 10px;margin-top:8px;font-size:12px;color:#CBD5E1;">
        ${momentumText}
      </div>
    `;
  }

  // 6. Match History
  renderMatchHistory(matches, player1, player2, 'All');

  // 7. Over/Under Calculator
  const ouContentEl = document.getElementById('ou-content');
  if (ouContentEl) {
    const lines = ou.lines || {};
    ouContentEl.innerHTML = `
      <div class="card-title">Kalkulator gemów (Over / Under)</div>
      <div class="stat-row">
        <span class="stat-label">Średnia liczba gemów na mecz</span>
        <span class="stat-val" style="font-family:var(--font-display);color:#F59E0B;font-size:15px;font-weight:900;">${ou.avg} gemów</span>
      </div>
      <table class="surface-table" style="margin-top:8px;">
        <thead>
          <tr>
            <th>Linia bukmacherska</th>
            <th style="text-align:right;">Szansa OVER</th>
            <th style="text-align:right;">Szansa UNDER</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(lines).map(([line, val]) => `
            <tr>
              <td style="font-weight:700;color:#F1F5F9;">${line} gemów</td>
              <td style="text-align:right;font-family:var(--font-display);color:#22C55E;font-weight:900;font-size:14px;">${val.over}%</td>
              <td style="text-align:right;font-family:var(--font-display);color:#EF4444;font-weight:900;font-size:14px;">${val.under}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // 8. 1st Set Stats
  const firstSetContentEl = document.getElementById('first-set-content');
  if (firstSetContentEl) {
    firstSetContentEl.innerHTML = `
      <div class="card-title">Skuteczność 1. seta</div>
      <div class="stat-row">
        <span class="stat-label">Wygrane pierwsze sety</span>
        <span class="stat-val" style="font-family:var(--font-display);font-size:14px;font-weight:900;"><span style="color:#22C55E;">${player1}: ${firstSet.p1Pct}%</span> vs <span style="color:#38BDF8;">${player2}: ${firstSet.p2Pct}%</span></span>
      </div>
      <div class="stat-bar">
        <div class="p1" style="width: ${firstSet.p1Pct}%;"></div>
        <div class="p2" style="width: ${firstSet.p2Pct}%;"></div>
      </div>
    `;
  }

  // 9. Injury & Health Analysis
  const injuryContentEl = document.getElementById('injury-content');
  if (injuryContentEl) {
    let warningBanner = '';
    if (injury1.level === 'high') {
      warningBanner = `<div style="background-color:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);border-radius:8px;padding:9px 12px;font-size:12px;color:#FCA5A5;margin-bottom:10px;font-weight:700;">
        ⚠️ Uwaga: ${player1} zgłosił problem fizyczny lub krecz w ostatnim meczu (${injury1.keyword || 'MTO'}).
      </div>`;
    } else if (injury2.level === 'high') {
      warningBanner = `<div style="background-color:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);border-radius:8px;padding:9px 12px;font-size:12px;color:#FCA5A5;margin-bottom:10px;font-weight:700;">
        ⚠️ Uwaga: ${player2} zgłosił problem fizyczny lub krecz w ostatnim meczu (${injury2.keyword || 'MTO'}).
      </div>`;
    }

    const levelColor = (lvl) => {
      if (lvl === 'high') return '#EF4444';
      if (lvl === 'medium') return '#F59E0B';
      return '#22C55E';
    };

    const levelText = (lvl) => {
      if (lvl === 'high') return 'Wysokie ryzyko';
      if (lvl === 'medium') return 'Średnie ryzyko';
      return 'Niskie ryzyko';
    };

    injuryContentEl.innerHTML = `
      <div class="card-title">Raport obciążenia i kontuzji</div>
      ${warningBanner}
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px;">
        <div style="background:linear-gradient(180deg,#090D17 0%,#060910 100%);border:1px solid #1C273C;border-radius:8px;padding:12px 14px;">
          <div style="font-size:12px;font-weight:800;color:#CBD5E1;">${player1}</div>
          <div style="font-family:var(--font-display);font-size:24px;font-weight:900;color:${levelColor(injury1.level)};margin-top:3px;letter-spacing:-0.02em;">${injury1.score}%</div>
          <div style="font-size:11px;font-weight:800;color:${levelColor(injury1.level)};">${levelText(injury1.level)}</div>
          <div style="font-size:11px;color:#73849C;margin-top:6px;line-height:1.4;">
            ${injury1.factors.length > 0 ? injury1.factors.join(', ') : 'Brak odnotowanych urazów'}
          </div>
        </div>

        <div style="background:linear-gradient(180deg,#090D17 0%,#060910 100%);border:1px solid #1C273C;border-radius:8px;padding:12px 14px;">
          <div style="font-size:12px;font-weight:800;color:#CBD5E1;">${player2}</div>
          <div style="font-family:var(--font-display);font-size:24px;font-weight:900;color:${levelColor(injury2.level)};margin-top:3px;letter-spacing:-0.02em;">${injury2.score}%</div>
          <div style="font-size:11px;font-weight:800;color:${levelColor(injury2.level)};">${levelText(injury2.level)}</div>
          <div style="font-size:11px;color:#73849C;margin-top:6px;line-height:1.4;">
            ${injury2.factors.length > 0 ? injury2.factors.join(', ') : 'Brak odnotowanych urazów'}
          </div>
        </div>
      </div>
    `;
  }

  // 10. AI Verdict
  const verdictContentEl = document.getElementById('verdict-content');
  if (verdictContentEl) {
    const verdictTitle = verdict.favoredPlayer
      ? `Faworyt: ${verdict.favoredPlayer}`
      : 'Mecz zrównoważony (50/50)';

    verdictContentEl.innerHTML = `
      <div class="card-title">Werdykt statystyczny modelu</div>
      <div style="font-family:var(--font-display);font-size:17px;font-weight:900;color:#22C55E;letter-spacing:-0.01em;">${verdictTitle}</div>
      <div style="font-size:12px;color:var(--text-secondary);margin-top:3px;">Pewność wyliczenia: <strong style="font-family:var(--font-display);color:#FFF;font-size:14px;font-weight:900;">${verdict.confidence}%</strong></div>
      
      ${verdict.isValueBet ? `
        <div style="margin-top:8px;font-size:12px;background:rgba(245,158,11,0.14);color:#F59E0B;border:1px solid rgba(245,158,11,0.35);padding:4px 10px;border-radius:6px;display:inline-block;font-weight:800;">
          ⚡ VALUE BET: Wykryto asymetrię ryzyka zdrowotnego rywala
        </div>
      ` : ''}

      <div style="margin-top:10px;font-size:11px;font-weight:800;color:#CBD5E1;text-transform:uppercase;letter-spacing:0.04em;">Kluczowe czynniki:</div>
      <ul style="list-style:none;margin-top:6px;">
        ${verdict.reasons.map(r => `<li style="font-size:13px;color:#BAC8DB;padding:3px 0;line-height:1.5;">• <strong style="color:#FFF;">${r}</strong></li>`).join('')}
      </ul>
    `;
  }

  // Robust check for PRO status across licenseManager, authManager, DOM, and localStorage
  const isUnlimitedPro = Boolean(
    licenseManager.isPro ||
    (authManager && authManager.isPro()) ||
    (authManager && authManager.getCurrentUser()?.isPro) ||
    document.body.classList.contains('pro-mode') ||
    document.getElementById('header-pro-btn')?.classList.contains('pro-active') ||
    document.getElementById('header-user-plan')?.textContent?.trim() === 'PRO' ||
    (typeof localStorage !== 'undefined' && (
      (JSON.parse(localStorage.getItem('promatch_license') || '{}')).isPro ||
      (JSON.parse(localStorage.getItem('statiqwin_auth_user') || '{}')).isPro
    ))
  );

  let isProScan = false;
  let usedFreeTrialThisScan = false;

  if (isUnlimitedPro) {
    isProScan = true;
    usedFreeTrialThisScan = false;
    // Guarantee state synchronization
    if (!licenseManager.isPro) licenseManager.isPro = true;
    if (authManager && authManager.getCurrentUser() && !authManager.getCurrentUser().isPro) {
      authManager.setProStatus(true, 'STATIQ-VIP');
    }
  } else {
    // Only evaluate trial for non-PRO users
    const freeScansLeft = getFreeScansRemaining();
    if (freeScansLeft > 0) {
      isProScan = true;
      usedFreeTrialThisScan = true;
      if (!data._trialConsumed) {
        useFreeScan();
        data._trialConsumed = true;
      }
    } else {
      isProScan = false;
    }
  }

  // Trial / PRO status banner above scoreboard
  const trialBannerContainer = document.getElementById('trial-banner-container');
  if (trialBannerContainer) {
    if (isUnlimitedPro) {
      // PRO accounts NEVER see trial warnings or scan limitations
      trialBannerContainer.innerHTML = '';
      trialBannerContainer.style.display = 'none';
    } else if (usedFreeTrialThisScan) {
      trialBannerContainer.innerHTML = `
        <div class="trial-active-banner">
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <div style="font-size:24px;line-height:1;">🎁</div>
            <div style="flex:1;">
              <div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:#22C55E;">
                Darmowa analiza PRO aktywna (1/1)!
              </div>
              <div style="font-size:12px;color:#BAC8DB;margin-top:3px;line-height:1.45;">
                Otrzymałeś pełny dostęp do statystyk, radaru kontuzji i prognozy AI dla tego meczu.
              </div>
            </div>
          </div>
          <button type="button" class="btn btn-buy-pro" style="height:40px;padding:0 14px;font-size:12px;margin:10px 0 0 0;width:100%;font-weight:800;" onclick="openProModal()">
            ⚡ Jeśli chcesz więcej statystyk, przejdź na PRO
          </button>
        </div>
      `;
      trialBannerContainer.style.display = 'block';
    } else if (!isProScan) {
      // 2nd analysis without PRO license: encourage purchasing PRO
      trialBannerContainer.innerHTML = `
        <div class="trial-active-banner" style="background:rgba(245, 158, 11, 0.08);border:1px solid rgba(245, 158, 11, 0.3);">
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <div style="font-size:24px;line-height:1;">🔒</div>
            <div style="flex:1;">
              <div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:#F59E0B;">
                Wykorzystano darmową analizę PRO na start (0/1 pozostało)
              </div>
              <div style="font-size:12px;color:#BAC8DB;margin-top:3px;line-height:1.45;">
                Podstawowy raport meczowy jest dostępny poniżej. Zaawansowane sekcje (AI Advisor, Value Bety, kalkulator gemów i radar kontuzji) są zablokowane. Aby je odblokować dla każdego meczu, przejdź na pakiet PRO.
              </div>
            </div>
          </div>
          <button type="button" class="btn btn-buy-pro" style="height:42px;padding:0 14px;font-size:13px;margin:10px 0 0 0;width:100%;font-weight:800;" onclick="openProModal()">
            ⚡ Przejdź na PRO i odblokuj pełną analizę
          </button>
        </div>
      `;
      trialBannerContainer.style.display = 'block';
    } else {
      trialBannerContainer.innerHTML = '';
      trialBannerContainer.style.display = 'none';
    }
  }

  // Apply Paywall according to isProScan state
  applyPaywall(isProScan);
}

/**
 * Render match history with clean surface filter pills.
 */
export function renderMatchHistory(matches, player1, player2, activeFilter = 'All') {
  const historyContainer = document.getElementById('history-content');
  if (!historyContainer) return;

  const counts = {
    All: matches.length,
    Hard: matches.filter(m => m.surface === 'Hard').length,
    Clay: matches.filter(m => m.surface === 'Clay').length,
    Grass: matches.filter(m => m.surface === 'Grass').length,
    Indoor: matches.filter(m => m.surface === 'Indoor').length,
  };

  const filteredMatches = activeFilter === 'All' 
    ? matches 
    : matches.filter(m => m.surface === activeFilter);

  historyContainer.innerHTML = `
    <div class="card-title">
      <span>Historia spotkań</span>
      <span style="font-size:11px;color:#64748B;font-weight:500;text-transform:none;">${filteredMatches.length} z ${matches.length}</span>
    </div>

    <!-- Filter Pills -->
    <div class="filter-pills-row">
      <button type="button" class="filter-pill ${activeFilter === 'All' ? 'active' : ''}" onclick="window.filterHistorySurface('All')">
        Wszystkie (${counts.All})
      </button>
      <button type="button" class="filter-pill ${activeFilter === 'Hard' ? 'active' : ''}" onclick="window.filterHistorySurface('Hard')">
        Hard (${counts.Hard})
      </button>
      <button type="button" class="filter-pill ${activeFilter === 'Clay' ? 'active' : ''}" onclick="window.filterHistorySurface('Clay')">
        Mączka (${counts.Clay})
      </button>
      <button type="button" class="filter-pill ${activeFilter === 'Grass' ? 'active' : ''}" onclick="window.filterHistorySurface('Grass')">
        Trawa (${counts.Grass})
      </button>
      <button type="button" class="filter-pill ${activeFilter === 'Indoor' ? 'active' : ''}" onclick="window.filterHistorySurface('Indoor')">
        Hala (${counts.Indoor})
      </button>
    </div>

    <div class="match-list">
      ${filteredMatches.length === 0 ? `
        <div style="text-align:center;padding:12px;color:#64748B;font-size:12px;background:#080B11;border-radius:6px;">
          Brak bezpośrednich spotkań na nawierzchni: <strong>${SURFACE_PL[activeFilter] || activeFilter}</strong>
        </div>
      ` : filteredMatches.map(m => {
        const winnerName = m.winner === 1 ? m.player1 || player1 : m.player2 || player2;
        const sTag = (m.surface || 'Hard').toLowerCase();
        return `
          <div class="match-row">
            <div class="match-row-left">
              <div class="winner-indicator ${m.winner === 1 ? 'p1' : 'p2'}"></div>
              <div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span class="match-tourn">${m.tournament}</span>
                  <span class="surface-tag ${sTag}">${m.surfacePL || m.surface}</span>
                </div>
                <div class="match-date">
                  ${m.date || 'Wcześniej'} • Zwycięzca: <span style="color:${m.winner === 1 ? '#22C55E' : '#EF4444'};font-weight:600;">${winnerName}</span>
                </div>
              </div>
            </div>
            <div class="match-score">${m.score}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

const ADVANCED_CARD_IDS = [
  'ai-advisor-card',
  'surface-card',
  'ou-card',
  'first-set-card',
  'injury-card',
  'verdict-card',
];

/**
 * Apply or remove the Paywall blur and lock overlay on advanced sections.
 */
export function applyPaywall(isPro) {
  ADVANCED_CARD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (isPro) {
      el.classList.remove('paywall-locked');
      const overlay = el.querySelector('.paywall-overlay');
      if (overlay) overlay.remove();
    } else {
      el.classList.add('paywall-locked');
      if (!el.querySelector('.paywall-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'paywall-overlay';
        overlay.innerHTML = `
          <div class="paywall-lock-icon">🔒</div>
          <div class="paywall-title">Dostęp tylko w pakiecie PRO</div>
          <div class="paywall-desc">Wykorzystałeś darmową analizę PRO na start. Jeśli chcesz więcej statystyk, przejdź na PRO lub aktywuj kod.</div>
          <button type="button" class="btn-paywall-unlock" onclick="window.openProModal()">⚡ Jeśli chcesz więcej statystyk, przejdź na PRO</button>
        `;
        el.appendChild(overlay);
      }
    }
  });
}

/**
 * Toggle visibility of PRO purchase, checkout, and voucher elements for PRO accounts.
 */
export function updateProModalView(isPro) {
  const pricingBox = document.querySelector('.pro-pricing-box');
  const buyBtn = document.querySelector('#pro-modal .btn-buy-pro');
  const voucherBox = document.querySelector('.pro-voucher-box');
  const activeCard = document.getElementById('pro-active-banner');
  const welcomeCta = document.querySelector('.welcome-cta-banner');
  const profileProBtn = document.getElementById('profile-pro-action-btn');
  const proModalSubtitle = document.getElementById('pro-modal-subtitle');

  if (isPro) {
    if (pricingBox) pricingBox.style.display = 'none';
    if (buyBtn) buyBtn.style.display = 'none';
    if (voucherBox) voucherBox.style.display = 'none';
    if (activeCard) activeCard.style.display = 'block';
    if (welcomeCta) welcomeCta.style.display = 'none';
    if (profileProBtn) profileProBtn.style.display = 'none';
    if (proModalSubtitle) proModalSubtitle.textContent = 'Twój pakiet STATIQWIN PRO jest aktywny';
  } else {
    if (pricingBox) pricingBox.style.display = 'flex';
    if (buyBtn) buyBtn.style.display = 'block';
    if (voucherBox) voucherBox.style.display = 'block';
    if (activeCard) activeCard.style.display = 'none';
    if (welcomeCta) welcomeCta.style.display = 'block';
    if (profileProBtn) profileProBtn.style.display = 'block';
    if (proModalSubtitle) proModalSubtitle.textContent = 'Nielimitowane analizy na żywo z autorskim systemem AI';
  }
}

/**
 * Update UI for PRO mode state.
 */
export function updateLicenseUI(isPro, licenseKey) {
  const body = document.body;
  const headerProBtn = document.getElementById('header-pro-btn');

  if (headerProBtn) {
    if (isPro) {
      headerProBtn.textContent = 'PRO ✓';
      headerProBtn.classList.add('pro-active');
      headerProBtn.title = 'Pakiet STATIQWIN PRO jest aktywny';
    } else {
      headerProBtn.textContent = 'PRO';
      headerProBtn.classList.remove('pro-active');
      headerProBtn.title = 'Kup / Aktywuj dostęp PRO';
    }
  }

  if (isPro) {
    body.classList.add('pro-mode');
    const trialBannerContainer = document.getElementById('trial-banner-container');
    if (trialBannerContainer) {
      trialBannerContainer.innerHTML = '';
      trialBannerContainer.style.display = 'none';
    }
    applyPaywall(true);
    updateProModalView(true);
  } else {
    body.classList.remove('pro-mode');
    updateProModalView(false);
    const isFreeScanActive = !!document.querySelector('.trial-active-banner');
    if (!isFreeScanActive) {
      applyPaywall(false);
    }
  }
}

/**
 * Update UI for user profile and authentication state.
 */
export function updateAuthUI(user) {
  const authBtn = document.getElementById('header-auth-btn');
  const userBadge = document.getElementById('header-user-badge');
  const headerEmail = document.getElementById('header-user-email');
  const headerPlan = document.getElementById('header-user-plan');

  const userIcon = document.getElementById('user-btn-icon');
  const userLabel = document.getElementById('user-btn-label');
  const profileEmail = document.getElementById('profile-user-email');
  const profileName = document.getElementById('profile-user-name');
  const profileAvatar = document.getElementById('profile-avatar-icon');
  const profileStatusBox = document.getElementById('profile-status-box');
  const profileStatusText = document.getElementById('profile-status-text');
  const profileStatusBadge = document.getElementById('profile-status-badge');

  const scannerTag = document.querySelector('.scanner-status-tag');
  const welcomeAuthBox = document.getElementById('welcome-auth-box');

  if (user) {
    const emailPrefix = user.email.split('@')[0];
    const initials = (emailPrefix.slice(0, 2) || 'SW').toUpperCase();
    const displayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);

    // Switch right header corner: hide 'Zaloguj' button, show user badge (email, status, logout)
    if (authBtn) authBtn.style.display = 'none';
    if (userBadge) userBadge.style.display = 'inline-flex';
    if (headerEmail) {
      headerEmail.textContent = user.email;
      headerEmail.title = user.email;
    }
    if (headerPlan) {
      headerPlan.textContent = user.isPro ? 'PRO' : 'FREE';
      headerPlan.className = 'header-user-plan ' + (user.isPro ? 'plan-pro' : 'plan-free');
    }

    // Sync PRO state to modal elements and body.pro-mode
    const isUserPro = !!user.isPro;
    updateProModalView(isUserPro);
    if (isUserPro) {
      document.body.classList.add('pro-mode');
      const trialBannerContainer = document.getElementById('trial-banner-container');
      if (trialBannerContainer) {
        trialBannerContainer.innerHTML = '';
        trialBannerContainer.style.display = 'none';
      }
      applyPaywall(true);
    } else if (!licenseManager.isPro) {
      document.body.classList.remove('pro-mode');
    }

    if (userIcon) {
      userIcon.textContent = user.isPro ? '⚡' : '👤';
    }
    if (userLabel) {
      const shortEmail = user.email.length > 14 ? user.email.slice(0, 12) + '...' : user.email;
      userLabel.textContent = displayName || shortEmail;
    }
    if (profileEmail) profileEmail.textContent = user.email;
    if (profileName) {
      profileName.textContent = displayName;
    }
    if (profileAvatar) {
      profileAvatar.textContent = initials;
      if (user.isPro) {
        profileAvatar.classList.add('is-pro');
      } else {
        profileAvatar.classList.remove('is-pro');
      }
    }
    if (profileStatusBox) {
      if (user.isPro) profileStatusBox.classList.add('pro-active-box');
      else profileStatusBox.classList.remove('pro-active-box');
    }
    if (profileStatusText) {
      profileStatusText.textContent = user.isPro ? 'STATIQWIN PRO Aktywne' : 'Konto Aktywne (FREE)';
      profileStatusText.style.color = user.isPro ? '#22C55E' : '#94A3B8';
    }
    if (profileStatusBadge) {
      profileStatusBadge.textContent = user.isPro ? 'PRO' : 'FREE';
      profileStatusBadge.style.color = user.isPro ? '#22C55E' : '#94A3B8';
      profileStatusBadge.style.borderColor = user.isPro ? 'rgba(34,197,94,0.3)' : '#23314A';
    }

    if (scannerTag) {
      scannerTag.textContent = user.isPro ? 'PRO • Gotowy do analizy' : 'Gotowy do analizy';
      scannerTag.style.color = '#22C55E';
    }

    if (welcomeAuthBox) {
      welcomeAuthBox.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:20px;color:#22C55E;">✓</div>
          <div>
            <div style="font-family:var(--font-display);font-size:13px;font-weight:800;color:#22C55E;">
              Zalogowano jako ${user.email}
            </div>
            <div style="font-size:11px;color:#BAC8DB;margin-top:2px;">
              Możesz wkleić link do meczu z Flashscore i rozpocząć analizę.
            </div>
          </div>
        </div>
      `;
    }
  } else {
    // Switch right header corner: show 'Zaloguj' button, hide user badge
    if (authBtn) {
      authBtn.style.display = 'inline-flex';
      authBtn.classList.remove('user-logged-in');
    }
    if (userBadge) userBadge.style.display = 'none';

    const isLicensePro = !!(typeof licenseManager !== 'undefined' && licenseManager.isPro);
    updateProModalView(isLicensePro);
    if (!isLicensePro) {
      document.body.classList.remove('pro-mode');
    }

    if (userIcon) userIcon.innerHTML = '👤';
    if (userLabel) userLabel.textContent = 'Zaloguj';
    if (profileEmail) profileEmail.textContent = 'Gość (Niezalogowany)';
    if (profileName) profileName.textContent = 'Konto Gościa';
    if (profileAvatar) {
      profileAvatar.innerHTML = 'SW';
      profileAvatar.classList.remove('is-pro');
    }
    if (profileStatusBox) profileStatusBox.classList.remove('pro-active-box');
    if (profileStatusText) {
      profileStatusText.textContent = 'Konto Gościa';
      profileStatusText.style.color = '#94A3B8';
    }
    if (profileStatusBadge) {
      profileStatusBadge.textContent = 'FREE';
      profileStatusBadge.style.color = '#94A3B8';
      profileStatusBadge.style.borderColor = '#23314A';
    }

    if (scannerTag) {
      scannerTag.textContent = '🔒 Wymagane logowanie';
      scannerTag.style.color = '#F59E0B';
    }

    if (welcomeAuthBox) {
      welcomeAuthBox.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
          <div style="font-size:24px;line-height:1;">🔑</div>
          <div style="flex:1;">
            <div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:#FFF;">
              Wymagane logowanie do analizy
            </div>
            <div style="font-size:12px;color:#BAC8DB;margin-top:2px;line-height:1.45;">
              Aby przeanalizować mecz z Flashscore, zaloguj się lub załóż darmowe konto e-mail. Otrzymasz <strong>1 darmową analizę PRO</strong> na start!
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn btn-scan" style="flex:1;height:42px;font-size:13px;font-weight:700;" onclick="openAuthModal('login')">
            <span>Zaloguj się</span>
          </button>
          <button type="button" class="btn btn-clipboard" style="flex:1;height:42px;font-size:13px;font-weight:700;" onclick="openAuthModal('register')">
            <span>Załóż konto</span>
          </button>
        </div>
      `;
    }
  }
}

/**
 * Render Live Tennis Feed Section (Tabs and Matches Grid)
 */
export function renderLiveTennisFeed(summary, activeTab = 'live') {
  if (!summary) return;

  const liveBadge = document.getElementById('badge-live-count');
  const scheduledBadge = document.getElementById('badge-scheduled-count');
  const analyzedBadge = document.getElementById('badge-analyzed-count');
  const grid = document.getElementById('live-matches-grid');
  const syncTimeEl = document.getElementById('live-last-sync-time');
  const statusTextEl = document.getElementById('live-feed-status-text');

  if (liveBadge) liveBadge.textContent = String(summary.live?.length || 0);
  if (scheduledBadge) scheduledBadge.textContent = String(summary.scheduled?.length || 0);
  if (analyzedBadge) analyzedBadge.textContent = String(summary.recentlyAnalyzed?.length || 0);

  // Update tabs active state
  const tabs = ['live', 'scheduled', 'analyzed'];
  tabs.forEach(tabKey => {
    const btn = document.getElementById(`tab-${tabKey}-matches`);
    if (btn) {
      if (tabKey === activeTab) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });

  if (syncTimeEl) {
    const now = summary.lastUpdated || new Date();
    const timeStr = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    syncTimeEl.textContent = `Ostatnia aktualizacja: ${timeStr}`;
  }

  if (statusTextEl) {
    if (summary.isLoading) {
      statusTextEl.textContent = 'Pobieranie wyników na żywo z ATP & WTA...';
    } else {
      statusTextEl.textContent = 'Synchronizacja z oficjalnym Scoreboardem ATP & WTA (co 60s)';
    }
  }

  if (!grid) return;

  // Determine list based on active tab
  let matchList = [];
  if (activeTab === 'live') {
    matchList = summary.live || [];
  } else if (activeTab === 'scheduled') {
    matchList = summary.scheduled || [];
  } else if (activeTab === 'analyzed') {
    matchList = summary.recentlyAnalyzed || [];
  }

  if (matchList.length === 0) {
    if (activeTab === 'live') {
      grid.innerHTML = `
        <div class="live-empty-state">
          <div class="live-empty-icon">🎾</div>
          <div class="live-empty-title">Brak meczów trwających w tej chwili</div>
          <p class="live-empty-desc">
            Zawodnicy mają przerwę między sesjami lub mecze jeszcze się nie rozpoczęły.
            Przejdź do zakładki <strong>„Dzisiejsze mecze”</strong> (${summary.scheduled?.length || 0}), aby przeanalizować nadchodzące pojedynki!
          </p>
          <button type="button" class="btn btn-scan" style="margin:12px auto 0;height:36px;font-size:12px;padding:0 16px;" onclick="window.switchLiveTennisTab('scheduled')">
            Zobacz zaplanowane mecze
          </button>
        </div>
      `;
    } else if (activeTab === 'scheduled') {
      grid.innerHTML = `
        <div class="live-empty-state">
          <div class="live-empty-icon">⏳</div>
          <div class="live-empty-title">Brak zaplanowanych meczów w kalendarzu na dziś</div>
          <p class="live-empty-desc">
            Wszystkie dzisiejsze pojedynki zostały już zakończone lub oczekują na zatwierdzenie planu gier.
          </p>
        </div>
      `;
    } else {
      grid.innerHTML = `
        <div class="live-empty-state">
          <div class="live-empty-icon">⚡</div>
          <div class="live-empty-title">Brak ostatnio przeanalizowanych meczów</div>
          <p class="live-empty-desc">
            Wybierz dowolny mecz z powyższych zakładek lub wklej link z Flashscore w Skanerze, a pojawi się tutaj w Twojej historii analiz!
          </p>
        </div>
      `;
    }
    return;
  }

  // Render cards
  grid.innerHTML = matchList.map(match => {
    const isLive = match.state === 'in';
    const isPre = match.state === 'pre';
    const isPost = match.state === 'post';

    let badgeClass = 'scheduled';
    let badgeText = match.statusText || 'Zaplanowany';

    if (isLive) {
      badgeClass = 'pulse';
      badgeText = `<span class="live-pulse-dot" style="width:5px;height:5px;"></span> LIVE`;
    } else if (isPost) {
      badgeClass = 'finished';
      badgeText = 'FINAŁ';
    }

    // Set scores display
    let scoresHtml = '';
    if (match.scores && match.scores.length > 0) {
      scoresHtml = `
        <div class="live-scores-box">
          ${match.scores.map(s => `
            <div style="display:flex;flex-direction:column;gap:2px;">
              <span class="live-score-val ${s.p1 > s.p2 ? 'highlight' : ''}">${s.p1}</span>
              <span class="live-score-val ${s.p2 > s.p1 ? 'highlight' : ''}">${s.p2}</span>
            </div>
          `).join('')}
        </div>
      `;
    } else if (isPre) {
      scoresHtml = `<span style="font-size:11px;color:#94A3B8;font-weight:700;">${match.statusDetail || 'Przed meczem'}</span>`;
    }

    const p1FlagHtml = match.p1Flag
      ? `<img src="${match.p1Flag}" class="live-player-flag" alt="${match.p1Country || ''}" onerror="this.style.display='none'" />`
      : `<span class="live-player-flag-fallback">${(match.p1Country || 'ATP').slice(0, 3)}</span>`;

    const p2FlagHtml = match.p2Flag
      ? `<img src="${match.p2Flag}" class="live-player-flag" alt="${match.p2Country || ''}" onerror="this.style.display='none'" />`
      : `<span class="live-player-flag-fallback">${(match.p2Country || 'WTA').slice(0, 3)}</span>`;

    const prediction = match.aiPrediction || {};

    return `
      <div class="live-match-card" data-match-id="${match.id}">
        <div class="live-card-top">
          <div style="display:flex;align-items:center;gap:6px;overflow:hidden;">
            <span class="live-card-badge ${badgeClass}">${badgeText}</span>
            <span class="live-card-tour" title="${match.tournament}">${match.tour ? `${match.tour} • ` : ''}${match.tournament}</span>
          </div>
          <span class="live-card-surface-tag">${match.surfaceLabel || 'Twarda'}</span>
        </div>

        <div class="live-card-matchup">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
              <div class="live-player-row">
                <div class="live-player-info">
                  ${p1FlagHtml}
                  <span class="live-player-name ${match.p1Winner ? 'winner' : ''}">${match.player1}</span>
                </div>
              </div>
              <div class="live-player-row">
                <div class="live-player-info">
                  ${p2FlagHtml}
                  <span class="live-player-name ${match.p2Winner ? 'winner' : ''}">${match.player2}</span>
                </div>
              </div>
            </div>
            ${scoresHtml}
          </div>
        </div>

        ${prediction.suggestedBet ? `
          <div class="live-card-ai-box">
            <div class="live-ai-pill">
              <span>🎯 Predykcja AI:</span>
              <span style="color:#FFF;">${prediction.suggestedBet}</span>
              ${prediction.confidence ? `<span style="font-size:10px;color:#4ADE80;margin-left:auto;">${prediction.confidence}%</span>` : ''}
            </div>
            ${prediction.rationale ? `<div class="live-ai-rationale">${prediction.rationale}</div>` : ''}
          </div>
        ` : ''}

        <button type="button" class="btn btn-scan live-card-btn" onclick="window.analyzeLiveMatchById('${match.id}')">
          <span style="font-size:14px;">⚡</span>
          <span>Analizuj w AI</span>
        </button>
      </div>
    `;
  }).join('');
}

/**
 * Display floating live toast in bottom-left corner
 */
export function renderFloatingLiveToast(match) {
  const toast = document.getElementById('floating-live-toast');
  if (!toast || !match) return;

  const badge = document.getElementById('floating-toast-badge');
  const tour = document.getElementById('floating-toast-tour');
  const p1 = document.getElementById('floating-toast-p1');
  const p2 = document.getElementById('floating-toast-p2');
  const score = document.getElementById('floating-toast-score');
  const pred = document.getElementById('floating-toast-prediction');

  const isLive = match.state === 'in';
  if (badge) {
    badge.textContent = isLive ? '🔴 LIVE' : match.state === 'pre' ? '⏳ DZISIAJ' : '✅ WYNIK';
    badge.className = `floating-live-badge ${isLive ? 'pulse' : ''}`;
  }
  if (tour) tour.textContent = `${match.tour ? `${match.tour} • ` : ''}${match.tournament || 'Turniej Tenisowy'}`;
  if (p1) p1.textContent = match.player1;
  if (p2) p2.textContent = match.player2;

  if (score) {
    if (match.formattedScore && match.formattedScore !== '0:0') {
      score.textContent = `Wynik: ${match.formattedScore} ${match.statusDetail ? `(${match.statusDetail})` : ''}`;
    } else {
      score.textContent = match.statusText || 'Start dzisiaj';
    }
  }

  if (pred) {
    const p = match.aiPrediction || {};
    pred.textContent = p.suggestedBet
      ? `🎯 AI: ${p.suggestedBet} ${p.confidence ? `• Szansa ${p.confidence}%` : ''}`
      : '🎯 Kliknij, aby wygenerować pełną prognozę taktyczną AI';
  }

  toast.classList.add('show');
}

export function dismissFloatingLiveToast() {
  const toast = document.getElementById('floating-live-toast');
  if (toast) {
    toast.classList.remove('show');
  }
}

/**
 * Render modern loading state while Gemini AI generates deep tactical synthesis.
 */
export function renderAILoadingState() {
  const aiContentEl = document.getElementById('ai-advisor-content');
  if (!aiContentEl) return;
  aiContentEl.innerHTML = `
    <div class="ai-deep-synthesis-loading">
      <div class="ai-synthesis-glow-container">
        <div class="ai-synthesis-rings">
          <div class="ai-ring ring-outer"></div>
          <div class="ai-ring ring-middle"></div>
          <div class="ai-ring ring-inner"></div>
          <div class="ai-core-icon">⚡</div>
        </div>
      </div>
      <div class="ai-synthesis-details">
        <div class="ai-synthesis-pill">
          <span class="pulse-dot"></span> MODEL AI W TRAKCIE KALKULACJI
        </div>
        <div class="ai-synthesis-title">STATIQWIN AI przeprowadza głęboką syntezę taktyczną...</div>
        <div class="ai-synthesis-desc">
          Model Google Gemini analizuje matchup stylów gry, odporność na nawierzchnię, historię gemową, radar kontuzji oraz matematyczną detekcję Value Betów (+EV).
        </div>
        <div class="ai-synthesis-bars">
          <div class="ai-progress-bar"><div class="ai-progress-fill"></div></div>
        </div>
      </div>
    </div>
  `;
}


