import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(join(__dirname, "dist")));

// NBA team metadata for enrichment
const TEAM_META = {
  ATL: { name:"Atlanta Hawks", abbr:"ATL" }, BOS: { name:"Boston Celtics", abbr:"BOS" },
  BKN: { name:"Brooklyn Nets", abbr:"BKN" }, CHA: { name:"Charlotte Hornets", abbr:"CHA" },
  CHI: { name:"Chicago Bulls", abbr:"CHI" }, CLE: { name:"Cleveland Cavaliers", abbr:"CLE" },
  DAL: { name:"Dallas Mavericks", abbr:"DAL" }, DEN: { name:"Denver Nuggets", abbr:"DEN" },
  DET: { name:"Detroit Pistons", abbr:"DET" }, GSW: { name:"Golden State Warriors", abbr:"GSW" },
  HOU: { name:"Houston Rockets", abbr:"HOU" }, IND: { name:"Indiana Pacers", abbr:"IND" },
  LAC: { name:"Los Angeles Clippers", abbr:"LAC" }, LAL: { name:"Los Angeles Lakers", abbr:"LAL" },
  MEM: { name:"Memphis Grizzlies", abbr:"MEM" }, MIA: { name:"Miami Heat", abbr:"MIA" },
  MIL: { name:"Milwaukee Bucks", abbr:"MIL" }, MIN: { name:"Minnesota Timberwolves", abbr:"MIN" },
  NOP: { name:"New Orleans Pelicans", abbr:"NOP" }, NYK: { name:"New York Knicks", abbr:"NYK" },
  OKC: { name:"Oklahoma City Thunder", abbr:"OKC" }, ORL: { name:"Orlando Magic", abbr:"ORL" },
  PHI: { name:"Philadelphia 76ers", abbr:"PHI" }, PHX: { name:"Phoenix Suns", abbr:"PHX" },
  POR: { name:"Portland Trail Blazers", abbr:"POR" }, SAC: { name:"Sacramento Kings", abbr:"SAC" },
  SAS: { name:"San Antonio Spurs", abbr:"SAS" }, TOR: { name:"Toronto Raptors", abbr:"TOR" },
  UTA: { name:"Utah Jazz", abbr:"UTA" }, WAS: { name:"Washington Wizards", abbr:"WAS" },
};

// ESPN uses slightly different abbreviations
const ESPN_ABBR_MAP = {
  GS: "GSW", SA: "SAS", NO: "NOP", NY: "NYK", WSH: "WAS", PHO: "PHX",
  UTAH: "UTA", BKLN: "BKN", CHA: "CHA", CHAR: "CHA",
};

function normalizeAbbr(abbr) {
  return ESPN_ABBR_MAP[abbr] || abbr;
}

let cachedGames = null;
let cacheTime = 0;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

async function fetchGamesFromESPN() {
  const now = Date.now();
  if (cachedGames && (now - cacheTime) < CACHE_TTL) return cachedGames;

  try {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NBAAnalytics/1.0)" },
    });
    if (!resp.ok) throw new Error(`ESPN API returned ${resp.status}`);
    const data = await resp.json();

    const games = (data.events || []).map((ev, i) => {
      const comp = ev.competitions?.[0];
      if (!comp) return null;

      const homeTeamData = comp.competitors?.find(c => c.homeAway === "home");
      const awayTeamData = comp.competitors?.find(c => c.homeAway === "away");
      if (!homeTeamData || !awayTeamData) return null;

      const homeAbbr = normalizeAbbr(homeTeamData.team?.abbreviation || "");
      const awayAbbr = normalizeAbbr(awayTeamData.team?.abbreviation || "");
      const homeName = homeTeamData.team?.displayName || homeTeamData.team?.name || "";
      const awayName = awayTeamData.team?.displayName || awayTeamData.team?.name || "";
      const homeRecord = homeTeamData.records?.[0]?.summary || "";
      const awayRecord = awayTeamData.records?.[0]?.summary || "";
      const homeScore = parseInt(homeTeamData.score) || 0;
      const awayScore = parseInt(awayTeamData.score) || 0;

      // Game status
      const status = ev.status?.type?.name || "STATUS_SCHEDULED";
      const statusDetail = ev.status?.type?.shortDetail || "";
      const gameTime = new Date(ev.date).toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
      }) + " ET";

      // Odds from ESPN if available
      let spread = null, overUnder = null;
      const odds = comp.odds?.[0];
      if (odds) {
        spread = odds.spread || null;
        overUnder = odds.overUnder || null;
      }

      return {
        id: i + 1,
        espnId: ev.id,
        home: homeName,
        away: awayName,
        homeAbbr,
        awayAbbr,
        homeRecord,
        awayRecord,
        homeScore,
        awayScore,
        status,       // STATUS_SCHEDULED, STATUS_IN_PROGRESS, STATUS_FINAL
        statusDetail,
        gameTime,
        date: new Date(ev.date).toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric",
          timeZone: "America/New_York",
        }),
        espnSpread: spread,
        espnOverUnder: overUnder,
      };
    }).filter(Boolean);

    cachedGames = games;
    cacheTime = now;
    return games;
  } catch (err) {
    console.error("ESPN fetch error:", err.message);
    if (cachedGames) return cachedGames; // stale cache fallback
    return null;
  }
}

app.get("/api/games", async (req, res) => {
  const games = await fetchGamesFromESPN();
  if (games) {
    res.json({ source: "espn", date: new Date().toISOString().slice(0, 10), games });
  } else {
    res.json({ source: "fallback", date: new Date().toISOString().slice(0, 10), games: [] });
  }
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`NBA Analytics server on port ${PORT}`);
});
