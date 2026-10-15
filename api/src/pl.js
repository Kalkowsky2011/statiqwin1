/**
 * Polish localization dictionary for ProMatch H2H Analyzer.
 * All user-facing strings in fluent professional Polish.
 */
const PL = {
  // App
  appName: 'STATIQWIN',
  appTagline: 'Zaawansowana analityka tenisowa i kursy live',

  // Navigation
  navScanner: '📊 Skaner Meczowy',
  navGenerator: '🔥 Generator Typów',
  navPro: '🔑 Klucz PRO',

  // PWA Banner
  pwaBannerTitle: '📱 Zainstaluj aplikację',
  pwaBannerIOS: 'Kliknij ikonę udostępniania ⬆️ a następnie „Dodaj do ekranu początkowego"',
  pwaBannerAndroid: 'Kliknij „Zainstaluj" lub „Dodaj do ekranu głównego"',
  pwaBannerClose: 'Zamknij',
  pwaBannerInstall: 'Zainstaluj',

  // Input Section
  pasteLabel: 'Tryb A: Wklej tekst H2H',
  pastePlaceholder: 'Wklej tutaj skopiowany tekst H2H z Flashscore, np.:\n12.06.2024  Wimbledon  Grass  Djokovic - Alcaraz  6:4, 3:6, 7:5...',
  pasteButton: '📋 Wklej ze schowka i prześwietl',
  parseButton: '🔍 Analizuj wklejony tekst',
  demoLabel: 'Tryb B: Gotowe przykłady meczów',
  manualLabel: 'Tryb C: Szybkie wprowadzanie ręczne',

  // Demo Presets
  demoWimbledon: '🌿 Wimbledon — Trawa',
  demoRolandGarros: '🧱 Roland Garros — Mączka',
  demoUSOpen: '🏟️ US Open — Hard',

  // Surfaces
  surfaceHard: 'Nawierzchnia twarda',
  surfaceClay: 'Mączka',
  surfaceGrass: 'Trawa',
  surfaceIndoor: 'Hala',
  surfaceAll: 'Wszystkie nawierzchnie',

  // Tournament Tiers
  tierGrandSlam: 'Grand Slam',
  tierMasters: 'Masters 1000',
  tierAtp500: 'ATP 500',
  tierAtp250: 'ATP 250',

  // Stats Labels
  h2hRecord: 'Bilans H2H',
  overallForm: 'Forma ogólna',
  momentum: 'Momentum',
  surfaceWinRate: 'Skuteczność na nawierzchni',
  surfaceSpecific: 'Skuteczność na {surface}',
  matchesPlayed: 'Rozegrane mecze',
  wins: 'Wygrane',
  losses: 'Przegrane',
  winRate: 'Procent wygranych',
  recentForm: 'Ostatnia forma (5 meczów)',
  headToHead: 'Bezpośrednie starcia',

  // Injury Module
  injuryTitle: '🏥 Analiza Ryzyka Kontuzji',
  injuryRisk: 'Ryzyko kontuzji',
  injuryLow: '🟢 Niskie',
  injuryMedium: '🟡 Średnie',
  injuryHigh: '🔴 Wysokie',
  injuryWarning: '⚠️ Ostrzeżenie: {player} zgłosił problemy fizyczne w ostatnim meczu ({reason})',
  injuryFactorMTO: 'Medical Timeout / Krecz w ostatnich meczach',
  injuryFactorMarathon: 'Maratoński mecz w ostatnich 5 dniach',
  injuryFactorRest: 'Krótka przerwa między meczami',
  injuryFactorKeyword: 'Wykryto słowa kluczowe dot. kontuzji',
  injuryNoIssues: 'Brak wykrytych problemów zdrowotnych',

  // PRO Features
  proLocked: '🔒 Sekcja PRO — Aktywuj klucz, aby odblokować',
  proFirstSet: '1. Set — Statystyki',
  proFirstSetWinRate: 'Procent wygranych 1. setów',
  proOverUnder: 'Kalkulator Over/Under Gemów',
  proAvgGames: 'Średnia gemów na mecz',
  proOverLine: 'Over {line}',
  proUnderLine: 'Under {line}',
  proVerdict: '🔮 Werdykt AI',
  proValueBet: '💎 Value Bet',

  // License / Paywall
  licenseTitle: 'Aktywacja klucza PRO',
  licenseInput: 'Wprowadź klucz licencyjny...',
  licenseActivate: '🔓 Aktywuj klucz',
  licenseSuccess: '✅ Klucz aktywowany! Wszystkie funkcje PRO odblokowane.',
  licenseError: '❌ Nieprawidłowy klucz. Sprawdź pisownię i spróbuj ponownie.',
  licenseInfo: 'Kup klucz PRO, aby odblokować pełną analizę nawierzchniową, ryzyko kontuzji, statystyki 1. seta i kalkulator gemów.',
  licensePricing: 'Cennik',
  licenseTierBasic: 'Darmowy',
  licenseTierBasicDesc: 'Podstawowa analiza H2H i forma ogólna',
  licenseTierPro: 'PRO — 29 zł/mies.',
  licenseTierProDesc: 'Pełna analiza nawierzchni, kontuzje, 1. set, O/U, werdykt AI',
  licenseTierUltra: 'ULTRA — 49 zł/mies.',
  licenseTierUltraDesc: 'Wszystko z PRO + priorytetowe wsparcie + API',
  licenseDevToggle: 'Tryb deweloperski',
  modeFree: 'FREE',
  modePro: 'PRO',

  // Social Export (Tab 2)
  exportTitle: 'Eksport i udostępnianie',
  exportDiscord: '📋 Kopiuj raport na Discorda',
  exportDiscordSuccess: '✅ Skopiowano do schowka!',
  exportTikTok: '🎙️ Generuj skrypt pod rolkę (TikTok / ElevenLabs)',
  exportTikTokLabel: 'Skrypt gotowy do odczytania lub wklejenia do ElevenLabs:',
  exportNoData: '⚠️ Najpierw załaduj dane meczu w zakładce „Skaner Meczowy"',
  exportCopy: 'Kopiuj',
  exportCopied: 'Skopiowano!',

  // Manual Input
  manualPlayer1: 'Zawodnik 1',
  manualPlayer2: 'Zawodnik 2',
  manualWin: 'W',
  manualLoss: 'L',
  manualMatch: 'Mecz',
  manualSurface: 'Nawierzchnia',
  manualTournament: 'Turniej',
  manualAnalyze: '🔍 Analizuj',

  // Misc
  vs: 'vs',
  loading: 'Ładowanie...',
  noData: 'Brak danych do wyświetlenia',
  error: 'Wystąpił błąd. Spróbuj ponownie.',
  matchDate: 'Data meczu',
  score: 'Wynik',
  winner: 'Zwycięzca',
  tournament: 'Turniej',
  surface: 'Nawierzchnia',
  player: 'Zawodnik',
  close: 'Zamknij',
  confirm: 'Potwierdź',
  cancel: 'Anuluj',
};

export default PL;
