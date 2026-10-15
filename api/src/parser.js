/**
 * Parses raw Flashscore H2H copy-paste text and URLs into structured match data.
 * Supports single-line, table copy-paste, multiline clipboard, Polish/English surfaces,
 * automatic player order normalization, and tiebreak/set score resolution.
 */

const SURFACE_MAP = {
  'hard': 'Hard',
  'clay': 'Clay',
  'grass': 'Grass',
  'indoor': 'Indoor',
  'carpet': 'Indoor',
  'nawierzchnia twarda': 'Hard',
  'ziemna': 'Clay',
  'mączka': 'Clay',
  'maczka': 'Clay',
  'trawa': 'Grass',
  'hala': 'Indoor',
  'i.': 'Indoor',
  'indoor hard': 'Indoor',
  'wim': 'Grass',
  'rg': 'Clay',
  'fo': 'Clay',
  'ao': 'Hard',
  'uso': 'Hard',
};

export const SURFACE_PL = {
  'Hard': 'Twarda (Hard)',
  'Clay': 'Mączka (Clay)',
  'Grass': 'Trawa (Grass)',
  'Indoor': 'Hala (Indoor)',
};

const TOURNAMENT_ACRONYMS = {
  'wim': { name: 'Wimbledon', surface: 'Grass', tier: 'Grand Slam' },
  'rg': { name: 'Roland Garros', surface: 'Clay', tier: 'Grand Slam' },
  'fo': { name: 'Roland Garros', surface: 'Clay', tier: 'Grand Slam' },
  'ao': { name: 'Australian Open', surface: 'Hard', tier: 'Grand Slam' },
  'uso': { name: 'US Open', surface: 'Hard', tier: 'Grand Slam' },
  'mad': { name: 'Madrid Masters', surface: 'Clay', tier: 'Masters 1000' },
  'rom': { name: 'Rome Masters', surface: 'Clay', tier: 'Masters 1000' },
  'iw': { name: 'Indian Wells', surface: 'Hard', tier: 'Masters 1000' },
  'mia': { name: 'Miami Open', surface: 'Hard', tier: 'Masters 1000' },
  'cin': { name: 'Cincinnati Masters', surface: 'Hard', tier: 'Masters 1000' },
  'sha': { name: 'Shanghai Masters', surface: 'Hard', tier: 'Masters 1000' },
  'par': { name: 'Paris Masters', surface: 'Indoor', tier: 'Masters 1000' },
  'hal': { name: 'Halle Open', surface: 'Grass', tier: 'ATP 500' },
  'lon': { name: "Queen's Club", surface: 'Grass', tier: 'ATP 500' },
  'mon': { name: 'Monte Carlo Masters', surface: 'Clay', tier: 'Masters 1000' },
  'bar': { name: 'Barcelona Open', surface: 'Clay', tier: 'ATP 500' },
  'dub': { name: 'Dubai Championships', surface: 'Hard', tier: 'ATP 500' },
  'rot': { name: 'Rotterdam Open', surface: 'Indoor', tier: 'ATP 500' },
  'vie': { name: 'Vienna Open', surface: 'Indoor', tier: 'ATP 500' },
  'bas': { name: 'Swiss Indoors Basel', surface: 'Indoor', tier: 'ATP 500' },
};

const KNOWN_TOURNAMENTS = [
  'Australian Open', 'Roland Garros', 'French Open', 'Wimbledon', 'US Open',
  'Indian Wells', 'Miami Open', 'Miami', 'Monte Carlo', 'Madrid Masters', 'Madrid',
  'Rome Masters', 'Rome', 'Roma', 'Canada Masters', 'Montreal', 'Toronto',
  'Cincinnati Masters', 'Cincinnati', 'Shanghai Masters', 'Shanghai',
  'Paris Masters', 'Paris', 'Halle Open', 'Halle', "Queen's Club", 'Queens',
  'Barcelona Open', 'Barcelona', 'Hamburg', 'Washington', 'Beijing', 'Tokyo',
  'Vienna', 'Basel', 'Acapulco', 'Dubai', 'Rotterdam',
];

const TIER_KEYWORDS = {
  'Grand Slam': ['wimbledon', 'roland garros', 'us open', 'australian open', 'french open'],
  'Masters 1000': ['indian wells', 'miami', 'monte carlo', 'madrid', 'rome', 'roma', 'canada', 'montreal', 'toronto', 'cincinnati', 'shanghai', 'paris'],
  'ATP 500': ['barcelona', 'hamburg', 'halle', 'queen', 'washington', 'beijing', 'tokyo', 'vienna', 'basel', 'acapulco', 'dubai', 'rotterdam'],
  'ATP 250': [],
};

export function detectTier(tournamentName) {
  if (!tournamentName) return 'ATP 250';
  const lower = tournamentName.toLowerCase();
  for (const [tier, keywords] of Object.entries(TIER_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return tier;
  }
  return 'ATP 250';
}

export function normalizeSurface(raw) {
  if (!raw) return 'Hard';
  const lower = raw.toLowerCase().trim();
  return SURFACE_MAP[lower] || 'Hard';
}

export function cleanPlayerName(raw) {
  if (!raw) return '';
  return raw
    .replace(/\([A-Za-z0-9\s]+\)/g, '') // remove country tags e.g. (Esp), (Srb)
    .replace(/\[\d+\]/g, '')             // remove seed tags e.g. [1], [3]
    .replace(/[-–—]\s*$/, '')            // trailing hyphens
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/\([a-z0-9\s]+\)/gi, '')
    .replace(/\[\d+\]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fuzzy/stem match to test if two player name representations refer to the same player.
 * Supports: "Alcaraz C." matching "Carlos Alcaraz", "Djokovic N." matching "Novak Djokovic".
 */
export function matchPlayer(nameA, nameB) {
  const nA = normalizeName(nameA);
  const nB = normalizeName(nameB);
  if (!nA || !nB) return false;
  if (nA === nB) return true;
  if (nA.includes(nB) || nB.includes(nA)) return true;

  const wordsA = nA.split(' ').filter(w => w.length >= 3);
  const wordsB = nB.split(' ').filter(w => w.length >= 3);

  return wordsA.some(wA =>
    wordsB.some(wB =>
      wA === wB ||
      (wA.length >= 4 && wB.startsWith(wA)) ||
      (wB.length >= 4 && wA.startsWith(wB))
    )
  );
}

/**
 * Invert a tennis score string (swap g1 and g2 for each set / overall score).
 * e.g. "6:3, 5:7, 6:1" -> "3:6, 7:5, 1:6"
 * e.g. "3 : 0 (6:2, 6:2, 7:6)" -> "0 : 3 (2:6, 2:6, 6:7)"
 */
export function invertScoreStr(scoreStr) {
  if (!scoreStr) return '';
  return scoreStr.replace(/(\d+)\s*([:\-])\s*(\d+)/g, (match, g1, sep, g2) => `${g2}${sep}${g1}`);
}

/**
 * Parse raw score into structured set array and total games count.
 * Accurately filters out tiebreak points e.g. 7:6(4) and overall match set score e.g. 2:0 (6:4, 7:5).
 */
export function parseScore(scoreStr) {
  if (!scoreStr) return { sets: [], totalGames: 22 };

  // Remove tiebreak scores attached to sets e.g. 7:6(4) or 7:6(7-4)
  const cleanScore = scoreStr
    .replace(/(?<=\d[:\-]\d)\s*\(\s*\d+(?:[\-:]\d+)?\s*\)/g, '')
    .trim();

  // Extract all digit pairs like 6:4, 7-5, 2:0
  const pairRegex = /(\d+)\s*[:\-]\s*(\d+)/g;
  const pairs = [];
  let m;
  while ((m = pairRegex.exec(cleanScore)) !== null) {
    pairs.push({ g1: parseInt(m[1]), g2: parseInt(m[2]) });
  }

  if (pairs.length === 0) {
    return { sets: [], totalGames: 22 };
  }

  let sets = [];
  // Case A: First pair is an overall set score (e.g. 2:0 or 3:1) followed by actual game sets
  if (
    pairs.length > 1 &&
    pairs[0].g1 <= 3 &&
    pairs[0].g2 <= 3 &&
    pairs.slice(1).some(p => p.g1 >= 4 || p.g2 >= 4)
  ) {
    sets = pairs.slice(1);
  }
  // Case B: ONLY an overall set score was copied (e.g. 2:0, 2:1, 3:0, 3:1)
  else if (pairs.length === 1 && pairs[0].g1 <= 3 && pairs[0].g2 <= 3) {
    const s1 = pairs[0].g1;
    const s2 = pairs[0].g2;
    if (s1 === 2 && s2 === 0) return { sets: [{ g1: 6, g2: 4 }, { g1: 6, g2: 4 }], totalGames: 20 };
    if (s1 === 0 && s2 === 2) return { sets: [{ g1: 4, g2: 6 }, { g1: 4, g2: 6 }], totalGames: 20 };
    if (s1 === 2 && s2 === 1) return { sets: [{ g1: 6, g2: 4 }, { g1: 4, g2: 6 }, { g1: 6, g2: 4 }], totalGames: 30 };
    if (s1 === 1 && s2 === 2) return { sets: [{ g1: 4, g2: 6 }, { g1: 6, g2: 4 }, { g1: 4, g2: 6 }], totalGames: 30 };
    if (s1 === 3 && s2 === 0) return { sets: [{ g1: 6, g2: 4 }, { g1: 6, g2: 4 }, { g1: 6, g2: 4 }], totalGames: 28 };
    if (s1 === 0 && s2 === 3) return { sets: [{ g1: 4, g2: 6 }, { g1: 4, g2: 6 }, { g1: 4, g2: 6 }], totalGames: 28 };
    if (s1 === 3 && s2 === 1) return { sets: [{ g1: 6, g2: 4 }, { g1: 4, g2: 6 }, { g1: 7, g2: 5 }, { g1: 6, g2: 3 }], totalGames: 38 };
    if (s1 === 1 && s2 === 3) return { sets: [{ g1: 4, g2: 6 }, { g1: 6, g2: 4 }, { g1: 5, g2: 7 }, { g1: 3, g2: 6 }], totalGames: 38 };
    if (s1 === 3 && s2 === 2) return { sets: [{ g1: 6, g2: 4 }, { g1: 4, g2: 6 }, { g1: 7, g2: 5 }, { g1: 3, g2: 6 }, { g1: 6, g2: 4 }], totalGames: 48 };
    if (s1 === 2 && s2 === 3) return { sets: [{ g1: 4, g2: 6 }, { g1: 6, g2: 4 }, { g1: 5, g2: 7 }, { g1: 6, g2: 3 }, { g1: 4, g2: 6 }], totalGames: 48 };
    return { sets: [{ g1: 6, g2: 4 }, { g1: 4, g2: 6 }, { g1: 6, g2: 4 }], totalGames: 30 };
  } else {
    sets = pairs;
  }

  let totalGames = 0;
  for (const s of sets) {
    totalGames += s.g1 + s.g2;
  }

  if (totalGames < 12 && sets.length > 0) {
    totalGames = 21;
  }

  return { sets, totalGames: totalGames || 22 };
}

/**
 * Determine winner of a match line (1 = player on the left, 2 = player on the right).
 */
export function determineWinner(p1, p2, scoreStr, rawLine) {
  if (rawLine) {
    if (/\b(W|Z)\b/i.test(rawLine)) return 1;
    if (/\b(L|P)\b/i.test(rawLine)) return 2;
  }

  // Check overall match set score at start (e.g. 2:0, 0:2, 3:1)
  const cleanScore = (scoreStr || '')
    .replace(/(?<=\d[:\-]\d)\s*\(\s*\d+(?:[\-:]\d+)?\s*\)/g, '')
    .trim();
  const overallMatch = cleanScore.match(/^([0-3])\s*[:\-]\s*([0-3])/);
  if (overallMatch) {
    const s1 = parseInt(overallMatch[1]);
    const s2 = parseInt(overallMatch[2]);
    if (s1 > s2) return 1;
    if (s2 > s1) return 2;
  }

  const { sets } = parseScore(scoreStr);
  if (sets.length === 0) return 1;
  let p1Sets = 0, p2Sets = 0;
  for (const s of sets) {
    if (s.g1 > s.g2) p1Sets++;
    else if (s.g2 > s.g1) p2Sets++;
  }
  return p1Sets >= p2Sets ? 1 : 2;
}

/**
 * Extract two player names from a string segment.
 */
function extractPlayers(str) {
  const s = str.trim();

  // Case A: Separated by hyphen or vs
  const sepMatch = s.match(/\s+(?:[-–—]|vs\.?)\s+/i);
  if (sepMatch) {
    return [
      s.substring(0, sepMatch.index).trim(),
      s.substring(sepMatch.index + sepMatch[0].length).trim(),
    ];
  }

  // Case B: Separated by 2 or more spaces or tab
  const multiSpace = s.split(/\s{2,}|\t/);
  if (multiSpace.length === 2) {
    return [multiSpace[0].trim(), multiSpace[1].trim()];
  }

  // Case C: Country tags attached e.g. "Alcaraz C. (Esp) Djokovic N. (Srb)"
  const ccMatch = s.match(/^(.+?\([A-Za-z0-9\s]+\))\s+(.+)$/);
  if (ccMatch) {
    return [ccMatch[1].trim(), ccMatch[2].trim()];
  }

  // Case D: Standard Flashscore "Surname Initial. Surname Initial." e.g. "Alcaraz C. Djokovic N."
  const initMatch = s.match(/^([A-Z][a-zA-Z'\-]+\s+[A-Z]\.?)\s+([A-Z][a-zA-Z'\-]+\s+[A-Z]\.?)$/);
  if (initMatch) {
    return [initMatch[1].trim(), initMatch[2].trim()];
  }

  // Fallback: split words roughly in half
  const words = s.split(/\s+/);
  if (words.length >= 2) {
    const half = Math.floor(words.length / 2);
    return [words.slice(0, half).join(' '), words.slice(half).join(' ')];
  }

  return [s, ''];
}

/**
 * Pre-processes text: groups multiline Flashscore clipboard table cells into single match lines.
 */
export function preprocessText(rawText) {
  if (!rawText) return [];
  const text = rawText.replace(/\t/g, '  ');
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const isDateOnly = (line) =>
    /^(\d{2}[\.\/\-]\d{2}(?:[\.\/\-]\d{2,4})?|\d{2}\.\d{2}\.)$/.test(line);

  const hasStandaloneDates = rawLines.some(isDateOnly);
  if (!hasStandaloneDates) {
    return rawLines;
  }

  const groupedLines = [];
  let currentBlock = [];

  for (const line of rawLines) {
    if (isDateOnly(line)) {
      if (currentBlock.length > 0) {
        groupedLines.push(currentBlock.join('  '));
      }
      currentBlock = [line];
    } else if (currentBlock.length > 0) {
      currentBlock.push(line);
    } else {
      groupedLines.push(line);
    }
  }

  if (currentBlock.length > 0) {
    groupedLines.push(currentBlock.join('  '));
  }

  return groupedLines;
}

/**
 * Parses a single line representing one match.
 */
function parseMatchLine(line, defaultP1 = '', defaultP2 = '') {
  let rest = line.trim();

  // 1. Trailing notes: W, L, Z, P, ret., krecz, retired
  let notes = null;
  const noteMatch = rest.match(/\s+([WLZP]|ret\.?|krecz|retired)\s*$/i);
  if (noteMatch) {
    notes = noteMatch[1].toUpperCase();
    rest = rest.substring(0, noteMatch.index).trim();
  }

  // 1b. Leading notes: W, L, Z, P (common in Polish/European Flashscore copy-paste)
  const leadingNoteMatch = rest.match(/^([WLZP])\s{1,}(.+)$/i);
  if (leadingNoteMatch) {
    if (!notes) notes = leadingNoteMatch[1].toUpperCase();
    rest = leadingNoteMatch[2].trim();
  }

  // 2. Date at beginning
  let date = '';
  const dateMatch = rest.match(/^(\d{2}[\.\/\-]\d{2}[\.\/\-]\d{2,4}|\d{2}\.\d{2}\.)\s+/);
  if (dateMatch) {
    date = dateMatch[1];
    rest = rest.substring(dateMatch[0].length).trim();
  }

  // 3. Score at end
  const scoreMatch = rest.match(
    /(\b[0-3]\s*[:\-]\s*[0-3]\s*(?:\([0-9:,\s\-()]+\)|[0-9:,\s\-()]+)?|\d+[:\-]\d+(?:[,\s]+\d+[:\-]\d+)*)\s*$/
  );
  let score = '';
  if (scoreMatch) {
    score = scoreMatch[0].trim();
    rest = rest.substring(0, scoreMatch.index).trim();
  } else {
    return null;
  }

  // 4. Surface detection in remaining middle
  let surface = 'Hard';
  for (const [key, val] of Object.entries(SURFACE_MAP)) {
    const sRegex = new RegExp(`\\b${key}\\b`, 'i');
    if (sRegex.test(rest)) {
      surface = val;
      rest = rest.replace(sRegex, ' ').replace(/\s+/g, ' ').trim();
      break;
    }
  }

  // 5. Tournament detection in remaining middle
  let tournament = '';
  // Check if first word is a known tournament acronym (e.g. WIM, RG, AO, USO)
  const firstWord = rest.split(/\s+/)[0].toLowerCase();
  if (TOURNAMENT_ACRONYMS[firstWord]) {
    const tInfo = TOURNAMENT_ACRONYMS[firstWord];
    tournament = tInfo.name;
    surface = tInfo.surface;
    rest = rest.substring(firstWord.length).trim();
  } else {
    // Check known tournament full names (e.g. Wimbledon, Roland Garros)
    for (const t of KNOWN_TOURNAMENTS) {
      const tRegex = new RegExp('^' + t + '\\b', 'i');
      if (tRegex.test(rest)) {
        tournament = t;
        rest = rest.replace(tRegex, '').trim();
        break;
      }
    }
    // If not matched, check if rest has tournament acronym / code followed by 2+ spaces
    if (!tournament) {
      const tournMatch = rest.match(/^([A-Za-z0-9\.\-'\s]+?)\s{2,}(.+)$/);
      if (
        tournMatch &&
        tournMatch[1].length <= 25 &&
        (TOURNAMENT_ACRONYMS[tournMatch[1].trim().toLowerCase()] || tournMatch[1].length <= 5)
      ) {
        const code = tournMatch[1].trim();
        tournament = TOURNAMENT_ACRONYMS[code.toLowerCase()]?.name || code;
        rest = tournMatch[2].trim();
      }
    }
  }

  // 6. Players extraction
  let p1 = '';
  let p2 = '';
  if (rest) {
    const players = extractPlayers(rest);
    p1 = cleanPlayerName(players[0]);
    p2 = cleanPlayerName(players[1]);

    // If p1 contains a leading tournament/city name (e.g. "Cleveland Krueger A." or "Cincinnati Świątek I.")
    const tournPrefixMatch = p1.match(/^(.+?)\s+([A-Z][a-zA-Z'\-]+\s+[A-Z]\.?)$/);
    if (tournPrefixMatch) {
      if (!tournament || tournament === 'Wcześniejszy pojedynek') {
        tournament = tournPrefixMatch[1].trim();
      }
      p1 = tournPrefixMatch[2].trim();
    }
  }

  // Fallback to default players (e.g. from header matchup)
  if (!p1 && defaultP1) p1 = defaultP1;
  if (!p2 && defaultP2) p2 = defaultP2;
  if (!p1 && !p2 && (defaultP1 || defaultP2)) {
    p1 = defaultP1 || 'Zawodnik 1';
    p2 = defaultP2 || 'Zawodnik 2';
  } else if (!p1 && !p2 && (notes || score)) {
    p1 = 'Zawodnik 1';
    p2 = 'Zawodnik 2';
  }

  if (!p1 || !p2) return null;

  if (!tournament) {
    tournament = 'Wcześniejszy pojedynek';
  }

  const parsedScore = parseScore(score);
  const rawWinner = (notes === 'W' || notes === 'Z')
    ? 1
    : (notes === 'L' || notes === 'P')
      ? 2
      : determineWinner(p1, p2, score, line);

  return {
    date,
    tournament,
    surface: normalizeSurface(surface),
    surfacePL: SURFACE_PL[normalizeSurface(surface)] || surface,
    tier: detectTier(tournament),
    player1: p1,
    player2: p2,
    score,
    parsedScore,
    rawWinner,
    notes,
  };
}

/**
 * Check if the input is a URL (e.g. Flashscore match link).
 */
export function checkUrlInput(text) {
  if (!text) return null;
  let trimmed = text.trim();

  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    if (trimmed.includes('flashscore.') || trimmed.includes('/mecz/') || trimmed.includes('/match/')) {
      trimmed = 'https://' + trimmed.replace(/^\/+/, '');
    }
  }

  const urlMatch = trimmed.match(/https?:\/\/[^\s]+/i);
  if (!urlMatch) return null;

  const url = urlMatch[0];
  const urlWithoutHash = url.split('#')[0].split('?')[0];
  let p1 = null;
  let p2 = null;

  const slugMatch = urlWithoutHash.match(/(?:mecz|match)\/(?:tenis\/)?([a-z0-9-]+)/i);
  if (slugMatch) {
    const slug = slugMatch[1].toLowerCase();
    const ignoredSlugs = ['tenis', 'tennis', 'h2h', 'szczegoly-meczu', 'kursy', 'drabinka', 'tabela'];
    if (!ignoredSlugs.includes(slug)) {
      const parts = slug.split('-').filter(p => p.length > 1 && !/^[0-9a-f]{8}$/i.test(p));
      if (parts.length >= 4) {
        p1 = `${capitalize(parts[1])} ${capitalize(parts[0])}`;
        p2 = `${capitalize(parts[3])} ${capitalize(parts[2])}`;
      } else if (parts.length >= 2) {
        p1 = capitalize(parts[0]);
        p2 = capitalize(parts[1]);
      }
    }
  }

  const eventIdMatch =
    urlWithoutHash.match(/(?:mecz|match)\/(?:[^\/]+\/)?([a-zA-Z0-9]{8})(?:[/?#]|$)/i) ||
    urlWithoutHash.match(/\/([a-zA-Z0-9]{8})\/?$/i) ||
    url.match(/MID":"([a-zA-Z0-9]{8})/);
  const eventId = eventIdMatch ? eventIdMatch[1] : null;

  return {
    isUrl: true,
    url,
    eventId,
    player1: p1,
    player2: p2,
  };
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Main parser function supporting multiple Flashscore export variants.
 * Guarantees player orientation normalization across all matches.
 */
export function parseH2HText(rawText) {
  if (!rawText || !rawText.trim()) {
    return { player1: '', player2: '', matches: [], errors: ['Brak tekstu do analizy'] };
  }

  const lines = preprocessText(rawText);
  const rawMatches = [];
  const errors = [];
  let headerP1 = '';
  let headerP2 = '';
  let currentSection = 'UNKNOWN'; // 'H2H' | 'FORM_P1' | 'FORM_P2' | 'UNKNOWN'
  const sectionedLines = [];

  // 1. First pass: look for section headers and matchup headers
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for direct H2H section header
    if (/(?:mecze\s+bezpo[sś]rednie|bezpo[sś]rednie\s+(?:pojedynki|starcia|mecze)|head-to-head|h2h|direct\s+matches)/i.test(trimmed)) {
      currentSection = 'H2H';
      continue;
    }

    // Check for player form section header: "Ostatnie mecze: Nazwisko" / "Last matches: Name"
    const formMatch = trimmed.match(/(?:ostatnie\s+mecze|last\s+matches)\s*:\s*(.+)/i);
    if (formMatch) {
      const pName = cleanPlayerName(formMatch[1]);
      if (!headerP1) {
        headerP1 = pName;
        currentSection = 'FORM_P1';
      } else if (!headerP2 && !matchPlayer(pName, headerP1)) {
        headerP2 = pName;
        currentSection = 'FORM_P2';
      } else if (headerP1 && matchPlayer(pName, headerP1)) {
        currentSection = 'FORM_P1';
      } else if (headerP2 && matchPlayer(pName, headerP2)) {
        currentSection = 'FORM_P2';
      } else {
        currentSection = 'FORM_OTHER';
      }
      continue;
    }

    // Check for explicit matchup header (e.g. "Swiatek I. - Krueger A.") without scores
    if (!/\d/.test(trimmed)) {
      const headerParts = trimmed.split(/\s+(?:[-–—]|vs\.?)\s+/i);
      if (headerParts.length === 2 && headerParts[0].length >= 3 && headerParts[1].length >= 3) {
        if (!headerP1) headerP1 = cleanPlayerName(headerParts[0]);
        if (!headerP2) headerP2 = cleanPlayerName(headerParts[1]);
        continue;
      }
    }

    sectionedLines.push({ line: trimmed, section: currentSection });
  }

  // 2. Parse match rows with section context
  for (const item of sectionedLines) {
    const trimmed = item.line;
    if (!/\d/.test(trimmed)) continue; // Skip header-only lines

    const row = parseMatchLine(trimmed, headerP1, headerP2);
    if (row && row.player1 && row.player2 && row.score) {
      row.section = item.section;
      rawMatches.push(row);
    } else if (trimmed.length > 5 && !trimmed.startsWith('http')) {
      errors.push(`Nie rozpoznano linii: "${trimmed.substring(0, 50)}..."`);
    }
  }

  if (rawMatches.length === 0) {
    return { player1: headerP1, player2: headerP2, matches: [], h2hMatches: [], formMatches: [], errors };
  }

  // 3. Establish mainPlayer1 and mainPlayer2
  let mainPlayer1 = headerP1;
  let mainPlayer2 = headerP2;

  // If not found from headers, inspect matches to find the most common matchup pairing
  if (!mainPlayer1 || !mainPlayer2) {
    const h2hCandidate = rawMatches.find(m => m.section === 'H2H') || rawMatches[0];
    if (h2hCandidate) {
      if (!mainPlayer1) mainPlayer1 = h2hCandidate.player1;
      if (!mainPlayer2) mainPlayer2 = h2hCandidate.player2;
    }
  }

  // Upgrade abbreviated names (e.g. "Alcaraz C." -> "Carlos Alcaraz") if clean full name appears in matches
  const isAbbrev = (name) => !name || name.includes('.') || name.split(' ').length < 2 || name.split(' ').some(w => w.length === 1);

  if (isAbbrev(mainPlayer1)) {
    for (const m of rawMatches) {
      if (matchPlayer(m.player1, mainPlayer1) && !isAbbrev(m.player1) && m.player1.split(' ').length === 2) {
        mainPlayer1 = m.player1;
        break;
      } else if (matchPlayer(m.player2, mainPlayer1) && !isAbbrev(m.player2) && m.player2.split(' ').length === 2) {
        mainPlayer1 = m.player2;
        break;
      }
    }
  }

  if (isAbbrev(mainPlayer2)) {
    for (const m of rawMatches) {
      if (matchPlayer(m.player1, mainPlayer2) && !isAbbrev(m.player1) && m.player1.split(' ').length === 2) {
        mainPlayer2 = m.player1;
        break;
      } else if (matchPlayer(m.player2, mainPlayer2) && !isAbbrev(m.player2) && m.player2.split(' ').length === 2) {
        mainPlayer2 = m.player2;
        break;
      }
    }
  }

  // 4. Strict H2H vs Form separation:
  // A match is Direct H2H IF AND ONLY IF both contestants match mainPlayer1 & mainPlayer2,
  // or it was explicitly in the direct H2H section.
  const normalizedMatches = rawMatches.map(m => {
    const isP1Direct = matchPlayer(m.player1, mainPlayer1);
    const isP2Direct = matchPlayer(m.player2, mainPlayer2);
    const isP1Inverted = matchPlayer(m.player1, mainPlayer2);
    const isP2Inverted = matchPlayer(m.player2, mainPlayer1);

    const isBothContestants = (isP1Direct && isP2Direct) || (isP1Inverted && isP2Inverted);
    const isUnderH2HSection = m.section === 'H2H';
    // Strictly require that both players are the contestants (or under explicit H2H section)
    const isDirectH2H = isBothContestants || (isUnderH2HSection && m.section !== 'FORM_P1' && m.section !== 'FORM_P2');

    if (isDirectH2H) {
      const isInverted = (isP1Inverted || isP2Inverted) && !(isP1Direct && isP2Direct);
      const rowWinner = m.rawWinner;
      const normWinner = isInverted ? (rowWinner === 1 ? 2 : 1) : rowWinner;
      const normScore = isInverted ? invertScoreStr(m.score) : m.score;

      const origParsed = m.parsedScore || parseScore(m.score);
      const normParsed = isInverted
        ? {
            sets: origParsed.sets.map(s => ({ g1: s.g2, g2: s.g1 })),
            totalGames: origParsed.totalGames,
          }
        : origParsed;

      return {
        date: m.date,
        tournament: m.tournament,
        surface: m.surface,
        surfacePL: m.surfacePL,
        tier: m.tier,
        player1: mainPlayer1,
        player2: mainPlayer2,
        score: normScore,
        parsedScore: normParsed,
        winner: normWinner,
        notes: m.notes,
        isDirectH2H: true,
      };
    } else {
      // General form match against another opponent: DO NOT count as H2H!
      const isForP1 = isP1Direct || isP2Inverted || m.section === 'FORM_P1';
      const isForP2 = isP1Inverted || isP2Direct || m.section === 'FORM_P2';
      const targetPlayerIndex = isForP1 ? 1 : (isForP2 ? 2 : 1);
      const mainName = targetPlayerIndex === 1 ? mainPlayer1 : mainPlayer2;
      const opponentName = matchPlayer(m.player1, mainName) ? m.player2 : m.player1;

      const mainIsLeft = matchPlayer(m.player1, mainName);
      const wonByMain = (mainIsLeft && m.rawWinner === 1) || (!mainIsLeft && m.rawWinner === 2);

      const normScore = mainIsLeft ? m.score : invertScoreStr(m.score);
      const origParsed = m.parsedScore || parseScore(m.score);
      const normParsed = mainIsLeft
        ? origParsed
        : {
            sets: origParsed.sets.map(s => ({ g1: s.g2, g2: s.g1 })),
            totalGames: origParsed.totalGames,
          };

      return {
        date: m.date,
        tournament: m.tournament,
        surface: m.surface,
        surfacePL: m.surfacePL,
        tier: m.tier,
        player1: mainName,
        player2: opponentName || `Rywal (${targetPlayerIndex === 1 ? mainPlayer1 : mainPlayer2})`,
        score: normScore,
        parsedScore: normParsed,
        winner: wonByMain ? targetPlayerIndex : (targetPlayerIndex === 1 ? 2 : 1),
        notes: m.notes,
        isDirectH2H: false,
        forPlayer: targetPlayerIndex,
        wonByPlayer: wonByMain,
      };
    }
  });

  const h2hOnly = normalizedMatches.filter(m => m.isDirectH2H);

  return {
    player1: mainPlayer1,
    player2: mainPlayer2,
    matches: normalizedMatches,
    h2hMatches: h2hOnly,
    formMatches: normalizedMatches,
    errors,
  };
}
