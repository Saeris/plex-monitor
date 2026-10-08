<div align="center">

# 📺 Plex Monitor

[![CI status][ci_badge]][ci]

Listens for [Plex][plex] webhooks and posts richly formatted notifications to [Discord][discord] when new movies or TV shows are added to your library.

</div>

---

## 📦 Installation

Clone the repo, then build and install the single-file executable for your platform:

```bash
vp install
vp run plxm:install
```

To update later, `vp run plxm:upgrade` pulls the latest changes, rebuilds, and reinstalls (stopping and restarting the running service).

> [!NOTE]
> On Windows, the autostart service runs `plxmw.exe`, a copy of `plxm.exe` that opens no console window. It shows a system tray icon instead, whose menu lets you open the log (`~/.plxm.log`) or exit the service.

---

## 🔧 Usage

```
plxm [command] [options]

Commands:
  install              Copy binary to PATH, register autostart service, run init if needed
  uninstall            Stop and remove the autostart service
  init                 Interactive configuration wizard
  config [options]     Update configuration values non-interactively
  stop                 Stop a running background server

Options:
  -h, --help           Show help
  -v, --version        Show version
  -d, --detach         Start the server in the background (no subcommand only)

Run `plxm help <command>` for command-specific help.
```

### First-time setup

`vp run plxm:install` builds the binary and runs `plxm install`, which handles the full onboarding:

1. Copies the binary to `~/.local/bin` (Linux/macOS) or `%LOCALAPPDATA%\Programs\plxm` (Windows) and adds it to your PATH
2. Runs `plxm init` if no config file exists yet
3. Registers an autostart service so the server starts on login, and starts it

### Running the server

Start in the foreground (stays attached to the terminal):

```bash
plxm
```

Start in the background (detached, survives closing the terminal):

```bash
plxm --detach
```

Stop a background server:

```bash
plxm stop
```

If a server is already running, `plxm` will report its endpoint and exit rather than starting a second instance.

### Configuration

`plxm init` is an interactive wizard that configures:

- **TMDB API key** — fetches poster images, runtime, director, genres, and trailer links. Get one free at [TMDB][tmdb_api_docs].
- **Discord webhook URL** — the channel where notifications are posted. Create one under _Server Settings → Integrations → Webhooks → New Webhook_. See [Discord's guide][discord_webhook_docs].
- **Port** — the local port the webhook server listens on (default: `7539`). Press Enter to accept the default.

To update individual values non-interactively:

```bash
plxm config --tmdb-api-key <key>
plxm config --discord-webhook-url <url>
plxm config --port 7539
```

Config is stored at `~/.plex-monitor.config.json`.

### Plex webhook setup

Once the server is running, point Plex at it:

1. Open Plex Web → **Settings → Account → Webhooks**
2. Click **Add Webhook**
3. Enter `http://<your-machine-ip>:<port>/` (e.g. `http://192.168.1.10:7539/`)
4. Save

> [!NOTE]
> The machine running `plxm` must be reachable from your Plex Media Server. If both run on the same machine, `http://localhost:7539/` works. On a separate machine on the same network, use its LAN IP address.

---

## 💬 Message Examples

### New Movie

> ### New Movie added in Films
>
> **Dune: Part One (2021)**
> Runtime: 2hr 35min
> Genres: Adventure, Drama, Science Fiction
> Directed by: Denis Villeneuve
>
> > Paul Atreides, a brilliant and gifted young man born into a great destiny beyond his understanding, must travel to the most dangerous planet in the universe to ensure the future of his family and his people.
>
> [▶ Watch Trailer](https://www.youtube.com/watch?v=n9xhJrPXop4)
>
> -# Added to GlaDOS on _October 22, 2021_

---

### New TV Series

> ### New TV Series added in Anime
>
> **Frieren: Beyond Journey's End (2023)**
> Seasons: 1 | Episodes: 28
> Genres: Adventure, Animation, Fantasy
> Created by: Kanehito Yamada
>
> > Elf mage Frieren and her fellow adventurers have defeated the Demon King and brought peace to the land. But Frieren will long outlive the rest of her former party. How will she come to understand what life means to the people around her?
>
> -# Added to GlaDOS on _March 25, 2024_

---

## ⚙️ Configuration reference

| Key                 | Description                                          | Required |
| ------------------- | ---------------------------------------------------- | -------- |
| `tmdbApiKey`        | [TMDB API key][tmdb_api_docs] for metadata & posters | Yes      |
| `discordWebhookUrl` | [Discord webhook URL][discord_webhook_docs]          | Yes      |
| `port`              | Port for the local webhook server (default: `7539`)  | Yes      |

### Supported media types

| Type       | Supported |
| ---------- | :-------: |
| Movies     |     ✔     |
| TV Series  |     ✔     |
| TV Seasons |    ➖     |
| Episodes   |    ❌     |

> Season and episode events are intentionally ignored — series-level notifications cover new additions without the noise.

---

## 🥂 License

Released under the [MIT license][license] © [Drake Costa][personal-website].

[ci_badge]: https://github.com/saeris/plex-monitor/actions/workflows/ci.yml/badge.svg
[ci]: https://github.com/saeris/plex-monitor/actions/workflows/ci.yml
[plex]: https://www.plex.tv
[discord]: https://discord.com
[tmdb_api_docs]: https://developer.themoviedb.org/docs/getting-started
[discord_webhook_docs]: https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks
[license]: ./LICENSE.md
[personal-website]: https://saeris.gg
