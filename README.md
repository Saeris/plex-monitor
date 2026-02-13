# Plex Discord Webhook Service

A TypeScript-based Vercel serverless function that monitors Plex webhooks and sends beautiful Discord notifications when new movies, TV shows, or seasons are added to your Plex library.

## Features

- 🎬 **Multi-format support**: Monitors new movies, TV shows, and seasons
- 🎨 **Rich Discord messages**: Formatted messages with posters and metadata
- ⚡ **Serverless**: Runs on Vercel with Bun runtime for optimal performance
- 🔒 **Type-safe**: Written in TypeScript with comprehensive type definitions
- 📦 **Zero dependencies**: Uses native Node.js APIs for maximum efficiency

## Message Examples

### New Series
```md
## New Series added in Anime

**Frieren: Beyond Journey's End (2023)**
Seasons: 2 | Episodes: 48

> Elf mage Frieren and her fellow adventurers have defeated the Demon King...

-# Added to MyPlexServer on *Feb 13, 2026*
```

### New Season
```md
## New Season added in Anime

**Frieren: Beyond Journey's End (2023)** - Season 02

-# Added to MyPlexServer on *Feb 13, 2026*
```

### New Movie
```md
## New Movie added in Films

**Dune: Part Two (2024)**
Runtime: 2hr 45min
Directed by: Denis Villeneuve
Genres: Action, Adventure, Drama, Science Fiction

> Paul Atreides aligns with Chani and the Fremen...

-# Added to MyPlexServer on *Feb 13, 2026*
```

## Setup

### 1. Clone and Install

```bash
git clone <your-repo>
cd plex-discord-webhook
npm install
```

### 2. Create Discord Webhook

1. Open your Discord server
2. Go to Server Settings → Integrations → Webhooks
3. Click "New Webhook"
4. Give it a name (e.g., "Plex Notifications")
5. Select the channel for notifications
6. Copy the webhook URL

### 3. Deploy to Vercel

```bash
# Install Vercel CLI if you haven't
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

During deployment, you'll be prompted to set environment variables. Add:
- `DISCORD_WEBHOOK_URL`: Your Discord webhook URL from step 2

Alternatively, set it via the Vercel dashboard:
1. Go to your project settings
2. Navigate to Environment Variables
3. Add `DISCORD_WEBHOOK_URL` with your webhook URL

### 4. Configure Plex Webhook

1. Open Plex Web App
2. Go to Settings → Account → Webhooks
3. Click "Add Webhook"
4. Enter your Vercel function URL: `https://your-domain.vercel.app/api/plex-webhook`
5. Save

## Development

### Local Development

```bash
# Start Vercel dev server
npm run dev
```

The function will be available at `http://localhost:3000/api/plex-webhook`

### Testing with curl

You can test the endpoint with a sample Plex webhook payload:

```bash
curl -X POST http://localhost:3000/api/plex-webhook \
  -H "Content-Type: multipart/form-data" \
  -F 'payload={"event":"library.new","user":true,"owner":true,"Account":{"id":1,"thumb":"","title":"User"},"Server":{"title":"MyPlexServer","uuid":"xxx"},"Metadata":{"librarySectionType":"movie","ratingKey":"12345","key":"/library/metadata/12345","guid":"plex://movie/5d776a24cbf1f1001f592899","type":"movie","title":"Dune: Part Two","titleSort":"Dune Part Two","librarySectionTitle":"Films","librarySectionID":1,"librarySectionKey":"/library/sections/1","contentRating":"PG-13","summary":"Paul Atreides aligns with Chani and the Fremen...","rating":8.5,"year":2024,"thumb":"/library/metadata/12345/thumb/1234567890","art":"/library/metadata/12345/art/1234567890","duration":9900000,"originallyAvailableAt":"2024-03-01","addedAt":1618953630,"updatedAt":1618953630,"Director":[{"tag":"Denis Villeneuve"}],"Genre":[{"tag":"Action"},{"tag":"Adventure"},{"tag":"Drama"},{"tag":"Science Fiction"}]}}'
```

### Type Checking

```bash
npm run build
```

### Linting

```bash
npm run lint
```

## Project Structure

```
.
├── api/
│   └── plex-webhook.ts       # Main Vercel function endpoint
├── lib/
│   ├── types.ts              # TypeScript type definitions
│   ├── plex-parser.ts        # Plex webhook payload parser
│   ├── discord-formatter.ts  # Discord message formatter
│   └── discord-client.ts     # Discord webhook client
├── package.json
├── tsconfig.json
├── vercel.json               # Vercel configuration
└── README.md
```

## How It Works

1. **Webhook Received**: Plex sends a multipart/form-data POST request when new content is added
2. **Parsing**: The service extracts and parses the JSON payload from the form data
3. **Filtering**: Only `library.new` events for shows, seasons, and movies are processed
4. **Formatting**: Content metadata is transformed into beautifully formatted Discord markdown
5. **Notification**: The message is sent to Discord via webhook with embedded poster images

## Supported Media Types

- ✅ Movies
- ✅ TV Shows (entire series)
- ✅ TV Seasons
- ❌ Individual Episodes (not supported to reduce noise)

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_WEBHOOK_URL` | Discord webhook URL for notifications | Yes |

## Troubleshooting

### No notifications appearing

1. Check Vercel function logs for errors
2. Verify the Discord webhook URL is correct
3. Ensure Plex webhook is configured with the correct Vercel URL
4. Confirm the media type is supported (show, season, or movie)

### Thumbnails not showing

Plex thumbnails may require authentication. The service uses the thumbnail URLs provided by Plex, but some may not be publicly accessible. This is a Plex limitation.

### Messages are malformed

Check the Vercel function logs to see the raw Plex payload and verify the metadata structure matches expectations.

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.