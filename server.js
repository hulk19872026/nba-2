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

// Web search proxy for NBA questions
app.get("/api/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.json({ answer: null });

  try {
    // Use Google's custom search or a scraping approach
    const searchQuery = encodeURIComponent(`NBA ${query}`);

    // Try multiple search sources
    let snippets = [];

    // Source 1: Google search via HTML scraping
    try {
      const googleResp = await fetch(`https://www.google.com/search?q=${searchQuery}&num=5`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (googleResp.ok) {
        const html = await googleResp.text();
        // Extract text snippets from search results
        const snippetMatches = html.match(/(?:class="BNeawe[^"]*"[^>]*>)([^<]{30,300})/g);
        if (snippetMatches) {
          snippets = snippetMatches
            .map(m => m.replace(/class="[^"]*"[^>]*>/g, "").trim())
            .filter(s => s.length > 30 && !s.includes("{") && !s.includes("function"))
            .slice(0, 6);
        }
        // Also try featured snippet / answer box patterns
        const featuredMatch = html.match(/class="hgKElc"[^>]*>([^<]+)/);
        if (featuredMatch) snippets.unshift(featuredMatch[1].trim());

        // Try data-md patterns (knowledge panel)
        const kpMatches = html.match(/data-md="[^"]*"[^>]*>([^<]{10,200})/g);
        if (kpMatches) {
          kpMatches.forEach(m => {
            const text = m.replace(/data-md="[^"]*"[^>]*>/g, "").trim();
            if (text.length > 10) snippets.push(text);
          });
        }
      }
    } catch {}

    // Source 2: DuckDuckGo instant answer API (simpler, more reliable)
    if (snippets.length < 2) {
      try {
        const ddgResp = await fetch(`https://api.duckduckgo.com/?q=${searchQuery}&format=json&no_html=1`);
        if (ddgResp.ok) {
          const ddg = await ddgResp.json();
          if (ddg.Abstract) snippets.push(ddg.Abstract);
          if (ddg.Answer) snippets.unshift(ddg.Answer);
          if (ddg.RelatedTopics) {
            ddg.RelatedTopics.slice(0, 3).forEach(t => {
              if (t.Text) snippets.push(t.Text);
            });
          }
        }
      } catch {}
    }

    // Source 3: ESPN search for game-specific queries
    if (snippets.length < 2 && /game|score|play|schedule|april|march|today|tomorrow/i.test(query)) {
      try {
        // Try ESPN scoreboard for dates
        const dateMatch = query.match(/(?:april|mar|march|feb|january|may)\s*(\d{1,2})/i);
        if (dateMatch) {
          const monthMap = { jan: "01", feb: "02", mar: "03", march: "03", april: "04", apr: "04", may: "05" };
          const monthWord = query.match(/(january|february|march|april|may|jan|feb|mar|apr)/i)?.[1]?.toLowerCase();
          const month = monthMap[monthWord] || "04";
          const day = dateMatch[1].padStart(2, "0");
          const year = new Date().getFullYear();
          const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${year}${month}${day}`;
          const espnResp = await fetch(espnUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; NBAAnalytics/1.0)" },
          });
          if (espnResp.ok) {
            const espnData = await espnResp.json();
            const events = espnData.events || [];
            if (events.length > 0) {
              const gameList = events.map(ev => {
                const comp = ev.competitions?.[0];
                const home = comp?.competitors?.find(c => c.homeAway === "home");
                const away = comp?.competitors?.find(c => c.homeAway === "away");
                const status = ev.status?.type?.shortDetail || "";
                const homeName = home?.team?.displayName || "";
                const awayName = away?.team?.displayName || "";
                const homeScore = home?.score || "";
                const awayScore = away?.score || "";
                if (status.includes("Final")) {
                  return `${awayName} ${awayScore} @ ${homeName} ${homeScore} (Final)`;
                }
                const time = new Date(ev.date).toLocaleTimeString("en-US", {
                  hour: "numeric", minute: "2-digit", timeZone: "America/New_York"
                }) + " ET";
                return `${awayName} @ ${homeName} — ${status || time}`;
              });
              snippets.unshift(`Games: ${gameList.join(" | ")}`);
            }
          }
        }
      } catch {}
    }

    if (snippets.length === 0) {
      return res.json({ answer: null });
    }

    // Deduplicate and clean
    const seen = new Set();
    const cleaned = snippets.filter(s => {
      const key = s.slice(0, 50).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);

    res.json({
      answer: cleaned.join("\n\n"),
      snippetCount: cleaned.length,
      query: query,
    });
  } catch (err) {
    console.error("Search error:", err.message);
    res.json({ answer: null });
  }
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`NBA Analytics server on port ${PORT}`);
});
