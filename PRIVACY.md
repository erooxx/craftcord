# Privacy Policy

_Last updated: 2026-08-19_

Craftcord ("the bot") is a Discord bot that organizes crafting requests in guilds. This page explains what data it stores and why.

## What we store

For every Discord server (guild) the bot is set up in via `/setup`, we store a small configuration file containing:

- The language you chose (German or English)
- The Discord role ID assigned to each in-game profession
- The Discord channel ID used for crafting requests

This is stored as a plain JSON file per server, on the machine that runs the bot. It contains no personal information beyond Discord IDs that are already visible to anyone in your server.

## What we don't store

- We don't read or log the content of your messages.
- We don't track individual users, their activity, or their crafting history.
- Crafting requests (who requested what, who claimed it) only exist as a Discord message/thread inside your own server — we don't copy or store that information ourselves.
- We don't collect emails, payment details, or any data unrelated to running the bot's commands.

## Third-party data

To build the recipe catalog, the bot fetches public World of Warcraft game data (profession recipes, item names and icons) from the [Blizzard Battle.net API](https://develop.battle.net). No data about you or your server is sent to Blizzard — this is a one-way, one-time import unrelated to your usage of the bot.

## How long we keep data

Your server's configuration is kept for as long as the bot is a member of your server. If you remove the bot, we intend to delete the associated configuration file; if you'd like it removed sooner, contact us (see below).

## Your rights

You can ask us to delete your server's stored configuration at any time — just reach out (see contact below), or simply remove the bot from your server.

## Contact

Questions or data deletion requests: TODO — add a contact email or Discord username here.
