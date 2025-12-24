# PROJEKT-RICHTLINIEN & ENTWICKLER-REGELN

Dieses Dokument dient als verbindliche Anleitung für die KI-Entwickler (Antigravity/Gemini/Claude) für die Arbeit am Yamaha 01V96 Remote Projekt.

## 1. Architektur & Code-Qualität
*   **Sauberes OOP:** Immer sauberes, objektorientiertes Programmieren (OOP) nutzen. Logik und Anzeige sauber trennen.
*   **MVC-Struktur:** Wo möglich, eine klare MVC (Model-View-Controller) Struktur verfolgen.
*   **Dateilängen:** Dateien sollten überschaubar bleiben (Maximal 1000–1500 Zeilen). Bei Bedarf logisch in Module aufteilen.
*   **Daten-Caching:** Den aktuellen Status des Mischpults immer in einer **SQLite-Datenbank** zwischenspeichern. Ziel: Wenn kein Bulk-Sync möglich ist, soll die App wie ein echter Mischer den letzten bekannten Zustand ("Last State") sofort laden können.

## 2. UI / UX Design
*   **Aesthetics First:** Das Interface muss "Premium" wirken (Modern, lebendig, keine Standardfarben).
*   **Mobile First:** Das iPad ist das Haupt-Zielgerät. Alle Interaktionen müssen auf Touch-Bedienung optimiert sein.
*   **CSS-Templating:** Der HTML/JS-Code muss so strukturiert sein, dass wir später einfach durch den Austausch von CSS-Templates komplett neue Styles (Skins) anwenden können.

## 3. Kommunikation & Recherche
*   **Nicht raten, fragen:** Sei dir nicht zu sicher. Frag lieber 2x nach, bevor du etwas falsch interpretierst.
*   **Dokumentation nutzen:** Bei Unklarheiten aktiv nach Dokumentation suchen (CSS, PHP, Yamaha MIDI Protokolle, Google).
*   **"Geht nicht" gibt's nicht:** Behaupte nie, dass das Pult etwas eventuell nicht unterstützt. Die Original-Software kann alles zu jedem Zeitpunkt – also können wir das auch!

## 4. Refactoring & Änderungen
*   **Kein großes Refactoring ohne Erlaubnis:** Starte keine massiven Umbauaktionen, ohne vorher zu fragen.
*   **Ergebnisorientiertes Refactoring:** Beim Refactor nur umsortieren und aufräumen. Schreibe keine Sektionen neu, deren Funktion bereits gegeben ist ("Never change a running system" ohne Absprache).
*   **Versionierung:** Jedes Update bekommt eine Versionsnummer im Header (Dev: `v0.xx d`, Stable: `v0.x`). Erhöhe die Nummer bei jedem Commit.

## 5. Deployment
*   Jedes funktionale Update muss committet und gepusht werden.
*   Nach Änderungen immer den Server (`node server.js`) neu starten, um die Funktionalität zu prüfen.
