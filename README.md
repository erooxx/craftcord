<img src="assets/craftcord_logo.png" width="96" alt="Craftcord logo">

# Craftcord

Craftcord is a [Discord](https://discord.com/) bot that organizes crafting requests in World of Warcraft guilds. Members request an item with `/craft`, the bot posts it in a private thread, and anyone with the matching profession role can pick it up.

## 👋 Getting started

The easiest way to start using Craftcord in your server is the hosted instance. [Click here to invite Craftcord](https://discord.com/api/oauth2/authorize?client_id=1539187793518006282&permissions=361045814288&scope=bot+applications.commands) to your Discord server, then run `/setup` as an admin. If you have any questions, join the [support server](https://discord.gg/4YTC8Wvgyv).

## 🛠️ Self-hosting (advanced)

The hosted instance should be enough for most guilds. Self-hosting requires programming knowledge and is only for advanced users.

Craftcord requires Node.js 20 or higher, along with persistent storage for the per-guild config files it writes to `guild-config/` — shared hosts with an ephemeral filesystem will not work.

1. Clone the repository.
2. Copy `.env.example` to `.env` and fill in your bot's token, application ID, and a guild ID (used for the guild-only `/postwelcome` command). `data/recipes.json` already ships with the repo, so the Blizzard API credentials are only needed if you want to regenerate the recipe catalog yourself (`npm run import:recipes`).
3. Run `npm install` to install dependencies.
4. Run `npm run deploy` to register slash commands.
   - Global commands can take up to an hour to show up in all servers.
5. Run `npm start` to start Craftcord 🎉

Craftcord requires the following permissions, along with the `bot` and `applications.commands` scopes:

- View Channels
- Send Messages
- Send Messages in Threads
- Create Private Threads
- Manage Threads
- Embed Links
- Attach Files
- Read Message History
- Manage Roles
- Manage Channels
- Manage Messages

You can use this link to invite your self-hosted instance, replacing `<APP ID>` with your bot's application ID:

```
https://discord.com/api/oauth2/authorize?client_id=<APP ID>&permissions=361045814288&scope=bot+applications.commands
```

## 🐳 Docker

Craftcord ships with a `Dockerfile` and `docker-compose.yml`. After setting up your `.env` as described above:

```
docker compose up -d --build
```

This persists `guild-config/` via a bind mount, so your data survives container rebuilds and restarts.

## 🤝 Contributing

Craftcord is actively developed by a solo maintainer. Feel free to open issues or pull requests — for anything nontrivial, it helps to discuss it in the [support server](https://discord.gg/4YTC8Wvgyv) first before you start working on it.

## ⚠️ No affiliation with Blizzard Entertainment

Craftcord uses the Blizzard Battle.net API to display World of Warcraft game data (professions, recipes, items). It is not created by, affiliated with, or endorsed by Blizzard Entertainment. All game content and trademarks belong to their respective owners.

See [Privacy Policy](./PRIVACY.md) and [Terms of Service](./TERMS.md) for more.

## 📜 License

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along with this program. If not, see https://www.gnu.org/licenses/.
