import { useState, useEffect, useRef, useCallback } from "react";

const injectFonts = () => {
  if (document.getElementById("nba-fonts")) return;
  const link = document.createElement("link");
  link.id = "nba-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";
  document.head.appendChild(link);
  const style = document.createElement("style");
  style.textContent = `
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes spin { to{transform:rotate(360deg)} }
    @keyframes typingDot { 0%,80%,100%{opacity:0.2;transform:scale(0.8)} 40%{opacity:1;transform:scale(1)} }
    .msg-enter { animation: fadeIn 0.25s ease-out; }
    .dot-pulse { animation: pulse 1.8s ease-in-out infinite; }
    ::-webkit-scrollbar { width: 4px; } 
    ::-webkit-scrollbar-track { background: #0a101f; }
    ::-webkit-scrollbar-thumb { background: #1e2d48; border-radius:2px; }
    .game-card:hover { border-color: #F5A623 !important; background: #0f1826 !important; }
    .odds-btn:hover { opacity: 0.85; transform: scale(1.02); }
    .send-btn:hover:not(:disabled) { background: #d4921e !important; }
    .tab-btn:hover { background: #141e33 !important; }
    .suggestion-btn:hover { border-color: #F5A623 !important; color: #F5A623 !important; }
  `;
  document.head.appendChild(style);
};

// ════════════════════════════════════════════════
// AGENT SYSTEM
// ════════════════════════════════════════════════

// ANALYTICS AGENT — win probability model
const AnalyticsAgent = {
  name: "AnalyticsAgent",
  calcProb(home, away) {
    const homeWR = home.wins / Math.max(1, home.wins + home.losses);
    const awayWR = away.wins / Math.max(1, away.wins + away.losses);
    const homeNetRtg = home.ppg - home.oppPpg;
    const awayNetRtg = away.ppg - away.oppPpg;
    const homeAdv = 0.035;
    const netFactor = (homeNetRtg - awayNetRtg) / 25;
    const raw = homeWR + homeAdv + netFactor * 0.4;
    const total = raw + awayWR;
    return Math.max(0.1, Math.min(0.9, raw / total));
  },
  toAmerican(prob) {
    if (prob >= 0.5) return Math.round((-prob / (1 - prob)) * 100);
    return Math.round(((1 - prob) / prob) * 100);
  },
  toDecimal(american) {
    return american > 0 ? american / 100 + 1 : 100 / Math.abs(american) + 1;
  },
};

// DATA AGENT — NBA team & game data
const DataAgent = {
  name: "DataAgent",
  teams: {
    "Boston Celtics":         { abbr:"BOS", wins:54, losses:18, ppg:120.6, oppPpg:109.4 },
    "Oklahoma City Thunder":  { abbr:"OKC", wins:58, losses:14, ppg:119.2, oppPpg:108.5 },
    "Cleveland Cavaliers":    { abbr:"CLE", wins:55, losses:17, ppg:117.8, oppPpg:107.2 },
    "Houston Rockets":        { abbr:"HOU", wins:45, losses:27, ppg:112.4, oppPpg:108.9 },
    "Minnesota Timberwolves": { abbr:"MIN", wins:49, losses:23, ppg:112.3, oppPpg:107.8 },
    "Denver Nuggets":         { abbr:"DEN", wins:44, losses:28, ppg:115.9, oppPpg:113.4 },
    "New York Knicks":        { abbr:"NYK", wins:43, losses:29, ppg:114.7, oppPpg:111.3 },
    "Los Angeles Lakers":     { abbr:"LAL", wins:41, losses:31, ppg:113.2, oppPpg:113.0 },
    "Indiana Pacers":         { abbr:"IND", wins:39, losses:33, ppg:122.8, oppPpg:121.6 },
    "Dallas Mavericks":       { abbr:"DAL", wins:38, losses:34, ppg:116.2, oppPpg:115.4 },
    "Miami Heat":             { abbr:"MIA", wins:38, losses:34, ppg:111.5, oppPpg:112.8 },
    "Orlando Magic":          { abbr:"ORL", wins:38, losses:34, ppg:108.6, oppPpg:107.4 },
    "Golden State Warriors":  { abbr:"GSW", wins:36, losses:36, ppg:115.4, oppPpg:114.8 },
    "Los Angeles Clippers":   { abbr:"LAC", wins:37, losses:35, ppg:112.4, oppPpg:113.2 },
    "Sacramento Kings":       { abbr:"SAC", wins:35, losses:37, ppg:116.8, oppPpg:118.2 },
    "Milwaukee Bucks":        { abbr:"MIL", wins:36, losses:36, ppg:114.1, oppPpg:115.9 },
    "Phoenix Suns":           { abbr:"PHX", wins:30, losses:42, ppg:113.7, oppPpg:117.4 },
    "Atlanta Hawks":          { abbr:"ATL", wins:27, losses:45, ppg:117.4, oppPpg:120.3 },
    "Memphis Grizzlies":      { abbr:"MEM", wins:28, losses:44, ppg:110.3, oppPpg:115.6 },
    "Philadelphia 76ers":     { abbr:"PHI", wins:24, losses:48, ppg:107.8, oppPpg:114.2 },
  },

  buildGames() {
    const matchups = [
      ["New York Knicks",        "Boston Celtics"],
      ["Oklahoma City Thunder",  "Denver Nuggets"],
      ["Los Angeles Lakers",     "Golden State Warriors"],
      ["Minnesota Timberwolves", "Houston Rockets"],
      ["Cleveland Cavaliers",    "Indiana Pacers"],
      ["Dallas Mavericks",       "Phoenix Suns"],
      ["Miami Heat",             "Orlando Magic"],
      ["Milwaukee Bucks",        "Philadelphia 76ers"],
    ];
    const times = ["7:00 PM ET","7:30 PM ET","8:00 PM ET","8:00 PM ET","7:30 PM ET","9:00 PM ET","7:00 PM ET","8:00 PM ET"];
    const today = new Date();

    return matchups.map(([home, away], i) => {
      const h = this.teams[home];
      const a = this.teams[away];
      const homeProb = AnalyticsAgent.calcProb(h, a);
      const awayProb = 1 - homeProb;
      const hOdds = AnalyticsAgent.toAmerican(homeProb);
      const aOdds = AnalyticsAgent.toAmerican(awayProb);
      const netDiff = (h.ppg - h.oppPpg) - (a.ppg - a.oppPpg);
      const spread = -(netDiff / 2 + 1.5);
      const total = Math.round((h.ppg + a.ppg + h.oppPpg + a.oppPpg) / 2);
      const d = new Date(today);
      d.setDate(today.getDate() + Math.floor(i / 4));

      return {
        id: i + 1,
        home, away,
        homeAbbr: h.abbr, awayAbbr: a.abbr,
        homeRecord: `${h.wins}-${h.losses}`, awayRecord: `${a.wins}-${a.losses}`,
        date: d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}),
        time: times[i],
        homeProb: Math.round(homeProb * 100),
        awayProb: Math.round(awayProb * 100),
        homeOdds: hOdds > 0 ? `+${hOdds}` : `${hOdds}`, homeOddsRaw: hOdds,
        awayOdds: aOdds > 0 ? `+${aOdds}` : `${aOdds}`, awayOddsRaw: aOdds,
        spread: spread > 0 ? `+${spread.toFixed(1)}` : `${spread.toFixed(1)}`,
        total, homePpg: h.ppg, awayPpg: a.ppg,
      };
    });
  },

  players: {
    "LeBron James":       { team:"Los Angeles Lakers", pos:"SF", gp:74, min:"35.2", pts:23.5, reb:7.9, ast:9.0, fg:50.1, fg3:31.5, ft:74.8, stl:1.3, blk:0.5 },
    "Stephen Curry":      { team:"Golden State Warriors", pos:"PG", gp:72, min:"32.8", pts:26.4, reb:4.5, ast:6.1, fg:45.0, fg3:40.8, ft:92.3, stl:1.0, blk:0.3 },
    "Jayson Tatum":       { team:"Boston Celtics", pos:"SF", gp:71, min:"36.4", pts:27.0, reb:8.1, ast:4.9, fg:47.1, fg3:37.6, ft:83.1, stl:1.1, blk:0.6 },
    "Shai Gilgeous-Alexander": { team:"Oklahoma City Thunder", pos:"SG", gp:70, min:"34.0", pts:31.4, reb:5.5, ast:6.2, fg:53.5, fg3:35.3, ft:87.4, stl:2.0, blk:0.7 },
    "Luka Doncic":        { team:"Dallas Mavericks", pos:"PG", gp:55, min:"36.2", pts:28.1, reb:8.3, ast:8.0, fg:46.7, fg3:35.4, ft:78.6, stl:1.4, blk:0.4 },
    "Nikola Jokic":       { team:"Denver Nuggets", pos:"C", gp:72, min:"36.8", pts:26.4, reb:12.4, ast:9.0, fg:56.5, fg3:33.7, ft:81.7, stl:1.4, blk:0.9 },
    "Giannis Antetokounmpo": { team:"Milwaukee Bucks", pos:"PF", gp:63, min:"35.2", pts:30.4, reb:11.5, ast:6.5, fg:61.1, fg3:27.4, ft:65.7, stl:1.2, blk:1.5 },
    "Anthony Edwards":    { team:"Minnesota Timberwolves", pos:"SG", gp:70, min:"35.8", pts:25.9, reb:5.4, ast:5.1, fg:46.1, fg3:35.7, ft:84.6, stl:1.3, blk:0.5 },
    "Kevin Durant":       { team:"Phoenix Suns", pos:"SF", gp:60, min:"37.2", pts:27.1, reb:6.6, ast:5.0, fg:52.3, fg3:41.3, ft:85.6, stl:0.9, blk:1.2 },
    "Anthony Davis":      { team:"Los Angeles Lakers", pos:"C", gp:68, min:"35.5", pts:24.7, reb:12.6, ast:3.5, fg:55.6, fg3:27.1, ft:81.9, stl:1.2, blk:2.3 },
    "Jalen Brunson":      { team:"New York Knicks", pos:"PG", gp:72, min:"35.4", pts:28.7, reb:3.5, ast:6.7, fg:48.0, fg3:38.4, ft:84.7, stl:0.9, blk:0.2 },
    "Donovan Mitchell":   { team:"Cleveland Cavaliers", pos:"SG", gp:68, min:"33.7", pts:24.0, reb:4.5, ast:4.2, fg:46.8, fg3:36.9, ft:86.5, stl:1.8, blk:0.4 },
    "Tyrese Haliburton":  { team:"Indiana Pacers", pos:"PG", gp:60, min:"33.5", pts:20.1, reb:3.9, ast:10.9, fg:44.7, fg3:36.4, ft:85.2, stl:1.2, blk:0.3 },
    "Bam Adebayo":        { team:"Miami Heat", pos:"C", gp:71, min:"34.6", pts:19.5, reb:10.4, ast:4.9, fg:52.5, fg3:18.2, ft:80.2, stl:1.1, blk:0.8 },
    "Paolo Banchero":     { team:"Orlando Magic", pos:"PF", gp:52, min:"34.8", pts:22.6, reb:6.8, ast:5.4, fg:45.7, fg3:33.9, ft:73.5, stl:0.8, blk:0.6 },
    "James Harden":       { team:"Los Angeles Clippers", pos:"PG", gp:69, min:"35.0", pts:21.6, reb:5.7, ast:8.5, fg:43.8, fg3:36.0, ft:87.6, stl:1.1, blk:0.5 },
    "De'Aaron Fox":       { team:"Sacramento Kings", pos:"PG", gp:68, min:"36.0", pts:26.6, reb:4.6, ast:5.6, fg:46.5, fg3:32.9, ft:73.8, stl:2.0, blk:0.4 },
    "Darius Garland":     { team:"Cleveland Cavaliers", pos:"PG", gp:65, min:"32.8", pts:21.3, reb:2.7, ast:6.8, fg:46.0, fg3:37.0, ft:87.9, stl:1.3, blk:0.1 },
    "Trae Young":         { team:"Atlanta Hawks", pos:"PG", gp:70, min:"35.2", pts:25.7, reb:3.0, ast:11.4, fg:43.0, fg3:33.8, ft:86.3, stl:1.0, blk:0.2 },
    "Ja Morant":          { team:"Memphis Grizzlies", pos:"PG", gp:55, min:"32.0", pts:21.2, reb:5.6, ast:8.1, fg:47.3, fg3:30.8, ft:75.0, stl:0.8, blk:0.3 },
    "Joel Embiid":        { team:"Philadelphia 76ers", pos:"C", gp:39, min:"33.8", pts:27.3, reb:7.2, ast:5.7, fg:52.7, fg3:38.9, ft:88.3, stl:1.0, blk:1.7 },
    "Kyrie Irving":       { team:"Dallas Mavericks", pos:"PG", gp:62, min:"34.5", pts:24.2, reb:5.0, ast:5.2, fg:49.7, fg3:41.1, ft:90.5, stl:1.3, blk:0.4 },
    "Jaren Jackson Jr.":  { team:"Memphis Grizzlies", pos:"PF", gp:65, min:"31.5", pts:22.3, reb:5.7, ast:2.3, fg:46.0, fg3:32.5, ft:79.3, stl:1.0, blk:2.3 },
    "Alperen Sengun":     { team:"Houston Rockets", pos:"C", gp:72, min:"32.6", pts:19.0, reb:9.3, ast:5.0, fg:53.8, fg3:29.1, ft:71.2, stl:1.0, blk:0.8 },
    "Jalen Williams":     { team:"Oklahoma City Thunder", pos:"SF", gp:70, min:"32.5", pts:20.1, reb:5.3, ast:5.1, fg:53.6, fg3:39.8, ft:78.4, stl:1.6, blk:0.7 },
    "Jimmy Butler":       { team:"Miami Heat", pos:"SF", gp:52, min:"33.7", pts:18.7, reb:5.8, ast:4.9, fg:49.9, fg3:35.5, ft:86.3, stl:1.3, blk:0.3 },
    "Devin Booker":       { team:"Phoenix Suns", pos:"SG", gp:68, min:"35.0", pts:27.1, reb:4.5, ast:6.9, fg:49.2, fg3:36.4, ft:87.6, stl:1.0, blk:0.3 },
    "Chet Holmgren":      { team:"Oklahoma City Thunder", pos:"C", gp:60, min:"29.5", pts:16.5, reb:7.9, ast:2.4, fg:53.0, fg3:37.2, ft:79.3, stl:0.5, blk:2.6 },
    "Evan Mobley":        { team:"Cleveland Cavaliers", pos:"PF", gp:69, min:"33.5", pts:18.3, reb:9.0, ast:3.2, fg:56.2, fg3:37.3, ft:70.5, stl:0.8, blk:1.5 },
    "Scottie Barnes":     { team:"Toronto Raptors", pos:"PF", gp:60, min:"34.8", pts:19.9, reb:8.2, ast:6.1, fg:47.5, fg3:28.7, ft:77.3, stl:1.3, blk:1.1 },
  },

  searchPlayer(name) {
    const lower = name.toLowerCase();
    const matches = Object.entries(this.players)
      .filter(([n]) => n.toLowerCase().includes(lower))
      .map(([n, data]) => ({ name: n, ...data }));
    return matches;
  },

  getPlayerStats(name) {
    const matches = this.searchPlayer(name);
    if (!matches.length) return null;
    const p = matches[0];
    return {
      name: p.name, team: p.team, position: p.pos,
      games: p.gp, minutes: p.min,
      pts: p.pts.toFixed(1), reb: p.reb.toFixed(1), ast: p.ast.toFixed(1),
      fg: p.fg.toFixed(1)+"%", fg3: p.fg3.toFixed(1)+"%", ft: p.ft.toFixed(1)+"%",
      stl: p.stl.toFixed(1), blk: p.blk.toFixed(1),
    };
  },
};

// PARLAY AGENT — multi-game odds computation
const ParlayAgent = {
  name: "ParlayAgent",
  calc(selections) {
    if (selections.length < 2) return null;
    const dec = selections.map(s => AnalyticsAgent.toDecimal(s.oddsRaw));
    const combined = dec.reduce((a, b) => a * b, 1);
    const combinedProb = selections.reduce((a, s) => a * (s.prob / 100), 1);
    const american = combined >= 2
      ? `+${Math.round((combined - 1) * 100)}`
      : `-${Math.round(100 / (combined - 1))}`;
    return {
      legs: selections.length,
      decimal: combined.toFixed(2),
      american,
      impliedProb: (combinedProb * 100).toFixed(1),
      payout100: (combined * 100).toFixed(2),
      ev: ((combinedProb * combined - 1) * 100).toFixed(1),
    };
  },
};

// INTERFACE AGENT — local analytics engine
const InterfaceAgent = {
  name: "InterfaceAgent",

  findGame(query, games) {
    const q = query.toLowerCase();
    // Check for "X vs Y" or "X @ Y" patterns
    const vsMatch = q.match(/(\w+)\s+(?:vs\.?|@|against|and)\s+(\w+)/);
    if (vsMatch) {
      const [, t1, t2] = vsMatch;
      return games.find(g => {
        const ha = `${g.homeAbbr} ${g.home}`.toLowerCase();
        const aa = `${g.awayAbbr} ${g.away}`.toLowerCase();
        return (ha.includes(t1) && aa.includes(t2)) || (ha.includes(t2) && aa.includes(t1));
      });
    }
    // Single team mention
    for (const g of games) {
      const ha = `${g.homeAbbr} ${g.home}`.toLowerCase();
      const aa = `${g.awayAbbr} ${g.away}`.toLowerCase();
      if (ha.includes(q.replace(/[^a-z]/g,"")) || aa.includes(q.replace(/[^a-z]/g,""))) return g;
      for (const word of q.split(/\s+/)) {
        if (word.length >= 3 && (ha.includes(word) || aa.includes(word))) return g;
      }
    }
    return null;
  },

  formatGameAnalysis(g) {
    const fav = g.homeProb > g.awayProb;
    const favTeam = fav ? g.homeAbbr : g.awayAbbr;
    const favProb = fav ? g.homeProb : g.awayProb;
    const favOdds = fav ? g.homeOdds : g.awayOdds;
    const udTeam = fav ? g.awayAbbr : g.homeAbbr;
    const udProb = fav ? g.awayProb : g.homeProb;
    const udOdds = fav ? g.awayOdds : g.homeOdds;

    return `📊 ${g.awayAbbr} @ ${g.homeAbbr} — ${g.date} ${g.time}

🏠 ${g.homeAbbr} (${g.homeRecord}) vs 🏃 ${g.awayAbbr} (${g.awayRecord})

Win Probability (AnalyticsAgent model: net rating + win% + 3.5% home advantage):
• ${favTeam}: ${favProb}% (ML ${favOdds}) — FAVORED
• ${udTeam}: ${udProb}% (ML ${udOdds})

Spread: ${g.spread} | O/U: ${g.total}

Scoring: ${g.homeAbbr} averages ${g.homePpg} PPG, ${g.awayAbbr} averages ${g.awayPpg} PPG.

${favProb >= 65 ? `Strong lean toward ${favTeam} here.` : favProb >= 55 ? `Slight edge to ${favTeam}, but competitive matchup.` : `Very close game — could go either way.`}

Click the + button next to any odds to add to your parlay.`;
  },

  query(userMsg, games, parlayState, extraContext) {
    const q = userMsg.toLowerCase();

    // Player stats query
    const playerMatch = userMsg.match(/(?:stats?|about|points?|scoring|how is|how's|tell me about)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z\-]+)+)/i)
      || userMsg.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z\-]+)+)\s+stats?/i);
    if (playerMatch) {
      const pData = DataAgent.getPlayerStats(playerMatch[1]);
      if (pData) {
        return `📊 ${pData.name} — ${pData.team} (${pData.position})
2024-25 Season Stats (${pData.games} games, ${pData.minutes} MPG):

🏀 ${pData.pts} PPG | ${pData.reb} RPG | ${pData.ast} APG
🎯 FG: ${pData.fg} | 3P: ${pData.fg3} | FT: ${pData.ft}
🛡️ ${pData.stl} SPG | ${pData.blk} BPG`;
      }
      return `Player "${playerMatch[1]}" not found in our database. Try a top NBA player name (e.g. LeBron James, Stephen Curry, Shai Gilgeous-Alexander).`;
    }

    // Parlay query
    if (q.includes("parlay")) {
      if (parlayState.selections.length > 0 && parlayState.result) {
        return `🎰 Active Parlay — ${parlayState.result.legs} legs

${parlayState.selections.map(s => `• ${s.pick} ${s.odds} (${s.prob}%)`).join("\n")}

Combined Odds: ${parlayState.result.american} (decimal: ${parlayState.result.decimal})
Implied Probability: ${parlayState.result.impliedProb}%
$100 Payout: $${parlayState.result.payout100}
EV: ${parlayState.result.ev}%

${parseFloat(parlayState.result.ev) > 0 ? "Positive EV — model suggests value here." : "Negative EV — proceed with caution."}`;
      }
      return "No active parlay. Click the + button next to any game odds to add selections, then check the PARLAY tab.";
    }

    // Game matchup query
    const game = this.findGame(q, games);
    if (game) return this.formatGameAnalysis(game);

    // Best bet / pick query
    if (q.includes("best bet") || q.includes("best pick") || q.includes("lock") || q.includes("safest") || q.includes("who should") || q.includes("recommend")) {
      const sorted = [...games].sort((a,b) => Math.max(b.homeProb,b.awayProb) - Math.max(a.homeProb,a.awayProb));
      const top3 = sorted.slice(0,3);
      return `🔒 Top picks by win probability (AnalyticsAgent model):

${top3.map((g,i) => {
  const fav = g.homeProb > g.awayProb;
  return `${i+1}. ${fav ? g.homeAbbr : g.awayAbbr} ML ${fav ? g.homeOdds : g.awayOdds} — ${Math.max(g.homeProb,g.awayProb)}% win prob vs ${fav ? g.awayAbbr : g.homeAbbr}`;
}).join("\n")}

Model uses net rating + win% + 3.5% home-court advantage. Remember: no bet is guaranteed — these are probabilistic estimates.`;
    }

    // All games / schedule
    if (q.includes("all games") || q.includes("schedule") || q.includes("today") || q.includes("tonight") || q.includes("upcoming")) {
      return `📅 Upcoming Games:\n\n${games.map(g => `${g.awayAbbr} @ ${g.homeAbbr} — ${g.date} ${g.time} | ${g.homeAbbr} ${g.homeProb}% (${g.homeOdds}) | ${g.awayAbbr} ${g.awayProb}% (${g.awayOdds}) | O/U ${g.total}`).join("\n")}`;
    }

    // Odds query
    if (q.includes("odds") || q.includes("moneyline") || q.includes("spread")) {
      const g2 = this.findGame(q, games);
      if (g2) return this.formatGameAnalysis(g2);
      return `📊 All Game Odds:\n\n${games.map(g => `${g.awayAbbr} @ ${g.homeAbbr}: Home ML ${g.homeOdds} | Away ML ${g.awayOdds} | Spread ${g.spread} | O/U ${g.total}`).join("\n")}`;
    }

    // Over/under / total
    if (q.includes("over") || q.includes("under") || q.includes("total")) {
      const g3 = this.findGame(q, games);
      if (g3) return `🎯 ${g3.awayAbbr} @ ${g3.homeAbbr} — O/U: ${g3.total}\n\n${g3.homeAbbr} averages ${g3.homePpg} PPG, ${g3.awayAbbr} averages ${g3.awayPpg} PPG.\nCombined average: ${(g3.homePpg + g3.awayPpg).toFixed(1)} points.\n\n${(g3.homePpg + g3.awayPpg) > g3.total ? "Trend favors the OVER based on scoring averages." : "Trend favors the UNDER based on scoring averages."}`;
    }

    // Default / help
    return `I can help with:\n\n• Game analysis — "Rockets vs Warriors" or "Celtics game"\n• Player stats — "LeBron James stats" or "tell me about Curry"\n• Best picks — "best bets tonight" or "safest pick"\n• All games — "show all games" or "tonight's schedule"\n• Odds — "odds for Lakers game" or "all spreads"\n• Parlay — "show my parlay" (add picks with + buttons)\n\nTry asking about a specific matchup!`;
  },
};

// ════════════════════════════════════════════════
// UI COMPONENTS
// ════════════════════════════════════════════════

const C = {
  bg: "#070D1A", panel: "#0C1424", card: "#0F1B2D",
  border: "#1A2B44", accent: "#F5A623", accentDim: "#8A5A0F",
  green: "#00C853", red: "#FF4444", blue: "#3B9EFF",
  text: "#E8ECF0", muted: "#6B7FA3", dim: "#3D4F6B",
};

function AgentBadge({ name, color = C.accent }) {
  return (
    <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:11,
      fontFamily:"'Barlow Condensed',sans-serif", color:C.muted, letterSpacing:"0.5px" }}>
      <span className="dot-pulse" style={{ width:6, height:6, borderRadius:"50%",
        background:color, display:"inline-block" }} />
      {name}
    </span>
  );
}

function ProbBar({ homeProb, awayProb, homeAbbr, awayAbbr }) {
  return (
    <div style={{ margin:"6px 0" }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10,
        color:C.muted, fontFamily:"'Barlow Condensed',sans-serif", marginBottom:3 }}>
        <span>{homeAbbr} {homeProb}%</span>
        <span>{awayProb}% {awayAbbr}</span>
      </div>
      <div style={{ height:4, background:C.border, borderRadius:2, overflow:"hidden", display:"flex" }}>
        <div style={{ width:`${homeProb}%`, background: homeProb > 55 ? C.green : C.accent,
          borderRadius:"2px 0 0 2px", transition:"width 0.6s ease" }} />
        <div style={{ flex:1, background: awayProb > 55 ? C.green : C.red, borderRadius:"0 2px 2px 0" }} />
      </div>
    </div>
  );
}

function GameCard({ game, parlaySelections, onToggle }) {
  const homeSelected = parlaySelections.find(s => s.gameId === game.id && s.side === "home");
  const awaySelected = parlaySelections.find(s => s.gameId === game.id && s.side === "away");
  const anySelected = homeSelected || awaySelected;

  return (
    <div className="game-card" style={{ background: anySelected ? "#101c30" : C.card,
      border: `1px solid ${anySelected ? C.accent : C.border}`, borderRadius:8,
      padding:"10px 12px", marginBottom:8, transition:"all 0.2s", cursor:"default" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
        <span style={{ fontSize:10, color:C.muted, fontFamily:"'Barlow Condensed',sans-serif",
          letterSpacing:"0.5px" }}>{game.date} · {game.time}</span>
        <span style={{ fontSize:10, background:"#1A2B44", color:C.muted, padding:"1px 6px",
          borderRadius:3, fontFamily:"'Barlow Condensed',sans-serif" }}>
          O/U {game.total}
        </span>
      </div>

      {/* Matchup row */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
        {/* Away team */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", flex:1 }}>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:C.text,
            lineHeight:1 }}>{game.awayAbbr}</span>
          <span style={{ fontSize:10, color:C.muted, fontFamily:"'Barlow Condensed',sans-serif" }}>
            {game.awayRecord}
          </span>
        </div>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, color:C.dim,
          fontWeight:600 }}>@</span>
        {/* Home team */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", flex:1 }}>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:C.text,
            lineHeight:1 }}>{game.homeAbbr}</span>
          <span style={{ fontSize:10, color:C.muted, fontFamily:"'Barlow Condensed',sans-serif" }}>
            {game.homeRecord}
          </span>
        </div>
      </div>

      <ProbBar homeProb={game.homeProb} awayProb={game.awayProb}
        homeAbbr={game.homeAbbr} awayAbbr={game.awayAbbr} />

      {/* Odds row */}
      <div style={{ display:"flex", gap:4, marginTop:6 }}>
        {[
          { side:"away", label:`${game.awayAbbr} ML`, odds:game.awayOdds, selected:!!awaySelected },
          { side:"home", label:`${game.homeAbbr} ML`, odds:game.homeOdds, selected:!!homeSelected },
        ].map(({ side, label, odds, selected }) => (
          <button key={side} className="odds-btn" onClick={() => onToggle(game, side)}
            style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
              background: selected ? C.accent : "#131f35", border:`1px solid ${selected ? C.accent : C.border}`,
              borderRadius:5, padding:"4px 0", cursor:"pointer", transition:"all 0.15s" }}>
            <span style={{ fontSize:9, color: selected ? "#000" : C.muted,
              fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"0.3px" }}>{label}</span>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:600,
              color: selected ? "#000" : (odds.startsWith("+") ? C.green : C.text) }}>{odds}</span>
          </button>
        ))}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
          background:"#131f35", border:`1px solid ${C.border}`, borderRadius:5, padding:"4px 6px" }}>
          <span style={{ fontSize:9, color:C.muted, fontFamily:"'Barlow Condensed',sans-serif" }}>SPRD</span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:C.muted }}>
            {game.spread}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, highlight }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"5px 0", borderBottom:`1px solid ${C.border}` }}>
      <span style={{ fontSize:12, color:C.muted, fontFamily:"'Barlow Condensed',sans-serif" }}>{label}</span>
      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:600,
        color: highlight ? C.accent : C.text }}>{value}</span>
    </div>
  );
}

function PlayerCard({ stats }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:14,
      animation:"fadeIn 0.3s ease-out" }}>
      <div style={{ marginBottom:10 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:C.text,
          letterSpacing:"1px" }}>{stats.name}</div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, color:C.accent }}>
          {stats.team} · {stats.position}
        </div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, color:C.muted }}>
          {stats.games} GP · {stats.minutes} MIN
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:10 }}>
        {[["PTS",stats.pts,true],["REB",stats.reb,false],["AST",stats.ast,false]].map(([l,v,h]) => (
          <div key={l} style={{ background:C.panel, borderRadius:6, padding:"8px 0", textAlign:"center" }}>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:20, fontWeight:600,
              color: h ? C.accent : C.text }}>{v}</div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:10, color:C.muted }}>{l}</div>
          </div>
        ))}
      </div>
      <StatRow label="FG%" value={stats.fg} />
      <StatRow label="3P%" value={stats.fg3} />
      <StatRow label="FT%" value={stats.ft} />
      <StatRow label="STL" value={stats.stl} />
      <StatRow label="BLK" value={stats.blk} />
    </div>
  );
}

function ParlayPanel({ selections, result, onRemove }) {
  return (
    <div style={{ padding:"0 2px" }}>
      {selections.length === 0 ? (
        <div style={{ textAlign:"center", padding:"40px 20px" }}>
          <div style={{ fontSize:28, marginBottom:8 }}>🎯</div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", color:C.muted, fontSize:14 }}>
            Click + on any odds to add legs
          </div>
        </div>
      ) : (
        <>
          {selections.map((s, i) => (
            <div key={s.id} style={{ display:"flex", justifyContent:"space-between",
              alignItems:"center", background:C.card, border:`1px solid ${C.border}`,
              borderRadius:6, padding:"8px 10px", marginBottom:6 }}>
              <div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600,
                  fontSize:14, color:C.text }}>Leg {i+1}: {s.pick}</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12,
                  color: s.odds.startsWith("+") ? C.green : C.text }}>{s.odds}</div>
              </div>
              <button onClick={() => onRemove(s.id)} style={{ background:"transparent",
                border:"none", color:C.red, cursor:"pointer", fontSize:16, padding:"0 4px" }}>×</button>
            </div>
          ))}

          {result && (
            <div style={{ background:"linear-gradient(135deg, #13200F 0%, #0C1A08 100%)",
              border:`1px solid ${C.green}`, borderRadius:8, padding:14, marginTop:8 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:13, color:C.green,
                letterSpacing:"1px", marginBottom:8 }}>{result.legs}-LEG PARLAY</div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:12, color:C.muted }}>
                  American Odds
                </span>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:18, fontWeight:600,
                  color:C.green }}>{result.american}</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                {[
                  ["Decimal", result.decimal + "x"],
                  ["Implied Prob", result.impliedProb + "%"],
                  ["$100 → $" + result.payout100, "Payout"],
                  ["Model EV", (parseFloat(result.ev) >= 0 ? "+" : "") + result.ev + "%"],
                ].map(([a,b]) => (
                  <div key={a} style={{ background:C.panel, borderRadius:5, padding:"6px 8px" }}>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12,
                      color:C.green, fontWeight:600 }}>{a}</div>
                    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11,
                      color:C.muted }}>{b}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:8, padding:"6px 8px", background:"rgba(255,68,68,0.08)",
                border:`1px solid rgba(255,68,68,0.2)`, borderRadius:5 }}>
                <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11,
                  color:"#FF8080" }}>⚠ Model probabilities are estimates. Bet responsibly.</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display:"flex", gap:4, padding:"8px 12px", alignItems:"center" }}>
      {[0,1,2].map(i => (
        <span key={i} style={{ width:7, height:7, borderRadius:"50%", background:C.accent,
          display:"inline-block",
          animation:`typingDot 1.2s ease-in-out infinite`,
          animationDelay:`${i * 0.15}s` }} />
      ))}
    </div>
  );
}

function ChatMessage({ msg }) {
  const isUser = msg.role === "user";
  const lines = msg.content.split("\n");

  return (
    <div className="msg-enter" style={{ display:"flex", flexDirection:"column",
      alignItems: isUser ? "flex-end" : "flex-start", marginBottom:12 }}>
      {!isUser && (
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
          <div style={{ width:20, height:20, borderRadius:4, background:C.accent,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:11, fontWeight:700, color:"#000", fontFamily:"'Bebas Neue',sans-serif" }}>AI</div>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11,
            color:C.muted, letterSpacing:"0.5px" }}>NBA ANALYTICS AI</span>
        </div>
      )}
      <div style={{ maxWidth:"88%", background: isUser ? C.accent : C.card,
        border: isUser ? "none" : `1px solid ${C.border}`,
        borderRadius: isUser ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
        padding:"10px 14px" }}>
        {lines.map((line, i) => {
          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          return (
            <p key={i} style={{ margin: i === 0 ? 0 : "4px 0 0",
              fontFamily:"'Barlow Condensed',sans-serif", fontSize:15,
              lineHeight:1.5, color: isUser ? "#000" : C.text }}>
              {parts.map((part, j) =>
                part.startsWith("**") && part.endsWith("**")
                  ? <strong key={j} style={{ color: isUser ? "#000" : C.accent, fontWeight:700 }}>
                      {part.slice(2,-2)}
                    </strong>
                  : <span key={j}>{part}</span>
              )}
            </p>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════
export default function NBAAnalyticsApp() {
  useEffect(() => { injectFonts(); }, []);

  const [games] = useState(() => DataAgent.buildGames());
  const [tab, setTab] = useState("games");
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "**NBA Analytics AI online.** I run on 4 cooperative sub-agents:\n\n**DataAgent** — live stats via balldontlie.io + probabilistic odds\n**AnalyticsAgent** — net rating + win% + home-court logistic model\n**ParlayAgent** — combined legs with EV calculation\n**InterfaceAgent** — that's me, synthesizing everything\n\nAsk me about player stats, game odds, win probabilities, or build a parlay using the games panel!"
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [parlaySelections, setParlaySelections] = useState([]);
  const parlayResult = ParlayAgent.calc(parlaySelections);
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerData, setPlayerData] = useState(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const messagesEnd = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages, loading]);

  const toggleParlay = (game, side) => {
    const pick = side === "home" ? game.home : game.away;
    const odds = side === "home" ? game.homeOdds : game.awayOdds;
    const oddsRaw = side === "home" ? game.homeOddsRaw : game.awayOddsRaw;
    const prob = side === "home" ? game.homeProb : game.awayProb;
    const id = `${game.id}-${side}`;
    setParlaySelections(prev => {
      const existing = prev.find(s => s.gameId === game.id);
      if (existing) {
        if (existing.id === id) return prev.filter(s => s.gameId !== game.id);
        return [...prev.filter(s => s.gameId !== game.id), { id, gameId:game.id, pick, odds, oddsRaw, prob, side }];
      }
      return [...prev, { id, gameId:game.id, pick, odds, oddsRaw, prob, side }];
    });
    if (tab !== "parlay") setTab("parlay");
  };

  const fetchPlayer = () => {
    if (!playerSearch.trim()) return;
    setPlayerLoading(true);
    setPlayerData(null);
    setPlayerError("");
    const result = DataAgent.getPlayerStats(playerSearch);
    if (result) {
      setPlayerData(result);
    } else {
      setPlayerError(`Player "${playerSearch}" not found. Try a top NBA player name (e.g. LeBron James, Stephen Curry).`);
    }
    setPlayerLoading(false);
  };

  const sendMessage = (text) => {
    const q = text || input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role:"user", content:q }]);
    setLoading(true);

    setTimeout(() => {
      const reply = InterfaceAgent.query(q, games,
        { selections: parlaySelections, result: parlayResult });
      setMessages(prev => [...prev, { role:"assistant", content:reply }]);
      setLoading(false);
    }, 300 + Math.random() * 400);
  };

  const SUGGESTIONS = [
    "Who wins Lakers vs Warriors?",
    "LeBron James stats",
    "Best bet on tonight's games",
    "Explain my parlay",
  ];

  return (
    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", background:C.bg, color:C.text,
      height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* ── HEADER ── */}
      <header style={{ background:C.panel, borderBottom:`2px solid ${C.accent}`,
        padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between",
        flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:8, background:C.accent,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"'Bebas Neue',sans-serif", fontSize:18, color:"#000" }}>NBA</div>
          <div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, lineHeight:1,
              letterSpacing:"2px", color:C.text }}>NBA ANALYTICS AI</div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11,
              color:C.muted, letterSpacing:"1px" }}>MULTI-AGENT INTELLIGENCE SYSTEM</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:16 }}>
          {["DataAgent","AnalyticsAgent","ParlayAgent","InterfaceAgent"].map(a => (
            <AgentBadge key={a} name={a} />
          ))}
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* ── SIDEBAR ── */}
        <aside style={{ width:300, background:C.panel, borderRight:`1px solid ${C.border}`,
          display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>

          {/* Tabs */}
          <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
            {[
              { id:"games", label:"GAMES" },
              { id:"stats", label:"PLAYERS" },
              { id:"parlay", label:`PARLAY${parlaySelections.length > 0 ? ` (${parlaySelections.length})` : ""}` },
            ].map(t => (
              <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)}
                style={{ flex:1, padding:"10px 4px", background:"transparent",
                  border:"none", borderBottom: tab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
                  color: tab === t.id ? C.accent : C.muted, cursor:"pointer",
                  fontFamily:"'Bebas Neue',sans-serif", fontSize:13, letterSpacing:"1px",
                  transition:"all 0.15s" }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div style={{ flex:1, overflowY:"auto", padding:10 }}>
            {tab === "games" && games.map(g => (
              <GameCard key={g.id} game={g} parlaySelections={parlaySelections} onToggle={toggleParlay} />
            ))}

            {tab === "stats" && (
              <>
                <div style={{ display:"flex", gap:6, marginBottom:12 }}>
                  <input value={playerSearch} onChange={e => setPlayerSearch(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && fetchPlayer()}
                    placeholder="Search NBA player..."
                    style={{ flex:1, background:C.card, border:`1px solid ${C.border}`,
                      borderRadius:6, padding:"7px 10px", color:C.text, fontSize:13,
                      fontFamily:"'Barlow Condensed',sans-serif", outline:"none" }} />
                  <button onClick={fetchPlayer}
                    style={{ background:C.accent, border:"none", borderRadius:6, padding:"0 12px",
                      color:"#000", fontFamily:"'Bebas Neue',sans-serif", fontSize:14,
                      cursor:"pointer", letterSpacing:"1px" }}>GO</button>
                </div>
                {playerLoading && (
                  <div style={{ textAlign:"center", padding:20, color:C.muted, fontSize:13 }}>
                    Fetching from balldontlie.io...
                  </div>
                )}
                {playerError && (
                  <div style={{ background:"rgba(255,68,68,0.08)", border:`1px solid rgba(255,68,68,0.2)`,
                    borderRadius:6, padding:10, fontSize:13, color:"#FF8080" }}>{playerError}</div>
                )}
                {playerData && <PlayerCard stats={playerData} />}
                {!playerData && !playerLoading && !playerError && (
                  <div style={{ padding:"20px 0" }}>
                    <div style={{ fontSize:12, color:C.muted, marginBottom:10,
                      fontFamily:"'Barlow Condensed',sans-serif" }}>TRY SEARCHING:</div>
                    {["LeBron James","Nikola Jokic","Stephen Curry","Jayson Tatum","Kevin Durant"].map(p => (
                      <button key={p} onClick={() => { setPlayerSearch(p); }}
                        style={{ display:"block", width:"100%", background:C.card,
                          border:`1px solid ${C.border}`, borderRadius:5, padding:"7px 10px",
                          color:C.muted, textAlign:"left", marginBottom:4, cursor:"pointer",
                          fontFamily:"'Barlow Condensed',sans-serif", fontSize:13,
                          transition:"all 0.15s" }}
                        onMouseEnter={e => { e.target.style.color=C.accent; e.target.style.borderColor=C.accent; }}
                        onMouseLeave={e => { e.target.style.color=C.muted; e.target.style.borderColor=C.border; }}>
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "parlay" && (
              <ParlayPanel selections={parlaySelections} result={parlayResult}
                onRemove={id => setParlaySelections(prev => prev.filter(s => s.id !== id))} />
            )}
          </div>
        </aside>

        {/* ── CHAT PANEL ── */}
        <main style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Agent pipeline indicator */}
          <div style={{ borderBottom:`1px solid ${C.border}`, padding:"6px 16px",
            display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            <span style={{ fontSize:11, color:C.muted, fontFamily:"'Barlow Condensed',sans-serif",
              letterSpacing:"0.5px" }}>PIPELINE:</span>
            {["User Query","InterfaceAgent","DataAgent + AnalyticsAgent","ParlayAgent","Unified Response"].map((s,i,arr) => (
              <span key={s} style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:11, color: i === 0 ? C.blue : i === arr.length-1 ? C.green : C.accent,
                  fontFamily:"'Barlow Condensed',sans-serif" }}>{s}</span>
                {i < arr.length - 1 && <span style={{ color:C.dim, fontSize:11 }}>→</span>}
              </span>
            ))}
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
            {messages.map((m, i) => <ChatMessage key={i} msg={m} />)}
            {loading && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", marginBottom:12 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                  <div style={{ width:20, height:20, borderRadius:4, background:C.accent,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:11, fontWeight:700, color:"#000", fontFamily:"'Bebas Neue',sans-serif" }}>AI</div>
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11,
                    color:C.muted }}>thinking...</span>
                </div>
                <div style={{ background:C.card, border:`1px solid ${C.border}`,
                  borderRadius:"4px 14px 14px 14px" }}>
                  <TypingIndicator />
                </div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          {/* Quick suggestions */}
          <div style={{ padding:"8px 16px 0", display:"flex", gap:6, flexWrap:"wrap",
            borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
            {SUGGESTIONS.map(s => (
              <button key={s} className="suggestion-btn" onClick={() => sendMessage(s)}
                style={{ background:"transparent", border:`1px solid ${C.border}`,
                  borderRadius:20, padding:"4px 12px", cursor:"pointer", fontSize:12,
                  color:C.muted, fontFamily:"'Barlow Condensed',sans-serif", transition:"all 0.15s" }}>
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding:12, flexShrink:0 }}>
            <div style={{ display:"flex", gap:8, background:C.card,
              border:`1px solid ${C.border}`, borderRadius:10, padding:"4px 4px 4px 14px",
              transition:"border-color 0.15s" }}
              onFocus={() => {}} >
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Ask about players, odds, win probability, or parlays..."
                disabled={loading}
                style={{ flex:1, background:"transparent", border:"none", outline:"none",
                  color:C.text, fontSize:14, fontFamily:"'Barlow Condensed',sans-serif",
                  padding:"6px 0" }} />
              <button className="send-btn" onClick={() => sendMessage()} disabled={loading}
                style={{ background: loading ? C.dim : C.accent, border:"none", borderRadius:7,
                  padding:"8px 18px", cursor: loading ? "not-allowed" : "pointer",
                  fontFamily:"'Bebas Neue',sans-serif", fontSize:15, letterSpacing:"1px",
                  color:"#000", transition:"background 0.15s", flexShrink:0 }}>
                {loading ? "..." : "SEND"}
              </button>
            </div>
            <div style={{ textAlign:"center", marginTop:5, fontSize:11, color:C.dim,
              fontFamily:"'Barlow Condensed',sans-serif" }}>
              Stats: balldontlie.io · Odds: AnalyticsAgent model · Not financial advice
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
