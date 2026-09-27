# Max’s Adventures — Turbo Edition

Uruchom `npm start` i otwórz http://127.0.0.1:4173. Wymagany Node.js oraz internet do pobrania Three.js z CDN.

W garażu wybierz Monster (turbo 4 s), Rally (szybszy skręt, turbo 3 s) lub Buggy (turbo 5 s). Sterowanie: strzałki / A–D, spacja uruchamia turbo, P / Escape przełącza pauzę. Na telefonie dostępne są przyciski i przesunięcia palcem.

Turbo przyspiesza o 75%, podwaja punkty za Oreo i odnawia się przez 8 sekund po wykorzystaniu. Nie chroni przed małpkami. Banany przywracają życie. Po przegranej można wrócić do garażu bez przeładowania strony.

## Weryfikacja

`npm install`, `npx playwright install chromium`, następnie `npm start` w osobnym terminalu i `npm test`. Można ustawić `BROWSER_CHANNEL=msedge`, aby użyć zainstalowanego Edge.

Test przeglądarkowy sprawdza wybór pojazdu, skręt, czas i regenerację turbo, premię za Oreo, pauzę, kolizje, koniec gry, restart, ograniczoną pulę modeli oraz mobilne sterowanie i układ HUD. Czas symulacji jest sterowany w teście, niezależnie od szybkości renderowania. Zrzuty trafiają do `artifacts/`.

Optymalizacje obejmują ponowne używanie modeli, limit rozdzielczości renderowania do DPR 1.5, mniej odległych dekoracji, interpolację zależną od czasu i renderowanie po aktualizacji stanu. Rzeczywisty FPS zależy od urządzenia; test nie stanowi pomiaru płynności na telefonie.
