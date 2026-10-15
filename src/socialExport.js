/**
 * Social media export generators in Polish.
 * Produces Discord-formatted reports and TikTok/ElevenLabs voiceover scripts.
 */

import { SURFACE_PL } from './parser.js';

/**
 * Generate Discord-formatted H2H report in Polish.
 */
export function generateDiscordReport({ player1, player2, tournament, surface, h2h, surfaceRates, injury1, injury2, form, momentum, verdict }) {
  const surfaceName = SURFACE_PL[surface] || surface;
  const sr = surfaceRates[surface] || {};

  let r = '';
  r += `🎾 **ANALIZA H2H: ${player1} vs ${player2}**\n`;
  r += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  r += `📅 **Turniej:** ${tournament} | **Nawierzchnia:** ${surfaceName}\n`;
  r += `📊 **Bilans H2H:** ${player1} ${h2h.p1Wins} - ${h2h.p2Wins} ${player2}\n\n`;

  if (sr.total > 0) {
    r += `🏟️ **Skuteczność na ${surfaceName}:**\n`;
    r += `   ${player1}: ${sr.p1Pct}% (${sr.p1}W/${sr.p2}L)\n`;
    r += `   ${player2}: ${sr.p2Pct}% (${sr.p2}W/${sr.p1}L)\n\n`;
  }

  r += `📈 **Forma:** ${player1} ${form.p1}% | ${player2} ${form.p2}%\n`;

  if (momentum.streakCount >= 2) {
    const sp = momentum.streakPlayer === 1 ? player1 : player2;
    r += `🔥 **Momentum:** ${sp} na serii ${momentum.streakCount} wygranych\n`;
  }
  r += `\n`;

  if (injury1.level !== 'low') {
    const e = injury1.level === 'high' ? '🔴' : '🟡';
    r += `${e} **Alert zdrowotny ${player1}:** Ryzyko ${injury1.score}% — ${injury1.factors.join(', ')}\n`;
  }
  if (injury2.level !== 'low') {
    const e = injury2.level === 'high' ? '🔴' : '🟡';
    r += `${e} **Alert zdrowotny ${player2}:** Ryzyko ${injury2.score}% — ${injury2.factors.join(', ')}\n`;
  }
  r += `\n`;

  if (verdict.favoredPlayer) {
    r += `🔮 **Werdykt:** ${verdict.favoredPlayer} — pewność ${verdict.confidence}%\n`;
    if (verdict.isValueBet) r += `💎 **VALUE BET** — kontuzja rywala zwiększa wartość zakładu\n`;
  } else {
    r += `🔮 **Werdykt:** Wyrównany mecz (50/50)\n`;
  }
  r += `\n📌 **Powody:**\n`;
  verdict.reasons.forEach(reason => { r += `   • ${reason}\n`; });
  r += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  r += `📱 Wygenerowano przez ProMatch H2H Analyzer\n`;
  r += `#tenis #typy #analizameczowa #h2h`;
  return r;
}

/**
 * Generate TikTok/ElevenLabs voiceover script in Polish (~20 sec).
 */
export function generateTikTokScript({ player1, player2, tournament, surface, h2h, surfaceRates, injury1, injury2, verdict }) {
  const surfaceName = SURFACE_PL[surface] || surface;
  const sr = surfaceRates[surface] || {};

  let s = `Mam dla Was gorący typ na dziś! `;
  s += `Prześwietliłem mecz ${player1} kontra ${player2} na ${tournament}. `;

  if (sr.total > 0) {
    const better = sr.p1Pct >= sr.p2Pct ? player1 : player2;
    const pct = sr.p1Pct >= sr.p2Pct ? sr.p1Pct : sr.p2Pct;
    s += `Na ${surfaceName} ${better} wygrywa aż ${pct}% meczów! `;
  }

  if (injury1.level === 'high') s += `Uwaga — ${player1} zgłosił problemy zdrowotne w ostatnim meczu! `;
  else if (injury2.level === 'high') s += `Uwaga — ${player2} zgłosił problemy zdrowotne w ostatnim meczu! `;

  if (h2h.p1Wins !== h2h.p2Wins) {
    const leader = h2h.p1Wins > h2h.p2Wins ? player1 : player2;
    const w = Math.max(h2h.p1Wins, h2h.p2Wins);
    const l = Math.min(h2h.p1Wins, h2h.p2Wins);
    s += `W bezpośrednich starciach prowadzi ${leader} ${w} do ${l}. `;
  }

  if (verdict.favoredPlayer) {
    s += `Mój werdykt? Stawiam na ${verdict.favoredPlayer} z pewnością ${verdict.confidence}%! `;
    if (verdict.isValueBet) s += `To może być value bet — sprawdźcie kursy! `;
  } else {
    s += `Mecz jest mega wyrównany — może być niespodzianka! `;
  }

  s += `Dajcie znać w komentarzach co myślicie!`;
  return s;
}
