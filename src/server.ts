import { getConfig } from "./config.js";
import { app } from "./index.js";

export function startServer(): void {
  const { port } = getConfig();

  app.listen(port, () => {
    console.log("plex-monitor");
    console.log(`Listening on http://localhost:${port}`);
    console.log(`Webhook endpoint: POST http://localhost:${port}/`);
  });
}
