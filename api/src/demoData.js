/**
 * Demo match presets for ProMatch H2H Analyzer.
 * 3 realistic tennis H2H datasets across different surfaces.
 */

function buildParsedScore(scoreStr) {
  const sets = scoreStr.split(',').map(s => s.trim()).filter(Boolean);
  let totalGames = 0;
  const parsed = sets.map(set => {
    const m = set.match(/(\d+)[:\-](\d+)/);
    if (m) {
      const g1 = parseInt(m[1]);
      const g2 = parseInt(m[2]);
      totalGames += g1 + g2;
      return { g1, g2 };
    }
    return null;
  }).filter(Boolean);
  return { sets: parsed, totalGames };
}

function addParsedScores(preset) {
  preset.matches = preset.matches.map(m => ({
    ...m,
    parsedScore: buildParsedScore(m.score),
  }));
  return preset;
}

const wimbledon = {
  id: 'wimbledon',
  label: '🌿 Wimbledon 2024 — Trawa',
  tournament: 'Wimbledon',
  surface: 'Grass',
  surfacePL: 'Trawa',
  tier: 'Grand Slam',
  player1: 'Carlos Alcaraz',
  player2: 'Novak Djokovic',
  matches: [
    { date: '14.07.2024', tournament: 'Wimbledon', surface: 'Grass', winner: 1, score: '6:2, 6:2, 7:6', notes: 'Djokovic: Medical Timeout / ból kolana (MTO)' },
    { date: '16.07.2023', tournament: 'Wimbledon', surface: 'Grass', winner: 1, score: '1:6, 7:6, 6:1, 3:6, 6:4', notes: null },
    { date: '05.06.2023', tournament: 'Roland Garros', surface: 'Clay', winner: 2, score: '6:3, 5:7, 6:1, 6:1', notes: null },
    { date: '22.01.2023', tournament: 'Australian Open', surface: 'Hard', winner: 2, score: '4:6, 6:4, 6:3, 6:4', notes: null },
    { date: '04.09.2023', tournament: 'US Open', surface: 'Hard', winner: 1, score: '6:3, 6:2, 1:6, 6:3', notes: null },
    { date: '15.11.2023', tournament: 'ATP Finals', surface: 'Hard', winner: 1, score: '6:3, 6:2', notes: null },
    { date: '06.06.2024', tournament: 'Roland Garros', surface: 'Clay', winner: 1, score: '2:6, 6:3, 6:4, 6:3', notes: null },
    { date: '13.10.2023', tournament: 'Shanghai Masters', surface: 'Hard', winner: 2, score: '7:6, 7:6', notes: 'Djokovic: MTO - kolano' },
  ],
  odds: {
    hasOdds: true,
    source: 'Flashscore Live',
    bestP1: { odds: 1.76, bookmaker: 'Fortuna' },
    bestP2: { odds: 2.18, bookmaker: 'Superbet' },
    avgP1: 1.74,
    avgP2: 2.14,
    matchWinner: [
      { bookmaker: 'Fortuna', p1: 1.76, p2: 2.12, openingP1: 1.80, openingP2: 2.05 },
      { bookmaker: 'STS', p1: 1.72, p2: 2.15, openingP1: 1.75, openingP2: 2.10 },
      { bookmaker: 'Superbet', p1: 1.75, p2: 2.18, openingP1: 1.78, openingP2: 2.08 },
      { bookmaker: 'Betclic', p1: 1.74, p2: 2.10, openingP1: 1.75, openingP2: 2.10 },
    ],
    firstSetWinner: [
      { bookmaker: 'Fortuna', p1: 1.80, p2: 2.00 },
      { bookmaker: 'STS', p1: 1.78, p2: 2.05 },
    ],
    overUnderGames: [
      { line: '21.5', over: 1.60, under: 2.25, bookmaker: 'Fortuna' },
      { line: '22.5', over: 1.82, under: 1.95, bookmaker: 'STS' },
      { line: '23.5', over: 2.10, under: 1.70, bookmaker: 'Superbet' },
    ],
    primaryOU: { line: '22.5', over: 1.82, under: 1.95, bookmaker: 'STS' },
    handicaps: [],
  },
};

const rolandGarros = {
  id: 'rolandgarros',
  label: '🧱 Roland Garros 2024 — Mączka',
  tournament: 'Roland Garros',
  surface: 'Clay',
  surfacePL: 'Mączka',
  tier: 'Grand Slam',
  player1: 'Jannik Sinner',
  player2: 'Rafael Nadal',
  matches: [
    { date: '07.06.2024', tournament: 'Roland Garros', surface: 'Clay', winner: 1, score: '6:2, 6:4, 6:1', notes: 'Nadal: ból pleców i biodra (MTO / krecz)' },
    { date: '17.05.2023', tournament: 'Roma Masters', surface: 'Clay', winner: 2, score: '1:6, 6:3, 6:4', notes: null },
    { date: '01.06.2022', tournament: 'Roland Garros', surface: 'Clay', winner: 2, score: '7:6, 6:4, 6:1', notes: null },
    { date: '13.10.2021', tournament: 'Indian Wells', surface: 'Hard', winner: 1, score: '6:3, 6:2', notes: null },
    { date: '03.06.2021', tournament: 'Roland Garros', surface: 'Clay', winner: 2, score: '7:5, 6:3, 6:0', notes: null },
    { date: '15.04.2021', tournament: 'Roma Masters', surface: 'Clay', winner: 2, score: '7:5, 6:4', notes: 'Nadal: skurcze' },
    { date: '17.11.2021', tournament: 'ATP Finals', surface: 'Hard', winner: 1, score: '6:2, 6:4', notes: null },
    { date: '22.01.2022', tournament: 'Australian Open', surface: 'Hard', winner: 1, score: '6:3, 6:4, 6:2', notes: null },
  ],
  odds: {
    hasOdds: true,
    source: 'Flashscore Live',
    bestP1: { odds: 1.48, bookmaker: 'Fortuna' },
    bestP2: { odds: 2.80, bookmaker: 'Superbet' },
    avgP1: 1.46,
    avgP2: 2.74,
    matchWinner: [
      { bookmaker: 'Fortuna', p1: 1.48, p2: 2.70, openingP1: 1.50, openingP2: 2.60 },
      { bookmaker: 'STS', p1: 1.45, p2: 2.75, openingP1: 1.46, openingP2: 2.70 },
      { bookmaker: 'Superbet', p1: 1.46, p2: 2.80, openingP1: 1.48, openingP2: 2.65 },
      { bookmaker: 'Betclic', p1: 1.44, p2: 2.72, openingP1: 1.45, openingP2: 2.70 },
    ],
    firstSetWinner: [
      { bookmaker: 'Fortuna', p1: 1.55, p2: 2.40 },
      { bookmaker: 'STS', p1: 1.52, p2: 2.45 },
    ],
    overUnderGames: [
      { line: '20.5', over: 1.62, under: 2.20, bookmaker: 'Fortuna' },
      { line: '21.5', over: 1.78, under: 1.98, bookmaker: 'STS' },
      { line: '22.5', over: 2.05, under: 1.72, bookmaker: 'Superbet' },
    ],
    primaryOU: { line: '21.5', over: 1.78, under: 1.98, bookmaker: 'STS' },
    handicaps: [],
  },
};

const usOpen = {
  id: 'usopen',
  label: '🏟️ US Open 2024 — Hard',
  tournament: 'US Open',
  surface: 'Hard',
  surfacePL: 'Hard',
  tier: 'Grand Slam',
  player1: 'Daniil Medvedev',
  player2: 'Alexander Zverev',
  matches: [
    { date: '06.09.2024', tournament: 'US Open', surface: 'Hard', winner: 1, score: '6:4, 7:5, 6:3', notes: 'Zverev: Medical Timeout / ból kostki' },
    { date: '29.03.2024', tournament: 'Miami Open', surface: 'Hard', winner: 1, score: '7:5, 6:3', notes: null },
    { date: '13.10.2023', tournament: 'Shanghai Masters', surface: 'Hard', winner: 2, score: '6:7, 6:3, 6:4', notes: null },
    { date: '12.11.2023', tournament: 'ATP Finals', surface: 'Hard', winner: 1, score: '6:2, 6:4', notes: null },
    { date: '19.03.2023', tournament: 'Indian Wells', surface: 'Hard', winner: 1, score: '6:2, 6:2', notes: null },
    { date: '10.06.2023', tournament: 'Roland Garros', surface: 'Clay', winner: 2, score: '6:3, 2:6, 7:5, 7:6', notes: null },
    { date: '05.05.2024', tournament: 'Madrid Open', surface: 'Clay', winner: 2, score: '4:6, 6:4, 6:3', notes: 'Zverev: krecz w 3. secie' },
    { date: '17.01.2024', tournament: 'Australian Open', surface: 'Hard', winner: 1, score: '6:3, 7:6, 6:4', notes: null },
    { date: '22.06.2023', tournament: 'Halle Open', surface: 'Grass', winner: 2, score: '6:3, 6:7, 6:4', notes: 'Medical Timeout' },
    { date: '09.08.2023', tournament: 'Montreal Masters', surface: 'Hard', winner: 1, score: '6:0, 6:3', notes: null },
  ],
  odds: {
    hasOdds: true,
    source: 'Flashscore Live',
    bestP1: { odds: 1.68, bookmaker: 'Fortuna' },
    bestP2: { odds: 2.28, bookmaker: 'Superbet' },
    avgP1: 1.66,
    avgP2: 2.24,
    matchWinner: [
      { bookmaker: 'Fortuna', p1: 1.68, p2: 2.24, openingP1: 1.70, openingP2: 2.20 },
      { bookmaker: 'STS', p1: 1.65, p2: 2.25, openingP1: 1.68, openingP2: 2.18 },
      { bookmaker: 'Superbet', p1: 1.67, p2: 2.28, openingP1: 1.65, openingP2: 2.25 },
      { bookmaker: 'Betclic', p1: 1.64, p2: 2.20, openingP1: 1.65, openingP2: 2.20 },
    ],
    firstSetWinner: [
      { bookmaker: 'Fortuna', p1: 1.72, p2: 2.10 },
      { bookmaker: 'STS', p1: 1.70, p2: 2.12 },
    ],
    overUnderGames: [
      { line: '21.5', over: 1.65, under: 2.18, bookmaker: 'Fortuna' },
      { line: '22.5', over: 1.88, under: 1.92, bookmaker: 'STS' },
      { line: '23.5', over: 2.15, under: 1.68, bookmaker: 'Superbet' },
    ],
    primaryOU: { line: '22.5', over: 1.88, under: 1.92, bookmaker: 'STS' },
    handicaps: [],
  },
};

export const DEMO_PRESETS = [
  addParsedScores(wimbledon),
  addParsedScores(rolandGarros),
  addParsedScores(usOpen),
];
