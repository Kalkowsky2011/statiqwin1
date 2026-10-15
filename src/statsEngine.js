import { parseScore, matchPlayer, SURFACE_PL } from './parser.js';

/**
 * Calculate overall H2H record.
 * Strictly counts direct matches between the two players (isDirectH2H === true).
 */
export function calculateH2H(matches, p1 = null, p2 = null) {
  if (!matches || matches.length === 0) {
    return { p1Wins: 0, p2Wins: 0, total: 0, directMatches: [] };
  }

  // Filter strictly to direct H2H matches (exclude third-party form rows)
  const directMatches = matches.filter(m => {
    if (m.isDirectH2H !== undefined) return m.isDirectH2H === true;
    if (p1 && p2 && m.player1 && m.player2) {
      return (matchPlayer(m.player1, p1) && matchPlayer(m.player2, p2)) ||
             (matchPlayer(m.player1, p2) && matchPlayer(m.player2, p1));
    }
    return true;
  });

  let p1Wins = 0, p2Wins = 0;
  for (const m of directMatches) {
    if (m.winner === 1) p1Wins++;
    else if (m.winner === 2) p2Wins++;
  }
  return { p1Wins, p2Wins, total: directMatches.length, directMatches };
}

/**
 * Filter matches by surface.
 */
export function filterBySurface(matches, surface) {
  if (!surface || surface === 'All') return matches;
  return matches.filter(m => m.surface === surface);
}

/**
 * Filter matches by tournament tier.
 */
export function filterByTier(matches, tier) {
  if (!tier || tier === 'All') return matches;
  return matches.filter(m => m.tier === tier);
}

/**
 * Surface-specific win rates for both players.
 */
export function surfaceWinRates(matches) {
  const surfaces = ['Hard', 'Clay', 'Grass', 'Indoor'];
  const result = {};
  for (const surface of surfaces) {
    const sm = filterBySurface(matches, surface);
    if (sm.length === 0) {
      result[surface] = { p1: 0, p2: 0, total: 0, p1Pct: 0, p2Pct: 0, surfacePL: SURFACE_PL[surface] || surface };
      continue;
    }
    let p1 = 0, p2 = 0;
    for (const m of sm) { if (m.winner === 1) p1++; else p2++; }
    result[surface] = {
      p1, p2, total: sm.length,
      p1Pct: Math.round((p1 / sm.length) * 100),
      p2Pct: Math.round((p2 / sm.length) * 100),
      surfacePL: SURFACE_PL[surface] || surface,
    };
  }
  return result;
}

/**
 * Win rate (0-100 for each player) based on recent matches.
 * Formula: (Wygrane / Wszystkie mecze) * 100
 */
export function calculateForm(matches, count = 10) {
  if (!matches || matches.length === 0) {
    return { p1: 50, p2: 50, p1Wins: 0, p2Wins: 0, total: 0 };
  }

  // Check if matches have player-specific form flags (forPlayer: 1 or 2)
  const hasPlayerForm = matches.some(m => m.forPlayer !== undefined);
  if (hasPlayerForm) {
    const p1FormMatches = matches.filter(m => m.forPlayer === 1 || (m.isDirectH2H && m.winner !== undefined));
    const p2FormMatches = matches.filter(m => m.forPlayer === 2 || (m.isDirectH2H && m.winner !== undefined));

    const p1Recent = p1FormMatches.slice(0, count);
    const p2Recent = p2FormMatches.slice(0, count);

    const p1W = p1Recent.filter(m => m.forPlayer === 1 ? m.wonByPlayer : m.winner === 1).length;
    const p2W = p2Recent.filter(m => m.forPlayer === 2 ? m.wonByPlayer : m.winner === 2).length;

    return {
      p1: p1Recent.length > 0 ? Math.round((p1W / p1Recent.length) * 100) : 50,
      p2: p2Recent.length > 0 ? Math.round((p2W / p2Recent.length) * 100) : 50,
      p1Wins: p1W,
      p2Wins: p2W,
      total: p1Recent.length + p2Recent.length,
    };
  }

  const recent = matches.slice(0, count);
  let p1Wins = 0, p2Wins = 0;
  for (const m of recent) {
    if (m.winner === 1) p1Wins++;
    else if (m.winner === 2) p2Wins++;
  }
  const total = recent.length;
  return {
    p1: total > 0 ? Math.round((p1Wins / total) * 100) : 50,
    p2: total > 0 ? Math.round((p2Wins / total) * 100) : 50,
    p1Wins,
    p2Wins,
    total,
  };
}

/**
 * Momentum — current win streak.
 */
export function calculateMomentum(matches) {
  if (matches.length === 0) return { p1Streak: 0, p2Streak: 0, streakPlayer: 0, streakCount: 0 };
  let streak = 0;
  const firstWinner = matches[0].winner;
  for (const m of matches) {
    if (m.winner === firstWinner) streak++;
    else break;
  }
  return {
    p1Streak: firstWinner === 1 ? streak : 0,
    p2Streak: firstWinner === 2 ? streak : 0,
    streakPlayer: firstWinner,
    streakCount: streak,
  };
}

// ======== INJURY RISK ANALYZER ========

const INJURY_KEYWORDS = [
  'krecz', 'ret.', 'retired', 'retirement',
  'medical timeout', 'mto',
  'ból', 'bol', 'kolano', 'plecy', 'ból pleców', 'bol plecow',
  'skurcze', 'cramps',
  'uraz', 'kontuzja', 'injury',
  'walkover', 'w/o',
  'ramię', 'ramie', 'nadgarstek', 'kostka', 'udo', 'biodro',
];

const MTO_KEYWORDS = ['krecz', 'ret.', 'retired', 'retirement', 'medical timeout', 'mto', 'walkover', 'w/o'];

function checkPlayerMatchNote(note, playerNum, p1Name = '', p2Name = '', matchWinner = 1) {
  if (!note) return false;
  const lowerNote = note.toLowerCase();
  const p1Last = p1Name ? p1Name.split(' ').pop().toLowerCase() : '';
  const p2Last = p2Name ? p2Name.split(' ').pop().toLowerCase() : '';

  if (playerNum === 1) {
    if (p1Last && lowerNote.includes(p1Last)) return true;
    if (p2Last && lowerNote.includes(p2Last)) return false;
    return matchWinner === 2; // if p1 lost, unassigned notes likely belong to p1
  } else {
    if (p2Last && lowerNote.includes(p2Last)) return true;
    if (p1Last && lowerNote.includes(p1Last)) return false;
    return matchWinner === 1; // if p2 lost, unassigned notes likely belong to p2
  }
}

/**
 * Injury risk for a specific player (1 or 2). Returns 0-100 score.
 */
export function analyzeInjuryRisk(matches, playerNum, player1Name = '', player2Name = '') {
  let score = 0;
  const factors = [];
  let detectedKeyword = null;

  const last3 = matches.slice(0, 3);
  for (const m of last3) {
    if (m.notes && checkPlayerMatchNote(m.notes, playerNum, player1Name, player2Name, m.winner)) {
      const notesLower = m.notes.toLowerCase();
      for (const kw of MTO_KEYWORDS) {
        if (notesLower.includes(kw)) {
          score += 45;
          factors.push('Medical Timeout / Krecz w ostatnich meczach');
          detectedKeyword = m.notes;
          break;
        }
      }
    }
  }

  const last5 = matches.slice(0, 5);
  for (const m of last5) {
    const ps = m.parsedScore || parseScore(m.score);
    if (ps.totalGames > 34) {
      score += 20;
      factors.push('Maratoński mecz w ostatnich 5 dniach (duże obciążenie)');
      break;
    }
  }

  if (last5.length >= 2 && last5[0].date && last5[1].date) {
    try {
      const p0 = last5[0].date.split('.');
      const p1d = last5[1].date.split('.');
      if (p0.length === 3 && p1d.length === 3) {
        const d0 = new Date(p0[2], p0[1] - 1, p0[0]);
        const d1 = new Date(p1d[2], p1d[1] - 1, p1d[0]);
        const diff = Math.abs((d0 - d1) / (1000 * 60 * 60 * 24));
        if (diff <= 2) {
          score += 15;
          factors.push('Krótka przerwa między meczami (≤2 dni)');
        }
      }
    } catch (e) { /* ignore */ }
  }

  for (const m of last5) {
    if (m.notes && checkPlayerMatchNote(m.notes, playerNum, player1Name, player2Name, m.winner)) {
      const notesLower = m.notes.toLowerCase();
      for (const kw of INJURY_KEYWORDS) {
        if (notesLower.includes(kw) && !MTO_KEYWORDS.includes(kw)) {
          score += 25;
          factors.push('Wykryto słowa kluczowe dot. problemów fizycznych (ból/skurcze)');
          if (!detectedKeyword) detectedKeyword = m.notes;
          break;
        }
      }
    }
  }

  score = Math.min(score, 100);
  let level = 'low';
  if (score > 60) level = 'high';
  else if (score > 30) level = 'medium';

  return { score, level, factors: [...new Set(factors)], keyword: detectedKeyword };
}

// ======== PRO FEATURES ========

/**
 * 1st set win percentage (PRO).
 * Accurate count of 1st sets won by each player based on real set games.
 */
export function firstSetStats(matches) {
  let p1W = 0, p2W = 0, total = 0;
  for (const m of matches) {
    const ps = m.parsedScore || parseScore(m.score);
    if (ps.sets && ps.sets.length > 0) {
      const first = ps.sets[0];
      if (typeof first.g1 === 'number' && typeof first.g2 === 'number') {
        if (first.g1 > first.g2) {
          p1W++;
          total++;
        } else if (first.g2 > first.g1) {
          p2W++;
          total++;
        }
      }
    }
  }
  return {
    p1W,
    p2W,
    p1Pct: total > 0 ? Math.round((p1W / total) * 100) : 0,
    p2Pct: total > 0 ? Math.round((p2W / total) * 100) : 0,
    total,
  };
}

/**
 * Over/Under game lines (PRO).
 * Real average games calculation and comparison against standard bookmaker lines.
 */
export function overUnderGames(matches) {
  const counts = [];
  for (const m of matches) {
    const ps = m.parsedScore || parseScore(m.score);
    if (ps && ps.totalGames > 0) counts.push(ps.totalGames);
  }
  if (counts.length === 0) return { avg: 0, lines: {}, totalMatchesWithGames: 0 };
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  const roundedAvg = Math.round(avg * 10) / 10;
  const lines = {};
  for (const line of [20.5, 21.5, 22.5, 23.5, 24.5]) {
    const overCount = counts.filter(g => g > line).length;
    const overPct = Math.round((overCount / counts.length) * 100);
    lines[line] = {
      line,
      over: overPct,
      under: 100 - overPct,
      isOverAvg: roundedAvg > line,
    };
  }
  return { avg: roundedAvg, lines, totalMatchesWithGames: counts.length };
}

/**
 * AI verdict based on mathematical win rates and statistics.
 * Confidence directly derived from form advantage (e.g. 80% vs 40% -> 80% confidence, Value Bet).
 */
export function generateVerdict(h2h, form, momentum, surfaceRates, currentSurface, injury1, injury2, player1, player2) {
  let p1Pts = 0, p2Pts = 0;
  const reasons = [];

  // 1. Direct form win-rate comparison
  if (form.p1 > form.p2) {
    p1Pts += 3;
    reasons.push(`${player1} w wyższej formie: ${form.p1}% wygranych vs ${form.p2}% ${player2}`);
  } else if (form.p2 > form.p1) {
    p2Pts += 3;
    reasons.push(`${player2} w wyższej formie: ${form.p2}% wygranych vs ${form.p1}% ${player1}`);
  } else {
    reasons.push(`Równy bilans formy obu zawodników (${form.p1}%)`);
  }

  // 2. Head to Head record
  if (h2h.p1Wins > h2h.p2Wins) {
    p1Pts += 2;
    reasons.push(`${player1} prowadzi w H2H ${h2h.p1Wins}-${h2h.p2Wins}`);
  } else if (h2h.p2Wins > h2h.p1Wins) {
    p2Pts += 2;
    reasons.push(`${player2} prowadzi w H2H ${h2h.p2Wins}-${h2h.p1Wins}`);
  }

  // 3. Surface mastery
  const sr = surfaceRates && surfaceRates[currentSurface];
  if (sr && sr.total > 0) {
    if (sr.p1Pct > sr.p2Pct + 10) {
      p1Pts += 2;
      reasons.push(`${player1} przeważa na nawierzchni (${SURFACE_PL[currentSurface] || currentSurface}: ${sr.p1Pct}% wygranych)`);
    } else if (sr.p2Pct > sr.p1Pct + 10) {
      p2Pts += 2;
      reasons.push(`${player2} przeważa na nawierzchni (${SURFACE_PL[currentSurface] || currentSurface}: ${sr.p2Pct}% wygranych)`);
    }
  }

  // 4. Injury / physical risk
  if (injury1 && injury1.level === 'high') {
    p1Pts -= 3;
    reasons.push(`⚠️ ${player1} — wysokie ryzyko kontuzji / obciążenia (${injury1.score}%)`);
  }
  if (injury2 && injury2.level === 'high') {
    p2Pts -= 3;
    reasons.push(`⚠️ ${player2} — wysokie ryzyko kontuzji / obciążenia (${injury2.score}%)`);
  }

  // 5. Momentum
  if (momentum && momentum.p1Streak >= 2) {
    p1Pts += 1;
    reasons.push(`${player1} ma serię: ${momentum.p1Streak} wygrane z rzędu`);
  }
  if (momentum && momentum.p2Streak >= 2) {
    p2Pts += 1;
    reasons.push(`${player2} ma serię: ${momentum.p2Streak} wygrane z rzędu`);
  }

  // Derive favored player and confidence directly from mathematical calculations
  let favoredPlayer, confidence;
  if (form.p1 !== form.p2) {
    if (form.p1 > form.p2) {
      favoredPlayer = player1;
      confidence = Math.min(95, Math.max(52, form.p1));
    } else {
      favoredPlayer = player2;
      confidence = Math.min(95, Math.max(52, form.p2));
    }
  } else if (p1Pts !== p2Pts) {
    favoredPlayer = p1Pts > p2Pts ? player1 : player2;
    confidence = Math.min(90, 52 + Math.abs(p1Pts - p2Pts) * 6);
  } else if (h2h.p1Wins !== h2h.p2Wins) {
    favoredPlayer = h2h.p1Wins > h2h.p2Wins ? player1 : player2;
    confidence = Math.min(90, Math.max(52, Math.round((Math.max(h2h.p1Wins, h2h.p2Wins) / (h2h.total || 1)) * 100)));
  } else {
    favoredPlayer = null;
    confidence = 50;
  }

  // Value Bet: Mathematical form edge (e.g. 80% vs 40% -> diff >= 25%) or health asymmetry
  const formDiff = Math.abs(form.p1 - form.p2);
  const healthAdvantage = (favoredPlayer === player1 && injury2 && injury2.level === 'high') ||
                          (favoredPlayer === player2 && injury1 && injury1.level === 'high');
  const isValueBet = Boolean(formDiff >= 25 || (confidence >= 65 && healthAdvantage) || confidence >= 80);

  return { favoredPlayer, confidence, reasons, p1Points: p1Pts, p2Points: p2Pts, isValueBet };
}
