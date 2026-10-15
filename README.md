# STATIQWIN — ProMatch Tennis AI & Live H2H Analyzer

Nowoczesna mobilna aplikacja webowa PWA do zaawansowanej analityki meczów tenisowych (ATP & WTA) z bezpośrednim skanerem linków Flashscore, feedem na żywo, radarami kontuzji i prognozami AI.

## 🚀 Szybkie wdrożenie na Vercel

### Metoda 1: Przez GitHub (Zalecana)
1. Utwórz nowe repozytorium na [GitHub.com](https://github.com/new).
2. Wypchnij zawartość tego katalogu do repozytorium.
3. Zaloguj się na [Vercel.com](https://vercel.com) i kliknij **"Add New Project"**.
4. Zaimportuj repozytorium GitHub — Vercel automatycznie wykryje ustawienia z pliku `vercel.json` (Framework: Vite, Build: `npm run build`, Output: `dist`).
5. Kliknij **"Deploy"** — po około 30 sekundach Twoja aplikacja będzie dostępna pod darmową subdomeną `.vercel.app` (oraz pod Twoją domeną niestandardową).

### Metoda 2: Przez Vercel CLI (z terminala)
```bash
npm install -g vercel
vercel login
vercel --prod
```

## 🛠️ Lokalne uruchomienie i testy

```bash
# Instalacja zależności
npm install

# Uruchomienie serwera deweloperskiego
npm run dev

# Uruchomienie testów jednostkowych (103/103 testów)
npm run test

# Budowanie wersji produkcyjnej
npm run build
```

## 📦 Kluczowe moduły
- **Silnik statystyczny & radar kontuzji:** `src/statsEngine.js`
- **Integracja Live Scoreboard (ATP & WTA):** `src/liveTennisService.js`
- **Parser & Scraping kursów Flashscore:** `src/flashscoreService.js` & `src/parser.js`
- **Uwierzytelnianie i sesje:** `src/auth.js`
- **Zarządzanie licencjami:** `src/licenseManager.js`
- **Silnik Predykcji AI (Autorski System AI & Bayesian Fallback):** `src/aiEngine.js`
