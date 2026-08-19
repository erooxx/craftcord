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

Läuft produktiv via Docker Compose auf einem Hetzner-VPS (siehe `Dockerfile`,
`docker-compose.yml`); `guild-config/` wird als Bind-Mount persistiert. Lokal
weiterhin `npm run dev` (tsx watch) zum Entwickeln.

## Datei-Überblick

- `src/index.ts` — schlanker Bot-Einstiegspunkt: Client-Setup, `GuildDelete`-
  Handler, `InteractionCreate`-Dispatch (Buttons, Autocomplete, Routing zu
  `src/commands/*.ts`). Bis August 2026 war das ein 634-Zeilen-Monolith mit
  allen Command-Handlern inline; seit dem Pre-1.0.0-Refactor nur noch ~110
  Zeilen reines Routing.
- `src/commands/` — ein File pro Slash-Command (`ping.ts`, `setup.ts`,
  `craft.ts`, `postwelcome.ts`, `guildinfo.ts`, `guilddelete.ts`). `setup.ts`
  ist der komplexeste: statt verschachtelter `createMessageComponentCollector`-
  Callbacks (die alte Struktur) läuft der Locale→Rollen→Channel-Flow als
  flache Sequenz von `await`s über `interactions/collector.ts`.
- `src/interactions/` — geteilte Interaction-Infrastruktur:
  `errorHandling.ts` (`withErrorHandling`/`reportInteractionError`, einmal am
  Dispatcher angewendet statt pro Collector einzeln) und `collector.ts`
  (`awaitSingleComponent`, ersetzt das collector+on("collect")+on("end")-
  Dreiergespann, das vorher an jeder Button-/Select-Stelle kopiert war).
- `src/deploy-commands.ts` — registriert Slash-Commands, siehe
  "Slash-Commands" unten für global vs. guild-spezifisch.
- `src/guildConfig.ts` — liest/schreibt `guild-config/<guildId>.json`
  (Locale, Profession→Rolle-Zuordnung, Crafting-Channel-ID). Alle
  Schreibzugriffe laufen durch eine pro Guild serialisierte Warteschlange
  (`withGuildLock`), damit zwei gleichzeitige Interaktionen für dieselbe
  Gilde (z. B. zwei `/setup`-Läufe, oder `/setup` parallel zu
  `/guilddelete`) sich nicht gegenseitig überschreiben können. Save-Funktionen
  sind deshalb `async` — Aufrufer müssen `await`en.
- `src/i18n/locales.ts` + `src/i18n/translations.ts` — zentrale Lokalisierung
  (siehe eigener Abschnitt unten).
- `src/craftOrder.ts` — Embed-Aufbau + Button-Handler für `/craft`-Aufträge
  (Übernehmen/Abschließen/Zurückgeben/Abbrechen) und das Crafting-Channel-Info-Embed.
  Jeder Button-Handler läuft durch eine pro Nachricht serialisierte
  Warteschlange (`withOrderLock`) und liest den Embed-Stand frisch von
  Discord (`interaction.message.fetch()`) statt der ggf. veralteten
  Interaction-Snapshot — verhindert, dass zwei fast gleichzeitige Klicks
  (z. B. zwei Leute übernehmen gleichzeitig) den Auftrag inkonsistent machen.
- `src/roleSync.ts` — gleicht Berufsrollen einer Gilde mit dem Katalog ab,
  erstellt fehlende, benennt bei Sprachwechsel um. `createMissingRoles`
  nimmt einen optionalen `onRoleCreated`-Callback, über den `setup.ts` jede
  neu erstellte Rolle sofort persistiert — bricht die Erstellung mittendrin
  ab (Rate-Limit, Rollen-Cap), sind die bereits erstellten Rollen trotzdem
  gespeichert statt verwaist.
- `src/catalog/` — die statische Rezept-/Berufs-Datenschicht:
  - `professions.ts` — `RELEVANT_PROFESSION_IDS` (die 12 echten Crafting-
    Berufe, Gathering-Berufe ohne Rezepte wie Angeln/Archäologie/Skinning/
    Mining z. T. bewusst raus) + `PROFESSION_COLORS`.
  - `reagentSlots.ts` — `EXCLUDED_REAGENT_SLOT_NAMES`, filtert generische
    Mechanik-Slots (Artisan's Authenticity, Add Embellishment, Socket, ...)
    aus den Zusatz-Reagenzien raus. **Namensbasiert, nicht ID-basiert** —
    Blizzard vergibt für dieselbe Mechanik pro Beruf/Rezept unterschiedliche
    IDs.
  - `excludedCategories.ts` — filtert Rezept-Kategorien raus, die keine
    echten Rezepte sind (Spezialisierungs-/Wissens-Kategorien: `Appendix*`,
    `Recraft*`, `Section *`, `Tracking`, `Skinning Details`).
  - `recipeCatalog.ts` / `recipeIndex.ts` — laden `data/recipes.json` und
    bauen daraus den flachen Autocomplete-Suchindex (`recipeIndex`), einmal
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
  praktisch jedem Command-Handler in `src/commands/` vor.
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
- `/guildinfo` (Admin-only) — zeigt das gespeicherte `guild-config`-Objekt
  für den aktuellen Server (Locale, Crafting-Channel, Berufsrolle-Zuordnung).
- `/guilddelete` (Admin-only) — löscht die gespeicherte `guild-config`-Datei
  für den aktuellen Server nach Bestätigung per Button. Selbstbedienungs-
  Umsetzung des in `PRIVACY.md` zugesicherten Lösch-Rechts.

**Wichtig:** `/ping`, `/setup`, `/craft`, `/guildinfo`, `/guilddelete` sind
global registriert (`Routes.applicationCommands`, bis zu 1h Propagation),
funktionieren also in jeder Gilde, die den Bot einlädt. `/postwelcome` bleibt
bewusst guild-spezifisch auf `GUILD_ID` (der Craftcord-Heimatserver) —
`deploy-commands.ts` macht dafür zwei getrennte `PUT`-Calls.

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
- `PRIVACY.md` verspricht "Config wird gelöscht, wenn der Bot entfernt wird"
  und ein Selbstbedienungs-Löschrecht — beides seit dem `GuildDelete`-Handler
  bzw. `/guilddelete` umgesetzt.

## Offene Punkte (Stand zuletzt besprochen)
1. Max-Quality-Tier pro Rezept nicht auslesbar — siehe "Bewusste
   Architekturentscheidungen". Fallback wäre eine manuell gepflegte Liste.
2. Mögliche nächste Commands: `/help`, `/setBotChannel` (Crafting-Channel
   ändern ohne komplettes `/setup`). Nicht gebaut — **Nutzer will hierzu erst
   eine Umfrage in der Gilde machen**, bevor mehr spekulative Features gebaut
   werden.
3. Optionale Idee, nicht entschieden: Bot löscht automatisch Nicht-Command-
   Nachrichten in `crafting-orders`, um den Channel wirklich bot-only zu
   machen (statt nur der Berechtigungs-Ansatz, der Slash-Commands mitblockiert
   hätte). Bewusst zurückgestellt, nicht MVP.
4. `/legacycraft` (ältere Skill-Tiers, siehe Blizzard-API-Abschnitt) bewusst
   noch nicht gebaut — soll nach dem MVP-Launch als sichtbare Weiterentwicklung
   nachgezogen werden, statt alles auf einmal zu launchen.
5. Repo-Neustart unter pseudonymem GitHub-Account (`erooxx`) geplant, um
   echten Namen/Firmen-Mail aus der Git-Historie rauszubekommen — pausiert,
   bis der Account existiert (noch nicht angelegt).
6. `src/index.ts` war bis August 2026 ein 634-Zeilen-Monolith mit allen
   Command-Handlern inline und stark dupliziertem Collector-Code (siehe
   Code-Review) — behoben durch Aufteilung in `src/commands/` +
   `src/interactions/` (siehe "Datei-Überblick").
