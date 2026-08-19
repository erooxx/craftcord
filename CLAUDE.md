# Craftcord

Discord-Bot, der Crafting-Anfragen in WoW-Gilden organisiert. Solo-Projekt von
erooxx ("du" nicht "ihr" — es gibt kein Team). Repo: github.com/erooxx/craftcord
(öffentlich, AGPLv3). MVP-Kernfunktionalität (`/setup` + `/craft`) ist fertig
und getestet; aktuell in der Polier-/Ausbau-Phase.

## Stack
TypeScript, discord.js v14, ESM (`"type": "module"`, kein CommonJS).
Ausführung über `tsx`, kein Build-Schritt beim Entwickeln.

Scripts: `npm run dev` (tsx watch), `npm run deploy` (Commands registrieren),
`npm run import:recipes` (Blizzard-Import neu laufen lassen).

Läuft aktuell nur lokal (`tsx watch`). Hosting noch nicht entschieden — siehe
"Offene Punkte" unten.

## Datei-Überblick

- `src/index.ts` — Bot-Einstiegspunkt, der komplette `InteractionCreate`-Handler
  (Buttons, Autocomplete, alle Slash-Commands). Größte Datei, absichtlich noch
  nicht weiter aufgeteilt (siehe "Offene Punkte").
- `src/deploy-commands.ts` — registriert Slash-Commands via
  `Routes.applicationGuildCommands` (nur **eine** Guild, `GUILD_ID` in `.env` —
  euer Craftcord-Heimatserver, nicht global; siehe unten).
- `src/guildConfig.ts` — liest/schreibt `guild-config/<guildId>.json`
  (Locale, Profession→Rolle-Zuordnung, Crafting-Channel-ID). Lese-vor-Schreibe-
  Muster, damit ein Feld nie ein anderes überschreibt.
- `src/i18n/locales.ts` + `src/i18n/translations.ts` — zentrale Lokalisierung
  (siehe eigener Abschnitt unten).
- `src/craftOrder.ts` — Embed-Aufbau + Button-Handler für `/craft`-Aufträge
  (Übernehmen/Abschließen/Zurückgeben/Abbrechen) und das Crafting-Channel-Info-Embed.
- `src/roleSync.ts` — gleicht Berufsrollen einer Gilde mit dem Katalog ab,
  erstellt fehlende, benennt bei Sprachwechsel um.
- `src/professions.ts` — `RELEVANT_PROFESSION_IDS` (die 12 echten Crafting-
  Berufe, Gathering-Berufe ohne Rezepte wie Angeln/Archäologie/Skinning/Mining
  z. T. bewusst raus) + `PROFESSION_COLORS`.
- `src/reagentSlots.ts` — `EXCLUDED_REAGENT_SLOT_NAMES`, filtert generische
  Mechanik-Slots (Artisan's Authenticity, Add Embellishment, Socket, ...) aus
  den Zusatz-Reagenzien raus. **Namensbasiert, nicht ID-basiert** — Blizzard
  vergibt für dieselbe Mechanik pro Beruf/Rezept unterschiedliche IDs.
- `src/excludedCategories.ts` — filtert Rezept-Kategorien raus, die keine
  echten Rezepte sind (Spezialisierungs-/Wissens-Kategorien: `Appendix*`,
  `Recraft*`, `Section *`, `Tracking`, `Skinning Details`).
- `src/recipeCatalog.ts` / `src/recipeIndex.ts` — laden `data/recipes.json`
  und bauen daraus den flachen Autocomplete-Suchindex (`recipeIndex`), einmal
  beim Bot-Start im Speicher.
- `src/blizzard/` — Blizzard-API-Client (Auth, `authenticatedGet`, die vier
  Endpoint-Funktionen, Icon-Auflösung über den Media-Endpoint).
- `src/scripts/import-recipes.ts` — das eigentliche Import-Skript, schreibt
  `data/recipes.json` (im Repo versioniert, da statisch — nicht gitignored).
- `src/welcomeMessage.ts` + `src/links.ts` — Willkommens-Embed für den
  Craftcord-eigenen Server (`/postwelcome`), bewusst **nicht** Teil des
  Locale-Systems (fixes Englisch, nicht gilden-konfigurierbar).
- `assets/craftcord_logo.png` — Bot-Logo, als Discord-Attachment im
  Willkommens-Embed eingebunden (`attachment://`-Mechanismus).
- `guild-config/` — gitignored, Laufzeit-Zustand pro Gilde (anders als
  `data/recipes.json`, das ein einmalig generiertes, versioniertes Artefakt ist).

## Bewusste Architekturentscheidungen
- **Keine Charakter-/Profildaten.** Berufe kommen ausschließlich über
  Discord-Rollen, die Member beim Onboarding selbst wählen. Der
  Profile-Endpoint der Blizzard-API ist bewusst nicht in Verwendung
  (veraltete Daten, keine Qualitätsstufen).
- **Rezeptkatalog statisch.** Import-Skript schreibt JSON, Bot lädt das beim
  Start in den Speicher. Kein Live-Abruf zur Laufzeit — Discord erlaubt bei
  Autocomplete nur ~3 Sekunden.
- **Keine Datenbank im MVP.** JSON reicht, solange die Daten überschaubar
  bleiben. `guild-config/*.json` ist der einzige schreibende Laufzeit-Zustand.
- **Guild-IDs überall mitführen.** Rollen- und Channel-IDs sind pro Server
  verschieden und dürfen nie hardcoded sein.
- **Reagenzien-Mengen für Zusatz-Slots nicht verfügbar.** Blizzards API liefert
  für `modified_crafting_slots` (Qualitäts-Reagenzien) keine Mengenangabe, nur
  für `reagents` (feste Reagenzien). Akzeptierte Lücke, keine Materialliste mit
  Mengen für diese Slots im Embed.
- **Maximales Craft-Tier nicht zuverlässig auslesbar.** Manche Items sind auf
  T3 gedeckelt (z. B. Flasks), andere gehen bis T5 — kein Feld in der rohen
  Recipe-Antwort dafür gefunden. Ungelöst, siehe "Offene Punkte".

## Discord-spezifische Lektionen (wichtig, um nicht erneut draufzulaufen)

- **3-Sekunden-Interaktionsfenster.** Jede Interaktion braucht innerhalb von
  3s eine erste Antwort (`reply`/`update`/`defer*`). Mehrere sequenzielle
  API-Calls davor (Rollen erstellen, Channel anlegen, Embed senden) reißen das
  regelmäßig. Muster: sofort `update()`/`deferUpdate()` mit Platzhalter-Text,
  dann die langsame Arbeit, dann `editReply()` mit dem Ergebnis. Kommt in
  praktisch jedem Handler in `index.ts` vor.
- **Rollen-Umbenennung ist rate-limitiert** (~2 Änderungen/10min pro Channel/
  Rolle, Discord-eigenes Limit, nicht das normale API-Rate-Limit). Betrifft
  schnelles Testen von Übernehmen/Zurückgeben hintereinander — in echter
  Nutzung kaum relevant.
- **Rollen-Hierarchie.** Der Bot kann nur Rollen bearbeiten, die in der
  Serverliste **unter** seiner eigenen Rolle stehen, selbst mit "Rollen
  verwalten"-Berechtigung. Bot-Rolle muss über allen 12 Berufsrollen stehen.
- **Private Threads kennen keine rollenbasierte Sichtbarkeit**, nur Mitglieder-
  Liste. Um "sichtbar für alle mit Rolle X" zu erreichen, müssen alle
  aktuellen Rolleninhaber einzeln zum Thread hinzugefügt werden
  (`guild.members.fetch()` + `role.members` + `thread.members.add()` pro
  Person). Braucht den **Server Members Intent** (privilegiert, im Dev-Portal
  aktivieren).
- **"Nachrichten senden" sperren blockiert auch Slash-Commands** im selben
  Channel (Discords Client blendet die komplette Eingabezeile aus). Deshalb
  ist das Crafting-Channel-Info-Embed **angepinnt**, nicht über eine
  Berechtigungssperre "geschützt".
- **Bot braucht explizite Erlaubnis-Overwrite**, bevor eine `@everyone`-Sperre
  gesetzt wird, sonst blockiert er sich selbst (Bot ist auch Mitglied von
  `@everyone`).
- **Namen- statt ID-Filterung für generische Blizzard-Mechaniken.** IDs für
  dieselbe Mechanik (z. B. "Artisan's Authenticity") unterscheiden sich pro
  Beruf/Rezept — eine ID-Liste bleibt zwangsläufig unvollständig. Namen sind
  stabil. Gilt für `excludedCategories.ts` und `reagentSlots.ts`.

## i18n / Lokalisierung
Zentral in `src/i18n/`:
- `locales.ts` — `SUPPORTED_LOCALES` (aktuell `de`, `en`) ist die einzige
  Quelle der Wahrheit; `Locale`-Typ wird davon abgeleitet.
- `translations.ts` — alle Texte, nach Bereich verschachtelt (`common`,
  `postwelcome`, `setup`, `craft.order`, `craft.info`). Zugriff per direktem
  Objektpfad (`text.setup.rolePrompt[locale](...)`), kein String-Key-System.

**Neue Sprache hinzufügen:** Eintrag in `SUPPORTED_LOCALES` ergänzen →
TypeScript zeigt Compile-Fehler für jede fehlende Übersetzung in
`translations.ts` → dort ergänzen. `/setup`s Sprachbuttons generieren sich
automatisch aus der Liste, kein Code-Touch nötig.

`guildConfig.ts` speichert kurze Codes (`"de"`, nicht `"de_DE"`) — bewusst,
spart eine Migration und regionale Varianten sind für den Anwendungsfall nicht
nötig.

`welcomeMessage.ts` ist **nicht** Teil dieses Systems (siehe Datei-Überblick).

## Slash-Commands (Stand jetzt)
- `/ping` — Lebenszeichen-Test.
- `/setup` (Admin-only) — Locale wählen → Berufsrollen abgleichen/erstellen →
  Crafting-Channel festlegen (gefunden/erstellt/ausgewählt) → Info-Embed dort
  posten + anpinnen.
- `/craft` — Item (Autocomplete, nur aktuelles Tier), Quality (T1–T5, Default
  höchstes), Urgency (Default ASAP). Erstellt privaten Thread, fügt
  Anfragende:n + alle mit passender Berufsrolle hinzu, postet Order-Embed mit
  Übernehmen/Abbrechen-Buttons.
- `/postwelcome` (nur `OWNER_ID` aus `.env`, zusätzlich admin-only sichtbar) —
  postet das Projekt-Willkommens-Embed in `#welcome` (oder lässt per
  Channel-Picker auswählen, falls nicht gefunden). Nur für den
  Craftcord-eigenen Server relevant.

**Wichtig:** Alle Commands sind aktuell nur auf **eine** Guild registriert
(`GUILD_ID` = der Craftcord-Heimatserver). Für echte WoW-Gilden müssten
`/setup` und `/craft` global registriert werden (bis zu 1h Propagation);
`/postwelcome` sollte bewusst guild-spezifisch bleiben.

## Blizzard-API
- Game Data API, Namespace `static-eu`, Client-Credentials-Flow
  (`BLIZZARD_CLIENT_ID`/`SECRET` in `.env`).
- Import-Kette: `profession/index` → `profession/{id}` → `skill-tier/{id}` →
  `recipe/{id}` (+ `media/recipe/{id}` für Icons).
- Es gibt keinen Season-Filter. Pro Beruf wird der Skill-Tier mit der
  **höchsten ID** genommen (= aktuelle Expansion, empirisch bestätigt). Für
  `/legacycraft` später die älteren Tiers — die Daten sind über dieselbe Kette
  erreichbar, nur die "nimm die höchste ID"-Regel müsste durch "nimm Tier X"
  ersetzt werden.
- Rate Limit: 36.000/h, 100/s. Import läuft bewusst sequenziell, keine
  Parallelisierung nötig bei der aktuellen Rezeptmenge (~774 nach Filterung).

## ToS-Auflagen
- Kein "WoW"/"Warcraft" in Name oder URL
- Blizzard als Datenquelle nennen, mit Hinweis auf fehlende Verbindung
- Keine Monetarisierung, keine Werbung

## Rechtliches
- `LICENSE` (AGPLv3, unverändert), `TERMS.md`, `PRIVACY.md` im Repo-Root.
  Erstentwürfe, keine geprüfte Rechtsberatung.
- `PRIVACY.md` verspricht aktuell "Config wird gelöscht, wenn der Bot entfernt
  wird" — das ist noch **nicht** implementiert (kein `GuildDelete`-Handler).

## Offene Punkte (Stand zuletzt besprochen)
1. **Keine globale Fehlerbehandlung.** Ein einzelner unbehandelter Fehler
   (z. B. ein fehlgeschlagener Discord-API-Call) crasht den ganzen Prozess.
   Vor dem Hosting-Entscheid als Erstes angehen.
2. **Hosting noch offen.** Optionen besprochen: VPS (Hetzner/netcup), Railway/
   Fly.io (Achtung: manche haben flüchtiges Dateisystem — `guild-config/`
   bräuchte ein persistentes Volume), oder eigener Rechner. Nicht entschieden.
3. `GuildDelete`-Handler fehlt (siehe "Rechtliches" oben).
4. Max-Quality-Tier pro Rezept nicht auslesbar — siehe "Bewusste
   Architekturentscheidungen". Fallback wäre eine manuell gepflegte Liste.
5. Mögliche nächste Commands: `/help`, `/setBotChannel` (Crafting-Channel
   ändern ohne komplettes `/setup`). Nicht gebaut — **Nutzer will hierzu erst
   eine Umfrage in der Gilde machen**, bevor mehr spekulative Features gebaut
   werden.
6. `src/`-Struktur ist noch flach (viele Dateien direkt unter `src/`) — als
   Aufräumarbeit für "am Ende" vorgemerkt, noch nicht umgesetzt.
7. Optionale Idee, nicht entschieden: Bot löscht automatisch Nicht-Command-
   Nachrichten in `crafting-orders`, um den Channel wirklich bot-only zu
   machen (statt nur der Berechtigungs-Ansatz, der Slash-Commands mitblockiert
   hätte). Bewusst zurückgestellt, nicht MVP.
