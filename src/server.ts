import app from "./";

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("🚀 Plex Discord Webhook Server");
  console.log(`📡 Listening on http://localhost:${port}`);
  console.log(`🎯 Webhook endpoint: http://localhost:${port}/`);
  console.log(`❤️  Health check: http://localhost:${port}/health`);
  console.log("\n📋 Environment:");
  console.log(`   DISCORD_WEBHOOK_URL: ${process.env.DISCORD_WEBHOOK_URL ? "✓ Set" : "✗ Not set"}`);
  console.log("\n💡 Test the webhook:");
  console.log(`   ./test-webhook.sh movie`);
  console.log(`   ./test-webhook.sh show`);
  console.log(`   ./test-webhook.sh season`);
});
