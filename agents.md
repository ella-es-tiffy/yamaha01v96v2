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
*   **Kleine Schritte:** Der User möchte immer nur kleine, fokussierte Änderungen.
*   **Sektions-Naming:** Um den Scope klar zu halten, nutzen wir folgende Begriffe:
    *   **"Fader Section":** Bezieht sich auf alle Fader (1-32 + Master).
    *   **"EQ Section":** Bezieht sich auf den 4-Band parametrischen EQ.
    *   **"Header" oder "Menu":** Alle Bedienelemente oben (Bänke, Sync, Log, etc.).
*   **Versionierung:** Jedes Update bekommt eine Versionsnummer im Header (Dev: `v0.xx d`, Stable: `v0.x`). Erhöhe die Nummer bei jedem Commit.

## 5. Entwicklungsumgebung (/dev)
*   **Der /dev Ordner:** Dieser Ordner ist primär für die KI (mich). Er dient als Experimentierfeld ("Sandbox"), um neue MIDI-Befehle zu probieren, Bugs zu sniffern oder komplexe Logiken vorab zu testen.
*   **Gedankenstütze:** Skripte in /dev fungieren als technisches Gedächtnis und Beweis für funktionierende SysEx-Ketten.

## 6. Deployment
*   Jedes funktionale Update muss committet und gepusht werden.
*   Nach Änderungen immer den Server (`node server.js`) neu starten, um die Funktionalität zu prüfen.
## 7. Bug-Fix Versionierung
*   **Granulare Fixes:** Wenn ein User meldet, dass etwas nicht geht (z.B. in v0.5), wird nicht sofort auf die nächste Minor-Version (v0.6) gesprungen.
*   **Schema:** Stattdessen nutzen wir Unter-Versionen für die Fix-Versuche:
    *   Start: v0.5 (Broken)
    *   Fix Versuch 1 -> v0.51
    *   Fix Versuch 2 -> v0.52
    *   ... -> v0.599
*   **Ziel:** Dies reflektiert den Trial-and-Error-Prozess bei Bugfixes, ohne die Hauptversionsnummern zu verbrauchen.
