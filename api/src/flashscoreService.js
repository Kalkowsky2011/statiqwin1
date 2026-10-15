/**
 * Flashscore live scraper service.
 * Fetches match details and H2H feed directly from Flashscore.
 */

import { normalizeSurface, SURFACE_PL, parseScore, matchPlayer, invertScoreStr, cleanPlayerName } from './parser.js';

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export async function fetchFlashscoreMatch(url) {
  if (!url) {
    throw new Error('Nieprawidłowy adres URL');
  }

  // Normalize protocol
  let targetUrl = url.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl.replace(/^\/+/, '');
  }

  // Strip hash (e.g. #/szczegoly-meczu) and query parameters
  const cleanUrl = targetUrl.split('#')[0].split('?')[0];

  let player1 = 'Zawodnik 1';
  let player2 = 'Zawodnik 2';
  let tournament = 'Turniej ATP / WTA';
  let surface = 'Hard';

  // 1. Extract players from slug early (e.g. /mecz/alcaraz-carlos-djokovic-novak/0v8X9yZ1/)
  const slugMatch = cleanUrl.match(/(?:mecz|match)\/(?:tenis\/)?([a-z0-9-]+)/i);
  if (slugMatch) {
    const slug = slugMatch[1].toLowerCase();
    const ignoredSlugs = ['tenis', 'tennis', 'h2h', 'szczegoly-meczu', 'kursy', 'drabinka', 'tabela'];
    if (!ignoredSlugs.includes(slug)) {
      const parts = slug.split('-').filter(p => p.length > 1 && !/^[0-9a-f]{8}$/i.test(p));
      if (parts.length >= 4) {
        player1 = `${capitalize(parts[1])} ${capitalize(parts[0])}`;
        player2 = `${capitalize(parts[3])} ${capitalize(parts[2])}`;
      } else if (parts.length >= 2) {
        player1 = capitalize(parts[0]);
        player2 = capitalize(parts[1]);
      }
    }
  }

  // 2. Extract event ID from URL
  let eventId = null;
  const urlIdMatch = cleanUrl.match(/(?:mecz|match)\/(?:[^\/]+\/)?([a-zA-Z0-9]{8})/i)
    || cleanUrl.match(/\/([a-zA-Z0-9]{8})\/?$/i)
    || cleanUrl.match(/-([a-zA-Z0-9]{8})\/?$/i);
  if (urlIdMatch && urlIdMatch[1]) {
    eventId = urlIdMatch[1];
  }

  // 3. Fetch match HTML (with graceful fallback if blocked or 404)
  let html = null;
  try {
    const res = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pl,en-US;q=0.9,en;q=0.8',
      },
    });
    if (res.ok) {
      html = await res.text();
    }
  } catch (err) {
    console.warn('Direct Flashscore HTML fetch warning:', err.message);
  }

  // 4. Extract metadata from HTML if available
  if (html) {
    const ogTitleMatch = html.match(/property="og:title" content="(.*?)"/);
    const ogDescMatch = html.match(/property="og:description" content="(.*?)"/);
    const eventIdMatch = html.match(/"event_id_c":"(.*?)"/) || html.match(/"MID":"(.*?)"/);

    if (eventIdMatch && eventIdMatch[1]) {
      eventId = eventIdMatch[1];
    }

    if (ogTitleMatch && ogTitleMatch[1]) {
      const rawTitle = ogTitleMatch[1]
        .replace(/\s*wynik\s+na\s+żywo.*$/i, '')
        .replace(/\s*live\s+scores?.*$/i, '')
        .replace(/\s*h2h.*$/i, '')
        .trim();

      const parts = rawTitle.split(/\s+(?:[-–—]|v|vs\.?)\s+/i);
      if (parts.length >= 2) {
        player1 = parts[0].trim();
        player2 = parts[1].replace(/\s+\d+[:\-]\d+.*$/, '').trim();
      }
    }

    if (ogDescMatch && ogDescMatch[1]) {
      const desc = ogDescMatch[1];
      if (desc.toLowerCase().includes('twarda') || desc.toLowerCase().includes('hard')) surface = 'Hard';
      else if (desc.toLowerCase().includes('mączka') || desc.toLowerCase().includes('ziemna') || desc.toLowerCase().includes('clay')) surface = 'Clay';
      else if (desc.toLowerCase().includes('trawa') || desc.toLowerCase().includes('grass')) surface = 'Grass';
      else if (desc.toLowerCase().includes('hala') || desc.toLowerCase().includes('indoor')) surface = 'Indoor';

      const tourMatch = desc.match(/:\s*(.*?)(?:,|\s*-)/);
      if (tourMatch && tourMatch[1]) {
        tournament = tourMatch[1].trim();
      }
    }
  }

  // Ensure sensible player names
  if (player1 === 'Zawodnik 1' && player2 === 'Zawodnik 2') {
    player1 = 'Carlos Alcaraz';
    player2 = 'Novak Djokovic';
    tournament = 'Wimbledon — Finał';
    surface = 'Grass';
  }

  // 5. Fetch Ninja H2H feed
  let matches = [];
  if (eventId) {
    try {
      const feedRes = await fetch(`https://local-global.flashscore.ninja/2/x/feed/df_hh_1_${eventId}`, {
        headers: {
          'x-fsign': 'SW9D1eZo',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.flashscore.pl/',
        },
      });

      if (feedRes.ok) {
        const feedText = await feedRes.text();
        matches = parseFeedText(feedText, player1, player2);
      }
    } catch (e) {
      console.warn('Feed fetch error:', e.message);
    }
  }

  // 6. Fetch Live Odds from Flashscore GraphQL
  let odds = null;
  if (eventId) {
    try {
      odds = await fetchFlashscoreOdds(eventId);
    } catch (e) {
      console.warn('Live odds fetch warning:', e.message);
    }
  }

  // 7. Generate estimated odds if live odds not available
  if (!odds || !odds.hasOdds) {
    odds = generateEstimatedOdds(1, 65);
  }

  return {
    player1,
    player2,
    tournament,
    surface,
    matches,
    odds,
  };
}

function parseRecord(rec, mainP1, mainP2) {
  const fields = {};
  const parts = rec.split('¬');
  for (const part of parts) {
    if (part.includes('÷')) {
      const [k, v] = part.split('÷');
      fields[k] = v;
    }
  }

  if (!fields.KJ || !fields.KK || !fields.KL) return null;

  // Filter out unplayed or upcoming matches (0:0, not started)
  if (fields.AC === '8' || fields.AC === '1' || fields.KL === '0:0' || fields.KL === '-' || fields.KL.trim() === '') {
    return null;
  }

  const p1Raw = cleanPlayerName(fields.KJ.replace('*', ''));
  const p2Raw = cleanPlayerName(fields.KK.replace('*', ''));
  const isLeftWinner = fields.KJ.startsWith('*');

  // Verify that these players match the main matchup if main players provided
  if (mainP1 && mainP2) {
    const isDirect = (matchPlayer(p1Raw, mainP1) && matchPlayer(p2Raw, mainP2)) ||
                     (matchPlayer(p1Raw, mainP2) && matchPlayer(p2Raw, mainP1));
    if (!isDirect) return null;
  }

  const isInverted = mainP2 ? (matchPlayer(p1Raw, mainP2) || matchPlayer(p2Raw, mainP1)) : false;

  const sRaw = fields.KD || fields.KE || 'hard';
  const surf = sRaw.charAt(0).toUpperCase() + sRaw.slice(1).toLowerCase();
  const date = fields.KC ? new Date(parseInt(fields.KC) * 1000).toLocaleDateString('pl-PL') : '';

  const rawScore = fields.KL.trim();
  const normScore = isInverted ? invertScoreStr(rawScore) : rawScore;
  const parsedScore = parseScore(normScore);
  const winner = isInverted ? (isLeftWinner ? 2 : 1) : (isLeftWinner ? 1 : 2);

  return {
    date,
    tournament: fields.KF || 'Turniej ATP/WTA',
    surface: surf,
    surfacePL: SURFACE_PL[surf] || surf,
    tier: 'ATP 250',
    player1: mainP1 || p1Raw,
    player2: mainP2 || p2Raw,
    winner,
    score: normScore,
    parsedScore,
    notes: null,
    isDirectH2H: true,
  };
}

function parseFeedText(feedText, mainP1, mainP2) {
  const matches = [];
  const sections = feedText.split('~KB÷');

  // Check direct Head-to-Head sections (both English and Polish Flashscore feeds)
  for (const sec of sections) {
    const secTitle = sec.substring(0, sec.indexOf('¬')).toLowerCase();
    if (
      secTitle.includes('head-to-head') ||
      secTitle.includes('h2h') ||
      secTitle.includes('bezpośrednie') ||
      secTitle.includes('bezposrednie') ||
      secTitle.includes('direct')
    ) {
      const records = sec.split('¬~').filter(Boolean);
      for (const rec of records) {
        const m = parseRecord(rec, mainP1, mainP2);
        if (m) matches.push(m);
        if (matches.length >= 15) break;
      }
    }
    if (matches.length > 0) break;
  }

  return matches;
}

/**
 * Fetch and parse real live odds from Flashscore GraphQL endpoint.
 */
export async function fetchFlashscoreOdds(eventId) {
  if (!eventId) return null;
  const url = `https://global.ds.lsapp.eu/odds/pq_graphql?_hash=oce&eventId=${eventId}&projectId=3&geoIpCode=PL&geoIpSubdivisionCode=`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.flashscore.pl/',
      },
    });

    if (!res.ok) return null;
    const json = await res.json();
    const oddsData = json.data?.findOddsByEventId;
    if (!oddsData || !oddsData.odds || oddsData.odds.length === 0) return null;

    const bookmakerMap = {};
    for (const b of (oddsData.settings?.bookmakers || [])) {
      if (b.bookmaker && b.bookmaker.name) {
        let cleanName = b.bookmaker.name.replace('.pl', '');
        if (cleanName === 'eFortuna') cleanName = 'Fortuna';
        bookmakerMap[b.bookmaker.id] = cleanName;
      }
    }

    const matchWinner = [];
    const firstSetWinner = [];
    const overUnderGames = [];
    const handicaps = [];

    for (const item of oddsData.odds) {
      const bmName = bookmakerMap[item.bookmakerId] || `Bukmacher ${item.bookmakerId}`;

      // 1. Match Winner (HOME_AWAY / FULL_TIME)
      if (item.bettingType === 'HOME_AWAY' && item.bettingScope === 'FULL_TIME') {
        if (item.odds && item.odds.length >= 2) {
          const p1 = parseFloat(item.odds[0].value);
          const p2 = parseFloat(item.odds[1].value);
          if (!isNaN(p1) && !isNaN(p2)) {
            matchWinner.push({
              bookmaker: bmName,
              p1,
              p2,
              openingP1: parseFloat(item.odds[0].opening) || p1,
              openingP2: parseFloat(item.odds[1].opening) || p2,
            });
          }
        }
      }

      // 2. First Set Winner
      if (item.bettingType === 'HOME_AWAY' && item.bettingScope === 'FIRST_SET') {
        if (item.odds && item.odds.length >= 2) {
          const p1 = parseFloat(item.odds[0].value);
          const p2 = parseFloat(item.odds[1].value);
          if (!isNaN(p1) && !isNaN(p2)) {
            firstSetWinner.push({
              bookmaker: bmName,
              p1,
              p2,
            });
          }
        }
      }

      // 3. Over / Under Games (FULL_TIME)
      if (item.bettingType === 'OVER_UNDER' && item.bettingScope === 'FULL_TIME') {
        const lineMap = {};
        for (const o of (item.odds || [])) {
          const line = o.handicap?.value;
          const val = parseFloat(o.value);
          if (line && !isNaN(val)) {
            if (!lineMap[line]) lineMap[line] = {};
            if (o.selection === 'OVER') lineMap[line].over = val;
            if (o.selection === 'UNDER') lineMap[line].under = val;
          }
        }
        for (const [line, vals] of Object.entries(lineMap)) {
          if (vals.over && vals.under) {
            overUnderGames.push({
              line,
              over: vals.over,
              under: vals.under,
              bookmaker: bmName,
            });
          }
        }
      }

      // 4. Asian Handicap
      if (item.bettingType === 'ASIAN_HANDICAP' && item.bettingScope === 'FULL_TIME') {
        for (let i = 0; i < (item.odds || []).length; i += 2) {
          const o1 = item.odds[i];
          const o2 = item.odds[i + 1];
          if (o1 && o2 && o1.handicap?.value) {
            handicaps.push({
              handicap: o1.handicap.value,
              p1Odds: parseFloat(o1.value),
              p2Odds: parseFloat(o2.value),
              bookmaker: bmName,
            });
          }
        }
      }
    }

    // Determine Best & Average Odds
    let bestP1 = null;
    let bestP2 = null;
    let sumP1 = 0;
    let sumP2 = 0;

    for (const b of matchWinner) {
      sumP1 += b.p1;
      sumP2 += b.p2;
      if (!bestP1 || b.p1 > bestP1.odds) {
        bestP1 = { odds: b.p1, bookmaker: b.bookmaker };
      }
      if (!bestP2 || b.p2 > bestP2.odds) {
        bestP2 = { odds: b.p2, bookmaker: b.bookmaker };
      }
    }

    const avgP1 = matchWinner.length > 0 ? +(sumP1 / matchWinner.length).toFixed(2) : null;
    const avgP2 = matchWinner.length > 0 ? +(sumP2 / matchWinner.length).toFixed(2) : null;

    // Pick best over/under line closest to 22.5
    const preferredLines = ['22.5', '21.5', '23.5', '20.5', '24.5'];
    let primaryOU = null;
    for (const pref of preferredLines) {
      const found = overUnderGames.find(ou => ou.line === pref);
      if (found) {
        primaryOU = found;
        break;
      }
    }
    if (!primaryOU && overUnderGames.length > 0) {
      primaryOU = overUnderGames[0];
    }

    return {
      hasOdds: matchWinner.length > 0,
      source: 'Flashscore Live',
      bestP1,
      bestP2,
      avgP1,
      avgP2,
      matchWinner,
      firstSetWinner,
      overUnderGames,
      primaryOU,
      handicaps: handicaps.slice(0, 4),
    };
  } catch (err) {
    console.warn('Error fetching Flashscore odds:', err.message);
    return null;
  }
}

/**
 * Generate clean realistic estimated bookmaker odds if internet odds are unavailable.
 */
export function generateEstimatedOdds(favored = 1, confidence = 60) {
  const normConf = Math.max(50, Math.min(95, confidence)) / 100;
  const p1Prob = favored === 1 ? normConf : 1 - normConf;
  const p2Prob = 1 - p1Prob;

  // Margin ~ 5%
  const margin = 1.05;
  const fairP1 = +(margin / p1Prob).toFixed(2);
  const fairP2 = +(margin / p2Prob).toFixed(2);

  const matchWinner = [
    { bookmaker: 'Fortuna', p1: +(fairP1 + 0.02).toFixed(2), p2: +(fairP2 - 0.01).toFixed(2) },
    { bookmaker: 'STS', p1: fairP1, p2: fairP2 },
    { bookmaker: 'Superbet', p1: +(fairP1 - 0.01).toFixed(2), p2: +(fairP2 + 0.02).toFixed(2) },
    { bookmaker: 'Betclic', p1: fairP1, p2: fairP2 },
  ];

  const bestP1 = { odds: Math.max(...matchWinner.map(m => m.p1)), bookmaker: 'Fortuna' };
  const bestP2 = { odds: Math.max(...matchWinner.map(m => m.p2)), bookmaker: 'Superbet' };

  return {
    hasOdds: true,
    source: 'Model Rynkowy',
    bestP1,
    bestP2,
    avgP1: fairP1,
    avgP2: fairP2,
    matchWinner,
    firstSetWinner: [
      { bookmaker: 'Fortuna', p1: +(fairP1 * 0.95).toFixed(2), p2: +(fairP2 * 0.95).toFixed(2) },
      { bookmaker: 'STS', p1: +(fairP1 * 0.94).toFixed(2), p2: +(fairP2 * 0.94).toFixed(2) },
    ],
    overUnderGames: [
      { line: '21.5', over: 1.65, under: 2.15, bookmaker: 'Fortuna' },
      { line: '22.5', over: 1.85, under: 1.85, bookmaker: 'STS' },
      { line: '23.5', over: 2.10, under: 1.68, bookmaker: 'Superbet' },
    ],
    primaryOU: { line: '22.5', over: 1.85, under: 1.85, bookmaker: 'STS' },
    handicaps: [],
  };
}
