---
"@saeris/plex-monitor": patch
---

Split CLI entry points: npm bundle uses cli.ts (no upgrade command), SEA binary uses sea.ts (adds upgrade via extension hook)
