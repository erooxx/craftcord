# Craftcord

Discord-Bot, der Crafting-Anfragen in WoW-Gilden organisiert.
`/craft` → Item per Autocomplete wählen → Bot legt Thread an und pingt die
passende Berufsrolle.

## Stack
TypeScript, discord.js v14, ESM (`"type": "module"`, kein CommonJS).
Ausführung über tsx, kein Build-Schritt beim Entwickeln.

## Bewusste Architekturentscheidungen
- **Keine Charakter-/Profildaten.** Berufe kommen ausschließlich über
  Discord-Rollen, die Member beim Onboarding selbst wählen. Der
  Profile-Endpoint der Blizzard-API ist bewusst nicht in Verwendung
  (veraltete Daten, keine Qualitätsstufen).
- **Rezeptkatalog statisch.** Import-Skript schreibt JSON, Bot lädt das beim
  Start in den Speicher. Kein Live-Abruf zur Laufzeit — Discord erlaubt bei
  Autocomplete nur ~3 Sekunden.
- **Keine Datenbank im MVP.** JSON reicht, solange die Daten read-only sind.
- **Guild-IDs überall mitführen.** Rollen- und Channel-IDs sind pro Server
  verschieden und dürfen nie hardcoded sein.

## Blizzard-API
- Game Data API, Namespace `static-eu`, Client-Credentials-Flow
- Import über: profession/index → profession/{id} → skill-tier/{id} → recipe/{id}
- Es gibt keinen Season-Filter. Pro Beruf wird der oberste Skill Tier genommen
  (= aktuelle Expansion). Für /legacycraft später die älteren Tiers.
- Rate Limit: 36.000/h, 100/s

## ToS-Auflagen
- Kein "WoW"/"Warcraft" in Name oder URL
- Blizzard als Datenquelle nennen, mit Hinweis auf fehlende Verbindung
- Keine Monetarisierung, keine Werbung