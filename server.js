import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(join(__dirname, "dist")));

// Proxy for Anthropic API
app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to reach Anthropic API" });
  }
});

// Proxy for balldontlie API
app.get("/api/players", async (req, res) => {
  try {
    const search = req.query.search || "";
    const resp = await fetch(
      `https://api.balldontlie.io/v1/players?search=${encodeURIComponent(search)}&per_page=5`,
      { headers: { Authorization: process.env.BALLDONTLIE_API_KEY || "" } }
    );
    const data = await resp.json();
    res.json(data);
  } catch {
    res.status(500).json({ data: [] });
  }
});

app.get("/api/season_averages", async (req, res) => {
  try {
    const playerId = req.query.player_id || "";
    const resp = await fetch(
      `https://api.balldontlie.io/v1/season_averages?season=2024&player_ids[]=${playerId}`,
      { headers: { Authorization: process.env.BALLDONTLIE_API_KEY || "" } }
    );
    const data = await resp.json();
    res.json(data);
  } catch {
    res.status(500).json({ data: [] });
  }
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
