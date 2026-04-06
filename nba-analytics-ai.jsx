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
    @keyframes slideUp { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:translateY(0)} }
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
    .nba-bottom-nav {
      display: none;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      height: 64px;
      background: #0C1424;
      border-top: 1px solid #1A2B44;
      z-index: 100;
      align-items: stretch;
    }
    .nba-bottom-nav-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      background: transparent;
      border: none;
      cursor: pointer;
      min-height: 44px;
      padding: 6px 0;
      transition: background 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .nba-bottom-nav-btn:active { background: rgba(245,166,35,0.08); }
    .nba-bottom-nav-icon { font-size: 20px; line-height: 1; }
    .nba-bottom-nav-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .nba-chat-fab {
      display: none;
      position: fixed;
      bottom: 76px;
      right: 16px;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: #F5A623;
      border: none;
      cursor: pointer;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      z-index: 99;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      transition: transform 0.15s, box-shadow 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .nba-chat-fab:active { transform: scale(0.93); box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
    .nba-chat-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 200;
      flex-direction: column;
      background: #070D1A;
      animation: slideUp 0.28s ease-out;
    }
    .nba-chat-overlay.open { display: flex; }
    .nba-mobile-panel {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 150;
      flex-direction: column;
      background: #070D1A;
      overflow: hidden;
      animation: slideUp 0.25s ease-out;
    }
    .nba-mobile-panel.open { display: flex; }
    @media (max-width: 768px) {
      .nba-bottom-nav { display: flex; }
      .nba-chat-fab { display: flex; }
      .nba-desktop-sidebar { display: none !important; }
      .nba-desktop-chat { display: none !important; }
      .nba-mobile-content { display: flex !important; }
      .nba-pipeline-bar { display: none !important; }
      .nba-header-agents { display: none !important; }
      .nba-header-title { font-size: 18px !important; }
      .nba-header-sub { display: none !important; }
      .nba-body { padding-bottom: 64px; }
    }
    @media (min-width: 769px) {
      .nba-mobile-content { display: none !important; }
      .nba-chat-fab { display: none !important; }
      .nba-bottom-nav { display: none !important; }
    }
    * { box-sizing: border-box; }
  `;
  document.head.appendChild(style);
};

// ════════════════════════════════════════════════
// AGENT SYSTEM
// ════════════════════════════════════════════════

// ANALYTICS AGENT — enhanced multi-factor win probability model
const AnalyticsAgent = {
  name: "AnalyticsAgent",
  calcProb(home, away) {
    const homeGP = Math.max(1, home.wins + home.losses);
    const awayGP = Math.max(1, away.wins + away.losses);
    // Factor 1: Overall win rate (weight: 25%)
    const homeWR = home.wins / homeGP;
    const awayWR = away.wins / awayGP;
    const wrSignal = (homeWR - awayWR);
    // Factor 2: Net rating / efficiency (weight: 30%)
    const homeNetRtg = (home.offRtg || home.ppg) - (home.defRtg || home.oppPpg);
    const awayNetRtg = (away.offRtg || away.ppg) - (away.defRtg || away.oppPpg);
    const netRtgSignal = (homeNetRtg - awayNetRtg) / 20;
    // Factor 3: Recent form — last 10 games (weight: 15%)
    const parseL10 = (l10) => { if (!l10) return 0.5; const [w] = l10.split("-").map(Number); return w / 10; };
    const homeRecent = parseL10(home.last10);
    const awayRecent = parseL10(away.last10);
    const recentSignal = (homeRecent - awayRecent);
    // Factor 4: Home/away splits (weight: 15%)
    const homeHomePct = home.homeW ? home.homeW / Math.max(1, home.homeW + home.homeL) : homeWR;
    const awayAwayPct = away.awayW ? away.awayW / Math.max(1, away.awayW + away.awayL) : awayWR;
    const splitSignal = (homeHomePct - awayAwayPct);
    // Factor 5: Home court advantage (weight: 15%)
    const homeAdv = 0.035;
    // Combine weighted factors
    const composite = 0.5 + wrSignal * 0.25 + netRtgSignal * 0.30 + recentSignal * 0.15 + splitSignal * 0.15 + homeAdv;
    return Math.max(0.1, Math.min(0.9, composite));
  },
  getFactorBreakdown(home, away) {
    const homeGP = Math.max(1, home.wins + home.losses);
    const awayGP = Math.max(1, away.wins + away.losses);
    const homeWR = home.wins / homeGP;
    const awayWR = away.wins / awayGP;
    const homeNetRtg = (home.offRtg || home.ppg) - (home.defRtg || home.oppPpg);
    const awayNetRtg = (away.offRtg || away.ppg) - (away.defRtg || away.oppPpg);
    const parseL10 = (l10) => { if (!l10) return 0.5; const [w] = l10.split("-").map(Number); return w / 10; };
    const factors = [];
    const nrDiff = homeNetRtg - awayNetRtg;
    factors.push({ label: "Net Rating", home: homeNetRtg.toFixed(1), away: awayNetRtg.toFixed(1), edge: nrDiff > 1 ? home.abbr : nrDiff < -1 ? away.abbr : "Even" });
    factors.push({ label: "Win Rate", home: (homeWR*100).toFixed(1)+"%", away: (awayWR*100).toFixed(1)+"%", edge: homeWR > awayWR + 0.03 ? home.abbr : awayWR > homeWR + 0.03 ? away.abbr : "Even" });
    factors.push({ label: "Recent Form", home: home.last10 || "—", away: away.last10 || "—", edge: parseL10(home.last10) > parseL10(away.last10) + 0.1 ? home.abbr : parseL10(away.last10) > parseL10(home.last10) + 0.1 ? away.abbr : "Even" });
    factors.push({ label: "Home/Away", home: home.homeW ? `${home.homeW}-${home.homeL}` : "—", away: away.awayW ? `${away.awayW}-${away.awayL}` : "—", edge: home.abbr });
    factors.push({ label: "Offense (ORtg)", home: (home.offRtg||home.ppg).toFixed(1), away: (away.offRtg||away.ppg).toFixed(1), edge: (home.offRtg||home.ppg) > (away.offRtg||away.ppg) + 1 ? home.abbr : (away.offRtg||away.ppg) > (home.offRtg||home.ppg) + 1 ? away.abbr : "Even" });
    factors.push({ label: "Defense (DRtg)", home: (home.defRtg||home.oppPpg).toFixed(1), away: (away.defRtg||away.oppPpg).toFixed(1), edge: (home.defRtg||home.oppPpg) < (away.defRtg||away.oppPpg) - 1 ? home.abbr : (away.defRtg||away.oppPpg) < (home.defRtg||home.oppPpg) - 1 ? away.abbr : "Even" });
    return factors;
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
    "Boston Celtics":         { abbr:"BOS", wins:54, losses:18, ppg:120.6, oppPpg:109.4, fgPct:49.2, fg3Pct:39.1, pace:100.8, offRtg:122.4, defRtg:108.1, last10:"8-2", streak:"W4", homeW:30, homeL:6, awayW:24, awayL:12, vsAbove500:"22-10", vsBelow500:"32-8", ouRecord:"38-34", star:"Jayson Tatum" },
    "Oklahoma City Thunder":  { abbr:"OKC", wins:58, losses:14, ppg:119.2, oppPpg:108.5, fgPct:48.8, fg3Pct:37.6, pace:99.2, offRtg:121.0, defRtg:107.3, last10:"9-1", streak:"W7", homeW:32, homeL:4, awayW:26, awayL:10, vsAbove500:"24-8", vsBelow500:"34-6", ouRecord:"35-37", star:"Shai Gilgeous-Alexander" },
    "Cleveland Cavaliers":    { abbr:"CLE", wins:55, losses:17, ppg:117.8, oppPpg:107.2, fgPct:49.5, fg3Pct:38.4, pace:97.6, offRtg:120.8, defRtg:109.0, last10:"7-3", streak:"W2", homeW:31, homeL:5, awayW:24, awayL:12, vsAbove500:"21-11", vsBelow500:"34-6", ouRecord:"33-39", star:"Donovan Mitchell" },
    "Houston Rockets":        { abbr:"HOU", wins:45, losses:27, ppg:112.4, oppPpg:108.9, fgPct:46.1, fg3Pct:34.8, pace:98.4, offRtg:113.2, defRtg:109.8, last10:"6-4", streak:"L1", homeW:26, homeL:10, awayW:19, awayL:17, vsAbove500:"16-18", vsBelow500:"29-9", ouRecord:"32-40", star:"Alperen Sengun" },
    "Minnesota Timberwolves": { abbr:"MIN", wins:49, losses:23, ppg:112.3, oppPpg:107.8, fgPct:47.2, fg3Pct:36.5, pace:97.0, offRtg:115.8, defRtg:110.2, last10:"7-3", streak:"W3", homeW:28, homeL:8, awayW:21, awayL:15, vsAbove500:"20-14", vsBelow500:"29-9", ouRecord:"30-42", star:"Anthony Edwards" },
    "Denver Nuggets":         { abbr:"DEN", wins:44, losses:28, ppg:115.9, oppPpg:113.4, fgPct:48.4, fg3Pct:36.9, pace:99.8, offRtg:116.5, defRtg:113.0, last10:"5-5", streak:"L2", homeW:27, homeL:9, awayW:17, awayL:19, vsAbove500:"18-16", vsBelow500:"26-12", ouRecord:"42-30", star:"Nikola Jokic" },
    "New York Knicks":        { abbr:"NYK", wins:43, losses:29, ppg:114.7, oppPpg:111.3, fgPct:47.8, fg3Pct:37.2, pace:98.1, offRtg:116.2, defRtg:112.4, last10:"6-4", streak:"W1", homeW:25, homeL:11, awayW:18, awayL:18, vsAbove500:"17-17", vsBelow500:"26-12", ouRecord:"36-36", star:"Jalen Brunson" },
    "Los Angeles Lakers":     { abbr:"LAL", wins:41, losses:31, ppg:113.2, oppPpg:113.0, fgPct:47.5, fg3Pct:35.8, pace:100.2, offRtg:113.8, defRtg:113.2, last10:"5-5", streak:"W1", homeW:24, homeL:12, awayW:17, awayL:19, vsAbove500:"15-19", vsBelow500:"26-12", ouRecord:"39-33", star:"LeBron James" },
    "Indiana Pacers":         { abbr:"IND", wins:39, losses:33, ppg:122.8, oppPpg:121.6, fgPct:49.0, fg3Pct:37.8, pace:103.5, offRtg:118.4, defRtg:117.2, last10:"4-6", streak:"L3", homeW:23, homeL:13, awayW:16, awayL:20, vsAbove500:"14-20", vsBelow500:"25-13", ouRecord:"46-26", star:"Tyrese Haliburton" },
    "Dallas Mavericks":       { abbr:"DAL", wins:38, losses:34, ppg:116.2, oppPpg:115.4, fgPct:47.9, fg3Pct:36.4, pace:99.4, offRtg:116.0, defRtg:115.0, last10:"5-5", streak:"W2", homeW:22, homeL:14, awayW:16, awayL:20, vsAbove500:"14-20", vsBelow500:"24-14", ouRecord:"40-32", star:"Luka Doncic" },
    "Miami Heat":             { abbr:"MIA", wins:38, losses:34, ppg:111.5, oppPpg:112.8, fgPct:46.4, fg3Pct:35.2, pace:96.8, offRtg:112.8, defRtg:114.2, last10:"4-6", streak:"L2", homeW:24, homeL:12, awayW:14, awayL:22, vsAbove500:"13-21", vsBelow500:"25-13", ouRecord:"34-38", star:"Jimmy Butler" },
    "Orlando Magic":          { abbr:"ORL", wins:38, losses:34, ppg:108.6, oppPpg:107.4, fgPct:45.8, fg3Pct:34.6, pace:96.2, offRtg:110.4, defRtg:109.2, last10:"5-5", streak:"W1", homeW:23, homeL:13, awayW:15, awayL:21, vsAbove500:"14-20", vsBelow500:"24-14", ouRecord:"28-44", star:"Paolo Banchero" },
    "Golden State Warriors":  { abbr:"GSW", wins:36, losses:36, ppg:115.4, oppPpg:114.8, fgPct:47.6, fg3Pct:38.0, pace:100.6, offRtg:114.8, defRtg:114.2, last10:"4-6", streak:"L1", homeW:22, homeL:14, awayW:14, awayL:22, vsAbove500:"12-22", vsBelow500:"24-14", ouRecord:"40-32", star:"Stephen Curry" },
    "Los Angeles Clippers":   { abbr:"LAC", wins:37, losses:35, ppg:112.4, oppPpg:113.2, fgPct:46.8, fg3Pct:36.2, pace:97.8, offRtg:113.6, defRtg:114.8, last10:"5-5", streak:"W1", homeW:22, homeL:14, awayW:15, awayL:21, vsAbove500:"13-21", vsBelow500:"24-14", ouRecord:"35-37", star:"James Harden" },
    "Sacramento Kings":       { abbr:"SAC", wins:35, losses:37, ppg:116.8, oppPpg:118.2, fgPct:47.4, fg3Pct:35.6, pace:101.4, offRtg:115.0, defRtg:116.6, last10:"3-7", streak:"L4", homeW:21, homeL:15, awayW:14, awayL:22, vsAbove500:"11-23", vsBelow500:"24-14", ouRecord:"43-29", star:"De'Aaron Fox" },
    "Milwaukee Bucks":        { abbr:"MIL", wins:36, losses:36, ppg:114.1, oppPpg:115.9, fgPct:47.0, fg3Pct:35.4, pace:99.0, offRtg:114.6, defRtg:116.4, last10:"4-6", streak:"L1", homeW:22, homeL:14, awayW:14, awayL:22, vsAbove500:"14-20", vsBelow500:"22-16", ouRecord:"38-34", star:"Giannis Antetokounmpo" },
    "Phoenix Suns":           { abbr:"PHX", wins:30, losses:42, ppg:113.7, oppPpg:117.4, fgPct:47.2, fg3Pct:36.0, pace:99.6, offRtg:113.2, defRtg:117.0, last10:"3-7", streak:"L3", homeW:19, homeL:17, awayW:11, awayL:25, vsAbove500:"10-24", vsBelow500:"20-18", ouRecord:"39-33", star:"Kevin Durant" },
    "Atlanta Hawks":          { abbr:"ATL", wins:27, losses:45, ppg:117.4, oppPpg:120.3, fgPct:46.6, fg3Pct:35.0, pace:101.2, offRtg:115.8, defRtg:118.6, last10:"3-7", streak:"L2", homeW:17, homeL:19, awayW:10, awayL:26, vsAbove500:"8-26", vsBelow500:"19-19", ouRecord:"42-30", star:"Trae Young" },
    "Memphis Grizzlies":      { abbr:"MEM", wins:28, losses:44, ppg:110.3, oppPpg:115.6, fgPct:45.4, fg3Pct:33.8, pace:98.6, offRtg:111.2, defRtg:116.8, last10:"4-6", streak:"W1", homeW:18, homeL:18, awayW:10, awayL:26, vsAbove500:"9-25", vsBelow500:"19-19", ouRecord:"36-36", star:"Ja Morant" },
    "Philadelphia 76ers":     { abbr:"PHI", wins:24, losses:48, ppg:107.8, oppPpg:114.2, fgPct:45.0, fg3Pct:34.2, pace:97.4, offRtg:109.4, defRtg:116.0, last10:"2-8", streak:"L5", homeW:16, homeL:20, awayW:8, awayL:28, vsAbove500:"6-28", vsBelow500:"18-20", ouRecord:"33-39", star:"Joel Embiid" },
  },

  // Find a team by name or abbreviation
  findTeam(query) {
    const q = query.toLowerCase().trim();
    for (const [name, data] of Object.entries(this.teams)) {
      if (name.toLowerCase().includes(q) || data.abbr.toLowerCase() === q) return { name, ...data };
    }
    return null;
  },

  getTeamStats(query) {
    const t = this.findTeam(query);
    if (!t) return null;
    const gp = t.wins + t.losses;
    const winPct = (t.wins / gp * 100).toFixed(1);
    const netRtg = (t.offRtg - t.defRtg).toFixed(1);
    return {
      name: t.name, abbr: t.abbr, record: `${t.wins}-${t.losses}`, winPct,
      ppg: t.ppg, oppPpg: t.oppPpg, fgPct: t.fgPct, fg3Pct: t.fg3Pct,
      pace: t.pace, offRtg: t.offRtg, defRtg: t.defRtg, netRtg,
      last10: t.last10, streak: t.streak,
      homeRecord: `${t.homeW}-${t.homeL}`, awayRecord: `${t.awayW}-${t.awayL}`,
      vsAbove500: t.vsAbove500, vsBelow500: t.vsBelow500, ouRecord: t.ouRecord,
      star: t.star,
    };
  },

  compareTeams(q1, q2) {
    const t1 = this.getTeamStats(q1);
    const t2 = this.getTeamStats(q2);
    if (!t1 || !t2) return null;
    return { t1, t2 };
  },

  buildStaticGames() {
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
      return this.enrichGame(home, away, h, a, i + 1,
        today.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}),
        times[i]);
    });
  },

  enrichGame(homeName, awayName, h, a, id, date, time, extra = {}) {
    const homeProb = AnalyticsAgent.calcProb(h || { wins:30, losses:30, ppg:110, oppPpg:110, offRtg:110, defRtg:110 },
                                              a || { wins:30, losses:30, ppg:110, oppPpg:110, offRtg:110, defRtg:110 });
    const awayProb = 1 - homeProb;
    const hOdds = AnalyticsAgent.toAmerican(homeProb);
    const aOdds = AnalyticsAgent.toAmerican(awayProb);
    const hPpg = h?.ppg || 110; const aPpg = a?.ppg || 110;
    const hOpp = h?.oppPpg || 110; const aOpp = a?.oppPpg || 110;
    const netDiff = (hPpg - hOpp) - (aPpg - aOpp);
    const spread = extra.espnSpread != null ? (extra.espnSpread > 0 ? `+${extra.espnSpread}` : `${extra.espnSpread}`) :
      (-(netDiff / 2 + 1.5) > 0 ? `+${(-(netDiff / 2 + 1.5)).toFixed(1)}` : `${(-(netDiff / 2 + 1.5)).toFixed(1)}`);
    const total = extra.espnOverUnder || Math.round((hPpg + aPpg + hOpp + aOpp) / 2);
    return {
      id, home: homeName, away: awayName,
      homeAbbr: h?.abbr || extra.homeAbbr || "???", awayAbbr: a?.abbr || extra.awayAbbr || "???",
      homeRecord: extra.homeRecord || (h ? `${h.wins}-${h.losses}` : "—"),
      awayRecord: extra.awayRecord || (a ? `${a.wins}-${a.losses}` : "—"),
      date, time,
      homeProb: Math.round(homeProb * 100), awayProb: Math.round(awayProb * 100),
      homeOdds: hOdds > 0 ? `+${hOdds}` : `${hOdds}`, homeOddsRaw: hOdds,
      awayOdds: aOdds > 0 ? `+${aOdds}` : `${aOdds}`, awayOddsRaw: aOdds,
      spread, total, homePpg: hPpg, awayPpg: aPpg,
      homeScore: extra.homeScore || null, awayScore: extra.awayScore || null,
      status: extra.status || "scheduled", statusDetail: extra.statusDetail || "",
      isLive: extra.status === "STATUS_IN_PROGRESS",
      isFinal: extra.status === "STATUS_FINAL",
    };
  },

  parseESPNGames(espnGames) {
    return espnGames.map((g, i) => {
      const h = this.findTeam(g.homeAbbr);
      const a = this.findTeam(g.awayAbbr);
      return this.enrichGame(
        g.home || h?.name || g.homeAbbr,
        g.away || a?.name || g.awayAbbr,
        h, a, i + 1, g.date, g.gameTime,
        { homeAbbr: g.homeAbbr, awayAbbr: g.awayAbbr,
          homeRecord: g.homeRecord, awayRecord: g.awayRecord,
          homeScore: g.homeScore, awayScore: g.awayScore,
          status: g.status, statusDetail: g.statusDetail,
          espnSpread: g.espnSpread, espnOverUnder: g.espnOverUnder }
      );
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

// TRENDS AGENT — streak, O/U, strength-of-schedule analysis
const TrendsAgent = {
  name: "TrendsAgent",

  getTeamTrends(teamData) {
    const trends = [];
    // Streak analysis
    const streakMatch = (teamData.streak || "").match(/([WL])(\d+)/);
    if (streakMatch) {
      const [, dir, len] = streakMatch;
      const n = parseInt(len);
      if (n >= 4) trends.push({ type: dir === "W" ? "hot" : "cold", text: `${dir === "W" ? "🔥" : "🧊"} ${n}-game ${dir === "W" ? "winning" : "losing"} streak` });
      else if (n >= 2) trends.push({ type: dir === "W" ? "warm" : "cool", text: `${dir === "W" ? "📈" : "📉"} ${n}-game ${dir === "W" ? "win" : "loss"} streak` });
    }
    // Last 10 trend
    if (teamData.last10) {
      const [w] = teamData.last10.split("-").map(Number);
      if (w >= 8) trends.push({ type: "hot", text: `🔥 ${teamData.last10} in last 10 — elite form` });
      else if (w >= 7) trends.push({ type: "warm", text: `📈 ${teamData.last10} in last 10 — strong form` });
      else if (w <= 2) trends.push({ type: "cold", text: `🧊 ${teamData.last10} in last 10 — struggling` });
      else if (w <= 3) trends.push({ type: "cool", text: `📉 ${teamData.last10} in last 10 — slumping` });
    }
    // O/U trend
    if (teamData.ouRecord) {
      const [ow, ol] = teamData.ouRecord.split("-").map(Number);
      const ouPct = ow / Math.max(1, ow + ol);
      if (ouPct >= 0.58) trends.push({ type: "over", text: `⬆️ O/U: ${teamData.ouRecord} — strong OVER lean (${(ouPct*100).toFixed(0)}%)` });
      else if (ouPct <= 0.42) trends.push({ type: "under", text: `⬇️ O/U: ${teamData.ouRecord} — strong UNDER lean (${((1-ouPct)*100).toFixed(0)}%)` });
    }
    // vs strong/weak teams
    if (teamData.vsAbove500) {
      const [sw, sl] = teamData.vsAbove500.split("-").map(Number);
      const pct = sw / Math.max(1, sw + sl);
      if (pct >= 0.65) trends.push({ type: "hot", text: `💪 ${teamData.vsAbove500} vs .500+ teams — proven contender` });
      else if (pct <= 0.35) trends.push({ type: "cold", text: `⚠️ ${teamData.vsAbove500} vs .500+ teams — struggles vs quality` });
    }
    // Home/away imbalance
    if (teamData.homeW && teamData.awayW) {
      const homePct = teamData.homeW / Math.max(1, teamData.homeW + teamData.homeL);
      const awayPct = teamData.awayW / Math.max(1, teamData.awayW + teamData.awayL);
      if (homePct - awayPct > 0.2) trends.push({ type: "home", text: `🏠 Much better at home (${teamData.homeW}-${teamData.homeL}) than away (${teamData.awayW}-${teamData.awayL})` });
      if (awayPct > homePct + 0.05) trends.push({ type: "road", text: `✈️ Strong road team: ${teamData.awayW}-${teamData.awayL} away` });
    }
    // Pace
    if (teamData.pace >= 101) trends.push({ type: "pace", text: `⚡ High pace (${teamData.pace}) — fast-paced offense` });
    else if (teamData.pace <= 97) trends.push({ type: "pace", text: `🐢 Slow pace (${teamData.pace}) — grind-it-out style` });
    return trends;
  },

  getGameTrends(game) {
    const homeTeam = Object.values(DataAgent.teams).find(t => t.abbr === game.homeAbbr);
    const awayTeam = Object.values(DataAgent.teams).find(t => t.abbr === game.awayAbbr);
    if (!homeTeam || !awayTeam) return [];
    const trends = [];
    // Combined pace for O/U insight
    const avgPace = ((homeTeam.pace || 99) + (awayTeam.pace || 99)) / 2;
    if (avgPace >= 101) trends.push(`⚡ High-pace matchup (avg ${avgPace.toFixed(1)}) — favors OVER`);
    else if (avgPace <= 97) trends.push(`🐢 Slow-pace matchup (avg ${avgPace.toFixed(1)}) — favors UNDER`);
    // Both teams' O/U records
    if (homeTeam.ouRecord && awayTeam.ouRecord) {
      const [ho, hl] = homeTeam.ouRecord.split("-").map(Number);
      const [ao, al] = awayTeam.ouRecord.split("-").map(Number);
      const combinedO = ho + ao, combinedU = hl + al;
      if (combinedO > combinedU + 10) trends.push(`⬆️ Both teams lean OVER: ${game.homeAbbr} ${homeTeam.ouRecord}, ${game.awayAbbr} ${awayTeam.ouRecord}`);
      if (combinedU > combinedO + 10) trends.push(`⬇️ Both teams lean UNDER: ${game.homeAbbr} ${homeTeam.ouRecord}, ${game.awayAbbr} ${awayTeam.ouRecord}`);
    }
    // Streaks
    if (homeTeam.streak && homeTeam.streak.startsWith("W") && parseInt(homeTeam.streak.slice(1)) >= 3)
      trends.push(`🔥 ${game.homeAbbr} on a ${homeTeam.streak.slice(1)}-game win streak at home`);
    if (awayTeam.streak && awayTeam.streak.startsWith("L") && parseInt(awayTeam.streak.slice(1)) >= 3)
      trends.push(`🧊 ${game.awayAbbr} on a ${awayTeam.streak.slice(1)}-game losing streak`);
    if (awayTeam.streak && awayTeam.streak.startsWith("W") && parseInt(awayTeam.streak.slice(1)) >= 3)
      trends.push(`🔥 ${game.awayAbbr} riding a ${awayTeam.streak.slice(1)}-game win streak`);
    if (homeTeam.streak && homeTeam.streak.startsWith("L") && parseInt(homeTeam.streak.slice(1)) >= 3)
      trends.push(`🧊 ${game.homeAbbr} on a ${homeTeam.streak.slice(1)}-game slide`);
    return trends;
  },

  getBestTrendsTonight(games) {
    const all = [];
    for (const g of games) {
      const trends = this.getGameTrends(g);
      if (trends.length > 0) all.push({ game: g, trends });
    }
    return all.sort((a, b) => b.trends.length - a.trends.length);
  },
};

// QUERY UNDERSTANDING AGENT — NLP intent classification + confidence scoring
const QueryUnderstandingAgent = {
  name: "QueryUnderstandingAgent",

  // Intent patterns with confidence weights
  intentPatterns: {
    player_stats: {
      patterns: [
        /(?:stats?|about|points?|scoring|how is|how's|tell me about|look up)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z\-]+)+)/i,
        /([A-Z][a-z]+(?:\s+[A-Z][a-z\-]+)+)\s+stats?/i,
        /player\s+stats?/i,
      ],
      keywords: ["stats", "ppg", "rpg", "apg", "shooting", "averages", "player", "scoring"],
      baseConfidence: 0.85,
    },
    team_stats: {
      patterns: [
        /(?:team\s+)?stats?\s+(?:for\s+)?(\w+)/i,
        /(\w+)\s+team\s+stats?/i,
        /how (?:is|are) (?:the\s+)?(\w+)/i,
      ],
      keywords: ["team stats", "record", "roster", "team", "franchise"],
      baseConfidence: 0.8,
    },
    game_matchup: {
      patterns: [
        /(\w+)\s+(?:vs\.?|@|against|and)\s+(\w+)/i,
        /(\w+)\s+game/i,
      ],
      keywords: ["game", "matchup", "playing", "tonight", "vs"],
      baseConfidence: 0.85,
    },
    comparison: {
      patterns: [
        /compare\s+(\w+)\s+(?:vs\.?|and|to|with)\s+(\w+)/i,
        /(\w+)\s+(?:vs\.?|or)\s+(\w+)\s+(?:who|which|better)/i,
        /who.?s?\s+better/i,
      ],
      keywords: ["compare", "better", "head to head", "comparison", "versus"],
      baseConfidence: 0.85,
    },
    parlay: {
      patterns: [
        /(\d+)\s*leg\s*parlay/i,
        /(?:build|make|give|suggest|create).*parlay/i,
        /parlay.*(\d+)\s*%/i,
        /parlay/i,
      ],
      keywords: ["parlay", "leg", "combo", "multi", "accumulator"],
      baseConfidence: 0.9,
    },
    predictions: {
      patterns: [
        /who\s+(?:win|wins|gonna win|going to win)/i,
        /predict/i,
        /winner/i,
      ],
      keywords: ["predict", "winner", "who wins", "pick", "forecast"],
      baseConfidence: 0.85,
    },
    best_bets: {
      patterns: [
        /best\s+(?:bet|pick|lock)/i,
        /safest/i,
        /recommend/i,
      ],
      keywords: ["best bet", "lock", "safest", "recommend", "should i bet"],
      baseConfidence: 0.85,
    },
    odds: {
      patterns: [
        /(?:odds|moneyline|spread|line)/i,
      ],
      keywords: ["odds", "moneyline", "spread", "line", "vig", "juice", "money line"],
      baseConfidence: 0.85,
    },
    over_under: {
      patterns: [
        /(?:over|under|total|o\/u)/i,
      ],
      keywords: ["over", "under", "total", "o/u", "points total"],
      baseConfidence: 0.8,
    },
    trends: {
      patterns: [
        /trend/i,
        /streak/i,
        /(?:hot|cold|heating|cooling)\s+(?:team|streak)/i,
      ],
      keywords: ["trend", "streak", "hot", "cold", "form", "momentum"],
      baseConfidence: 0.85,
    },
    rankings: {
      patterns: [
        /(?:rank|standing|best team|top team|power rank)/i,
      ],
      keywords: ["ranking", "standings", "best team", "top", "power", "leaderboard"],
      baseConfidence: 0.85,
    },
    upsets: {
      patterns: [
        /(?:upset|underdog|long shot|sleeper)/i,
      ],
      keywords: ["upset", "underdog", "longshot", "sleeper", "value pick"],
      baseConfidence: 0.85,
    },
    schedule: {
      patterns: [
        /(?:all games|schedule|tonight|today|upcoming|games?\s+(?:on|for|playing))/i,
        /what games/i,
        /(?:april|march|feb|jan|may|tomorrow|yesterday)\s*\d*/i,
        /how many game/i,
      ],
      keywords: ["schedule", "tonight", "today", "games", "playing", "april", "tomorrow"],
      baseConfidence: 0.8,
    },
    defense_offense: {
      patterns: [
        /(?:best|worst)\s+(?:defense|offense)/i,
        /(?:most|least)\s+points/i,
      ],
      keywords: ["defense", "offense", "defensive", "offensive"],
      baseConfidence: 0.85,
    },
    closest_games: {
      patterns: [
        /(?:closest|tightest|most competitive|coin flip|blowout|biggest favorite|easiest|lopsided)/i,
      ],
      keywords: ["closest", "tightest", "competitive", "blowout", "favorite"],
      baseConfidence: 0.85,
    },
    general_nba: {
      patterns: [
        /(?:nba|basketball|playoff|champion|mvp|draft|trade|injury|injured|roster|contract|free agent|rookie|all.star)/i,
      ],
      keywords: ["nba", "basketball", "playoff", "champion", "mvp", "draft", "trade", "injury", "news", "update", "report"],
      baseConfidence: 0.5,  // Lower — often needs web search
    },
  },

  classify(query) {
    const q = query.toLowerCase().trim();
    const results = [];

    for (const [intent, config] of Object.entries(this.intentPatterns)) {
      let confidence = 0;

      // Pattern matching (strongest signal)
      for (const pattern of config.patterns) {
        if (pattern.test(query)) {
          confidence = Math.max(confidence, config.baseConfidence);
          break;
        }
      }

      // Keyword boosting
      let keywordHits = 0;
      for (const kw of config.keywords) {
        if (q.includes(kw)) keywordHits++;
      }
      if (keywordHits > 0) {
        const keywordBoost = Math.min(0.3, keywordHits * 0.12);
        confidence = Math.max(confidence, 0.4 + keywordBoost);
      }

      // Entity detection boost: if we can find a team/player in the query
      if (confidence > 0) {
        const hasTeam = this.detectTeams(q).length > 0;
        const hasPlayer = this.detectPlayers(query).length > 0;
        if (hasTeam || hasPlayer) confidence = Math.min(1.0, confidence + 0.05);
      }

      if (confidence > 0) {
        results.push({ intent, confidence, config });
      }
    }

    // Sort by confidence descending
    results.sort((a, b) => b.confidence - a.confidence);

    // If no intent matched at all, return unknown
    if (results.length === 0) {
      return { intent: "unknown", confidence: 0, allIntents: [], entities: this.extractEntities(query) };
    }

    return {
      intent: results[0].intent,
      confidence: results[0].confidence,
      allIntents: results.slice(0, 3),
      entities: this.extractEntities(query),
    };
  },

  detectTeams(q) {
    const found = [];
    for (const word of q.split(/\s+/)) {
      if (word.length >= 3) {
        const team = DataAgent.findTeam(word);
        if (team) found.push(team);
      }
    }
    return found;
  },

  detectPlayers(query) {
    const found = [];
    const twoWordPattern = query.match(/[A-Z][a-z]+\s+[A-Z][a-z\-]+/g);
    if (twoWordPattern) {
      for (const name of twoWordPattern) {
        const player = DataAgent.getPlayerStats(name);
        if (player) found.push(player);
      }
    }
    return found;
  },

  extractEntities(query) {
    const q = query.toLowerCase();
    const entities = { teams: [], players: [], dates: [], numbers: [] };
    // Teams
    entities.teams = this.detectTeams(q);
    // Players
    entities.players = this.detectPlayers(query);
    // Dates
    const dateMatch = q.match(/(?:april|march|february|january|may|june)\s*(\d{1,2})/i);
    if (dateMatch) entities.dates.push(dateMatch[0]);
    if (q.includes("tomorrow")) entities.dates.push("tomorrow");
    if (q.includes("yesterday")) entities.dates.push("yesterday");
    // Numbers
    const nums = q.match(/\d+/g);
    if (nums) entities.numbers = nums.map(Number);
    return entities;
  },

  // Determine if we need web search based on confidence + intent
  needsWebSearch(classification) {
    // Always search for unknown intents
    if (classification.intent === "unknown") return true;
    // Low confidence → search
    if (classification.confidence < 0.7) return true;
    // General NBA questions often need fresh data
    if (classification.intent === "general_nba") return true;
    // Schedule queries with specific dates need ESPN
    if (classification.intent === "schedule" && classification.entities.dates.length > 0) return true;
    return false;
  },
};

// WEB SEARCH AGENT — multi-source search with extraction and validation
const WebSearchAgent = {
  name: "WebSearchAgent",
  searchLog: [],

  async search(query, classification) {
    const startTime = Date.now();
    const logEntry = { query, intent: classification?.intent, confidence: classification?.confidence, timestamp: new Date().toISOString() };

    try {
      const resp = await fetch(`/api/search?q=${encodeURIComponent(query)}&intent=${classification?.intent || ""}`);
      const data = await resp.json();

      logEntry.duration = Date.now() - startTime;
      logEntry.success = !!data.answer;
      logEntry.snippetCount = data.snippetCount || 0;
      this.searchLog.push(logEntry);
      // Keep log manageable
      if (this.searchLog.length > 50) this.searchLog.shift();

      if (!data.answer) return null;

      // Validate and clean the response
      return this.validateAndFormat(data.answer, query, classification);
    } catch (err) {
      logEntry.duration = Date.now() - startTime;
      logEntry.success = false;
      logEntry.error = err.message;
      this.searchLog.push(logEntry);
      return null;
    }
  },

  validateAndFormat(rawAnswer, query, classification) {
    // Remove obviously bad/short snippets
    const lines = rawAnswer.split("\n\n").filter(l => l.trim().length > 15);
    if (lines.length === 0) return null;

    // Try to extract the most relevant info
    const cleaned = lines.map(line => {
      // Strip HTML artifacts
      return line.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim();
    }).filter(l => l.length > 15);

    if (cleaned.length === 0) return null;

    const intent = classification?.intent || "unknown";
    const q = query.toLowerCase();

    // Format based on intent
    let header;
    if (intent === "schedule" || /game|schedule|playing/i.test(q)) {
      header = `📅 **Search Results — NBA Schedule**`;
    } else if (intent === "general_nba" || /injury|trade|news|mvp|draft|playoff|champion/i.test(q)) {
      header = `📰 **NBA News & Info**`;
    } else if (/score|result|final/i.test(q)) {
      header = `📊 **Game Results**`;
    } else {
      header = `🔍 **Search Results** for "${query}"`;
    }

    return `${header}\n\n${cleaned.join("\n\n")}\n\n—\n*Source: web search (${cleaned.length} results) · For built-in analytics, ask about a specific team or matchup.*`;
  },

  getRecentLog(n = 5) {
    return this.searchLog.slice(-n);
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

    const gameTrends = TrendsAgent.getGameTrends(g);
    const trendsBlock = gameTrends.length > 0 ? `\n**TrendsAgent Insights:**\n${gameTrends.map(t => `  ${t}`).join("\n")}` : "";

    // Get factor breakdown
    const homeTeamData = Object.entries(DataAgent.teams).find(([,v]) => v.abbr === g.homeAbbr);
    const awayTeamData = Object.entries(DataAgent.teams).find(([,v]) => v.abbr === g.awayAbbr);
    let factorsBlock = "";
    if (homeTeamData && awayTeamData) {
      const hd = { ...homeTeamData[1], name: homeTeamData[0] };
      const ad = { ...awayTeamData[1], name: awayTeamData[0] };
      const factors = AnalyticsAgent.getFactorBreakdown(hd, ad);
      factorsBlock = `\n**Factor Breakdown:**\n${factors.map(f => `  ${f.label}: ${g.homeAbbr} ${f.home} vs ${g.awayAbbr} ${f.away} → Edge: ${f.edge}`).join("\n")}`;
    }

    return `📊 ${g.awayAbbr} @ ${g.homeAbbr} — ${g.date} ${g.time}

🏠 ${g.homeAbbr} (${g.homeRecord}) vs 🏃 ${g.awayAbbr} (${g.awayRecord})

**Win Probability** (multi-factor model: net rating 30% + win% 25% + recent form 15% + home/away splits 15% + home court 15%):
• ${favTeam}: ${favProb}% (ML ${favOdds}) — FAVORED
• ${udTeam}: ${udProb}% (ML ${udOdds})

Spread: ${g.spread} | O/U: ${g.total}
${factorsBlock}
${trendsBlock}

${favProb >= 65 ? `Strong lean toward ${favTeam} here.` : favProb >= 55 ? `Slight edge to ${favTeam}, but competitive matchup.` : `Very close game — could go either way.`}

Click the + button next to any odds to add to your parlay.`;
  },

  formatTeamStats(t) {
    const teamData = DataAgent.findTeam(t.abbr);
    const trends = teamData ? TrendsAgent.getTeamTrends(teamData) : [];
    const trendsBlock = trends.length > 0 ? `\n**Trends (TrendsAgent):**\n${trends.map(tr => `  ${tr.text}`).join("\n")}` : "";

    return `📊 **${t.name}** (${t.abbr}) — ${t.record} (${t.winPct}%)
⭐ Star: ${t.star}

**Scoring & Efficiency:**
PPG: ${t.ppg} | Opp PPG: ${t.oppPpg}
FG%: ${t.fgPct} | 3P%: ${t.fg3Pct}
Off Rtg: ${t.offRtg} | Def Rtg: ${t.defRtg} | Net Rtg: ${t.netRtg}
Pace: ${t.pace}

**Situational:**
Home: ${t.homeRecord} | Away: ${t.awayRecord}
Last 10: ${t.last10} | Streak: ${t.streak}
vs .500+: ${t.vsAbove500} | vs <.500: ${t.vsBelow500}
O/U Record: ${t.ouRecord}
${trendsBlock}`;
  },

  formatComparison(t1, t2) {
    const edge = (label, v1, v2, higherBetter = true) => {
      const diff = v1 - v2;
      const winner = higherBetter ? (diff > 0 ? t1.abbr : t2.abbr) : (diff < 0 ? t1.abbr : t2.abbr);
      return `${label}: ${t1.abbr} ${v1} vs ${t2.abbr} ${v2} → **${Math.abs(diff) < 0.5 ? "Even" : winner}**`;
    };
    const advantages = { [t1.abbr]: 0, [t2.abbr]: 0 };
    const checks = [
      [parseFloat(t1.winPct), parseFloat(t2.winPct), true],
      [t1.offRtg, t2.offRtg, true],
      [t1.defRtg, t2.defRtg, false],
      [parseFloat(t1.netRtg), parseFloat(t2.netRtg), true],
      [t1.fgPct, t2.fgPct, true],
    ];
    for (const [v1, v2, hb] of checks) {
      const diff = v1 - v2;
      if (Math.abs(diff) >= 0.5) {
        const w = hb ? (diff > 0 ? t1.abbr : t2.abbr) : (diff < 0 ? t1.abbr : t2.abbr);
        advantages[w]++;
      }
    }
    const overall = advantages[t1.abbr] > advantages[t2.abbr] ? t1.abbr : advantages[t2.abbr] > advantages[t1.abbr] ? t2.abbr : "Even";

    return `⚔️ **Head-to-Head Comparison: ${t1.abbr} vs ${t2.abbr}**

**Records:**
${t1.abbr}: ${t1.record} (${t1.winPct}%) | ${t2.abbr}: ${t2.record} (${t2.winPct}%)

**Offense:**
${edge("PPG", t1.ppg, t2.ppg)}
${edge("Off Rtg", t1.offRtg, t2.offRtg)}
${edge("FG%", t1.fgPct, t2.fgPct)}
${edge("3P%", t1.fg3Pct, t2.fg3Pct)}
${edge("Pace", t1.pace, t2.pace)}

**Defense:**
${edge("Opp PPG", t1.oppPpg, t2.oppPpg, false)}
${edge("Def Rtg", t1.defRtg, t2.defRtg, false)}

**Efficiency:**
${edge("Net Rtg", parseFloat(t1.netRtg), parseFloat(t2.netRtg))}

**Situational:**
${edge("Last 10 W", parseInt(t1.last10), parseInt(t2.last10))}
Home: ${t1.abbr} ${t1.homeRecord} | ${t2.abbr} ${t2.homeRecord}
Away: ${t1.abbr} ${t1.awayRecord} | ${t2.abbr} ${t2.awayRecord}
vs .500+: ${t1.abbr} ${t1.vsAbove500} | ${t2.abbr} ${t2.vsAbove500}

**Stars:** ${t1.star} (${t1.abbr}) vs ${t2.star} (${t2.abbr})

**Overall Edge: ${overall}** (${advantages[t1.abbr]}-${advantages[t2.abbr]} in key categories)`;
  },

  query(userMsg, games, parlayState) {
    const q = userMsg.toLowerCase();

    // Team comparison / matchup query — "compare Lakers vs Celtics" or "knicks vs hawks"
    const compareMatch = q.match(/compare\s+(\w+)\s+(?:vs\.?|and|to|with)\s+(\w+)/)
      || q.match(/(\w+)\s+vs\.?\s+(\w+)\s+(?:comparison|compare|head.to.head)/)
      || q.match(/(\w+)\s+(?:vs\.?|against|@)\s+(\w+)/);
    if (compareMatch) {
      // First check if there's a scheduled game
      const game = this.findGame(q, games);
      if (game) return this.formatGameAnalysis(game);
      // Otherwise do an ad-hoc comparison/matchup
      const comp = DataAgent.compareTeams(compareMatch[1], compareMatch[2]);
      if (comp) {
        // Generate ad-hoc win probability
        const t1Data = DataAgent.findTeam(compareMatch[1]);
        const t2Data = DataAgent.findTeam(compareMatch[2]);
        if (t1Data && t2Data) {
          const homeProb = AnalyticsAgent.calcProb(t1Data, t2Data);
          const factors = AnalyticsAgent.getFactorBreakdown(t1Data, t2Data);
          const t1Trends = TrendsAgent.getTeamTrends(t1Data);
          const t2Trends = TrendsAgent.getTeamTrends(t2Data);
          const allTrends = [...t1Trends.map(t => `${t1Data.abbr}: ${t.text}`), ...t2Trends.map(t => `${t2Data.abbr}: ${t.text}`)];
          return `${this.formatComparison(comp.t1, comp.t2)}

**Win Probability** (if ${t1Data.abbr} hosts):
${t1Data.abbr}: ${Math.round(homeProb * 100)}% | ${t2Data.abbr}: ${Math.round((1 - homeProb) * 100)}%

**Factor Breakdown:**
${factors.map(f => `  ${f.label}: ${t1Data.abbr} ${f.home} vs ${t2Data.abbr} ${f.away} → Edge: ${f.edge}`).join("\n")}
${allTrends.length > 0 ? `\n**Active Trends:**\n${allTrends.slice(0, 6).map(t => `  ${t}`).join("\n")}` : ""}`;
        }
        return this.formatComparison(comp.t1, comp.t2);
      }
      return `Could not find one or both teams. Try full city name or abbreviation (e.g. "compare LAL vs BOS").`;
    }

    // Team stats query — "team stats for Nuggets"
    const teamStatsMatch = q.match(/(?:team\s+)?stats?\s+(?:for\s+)?(\w+)/i)
      || q.match(/(\w+)\s+team\s+stats?/i);
    if (teamStatsMatch && !q.match(/player|about\s+[A-Z]/i)) {
      // Check if it's a team, not a player
      const teamData = DataAgent.getTeamStats(teamStatsMatch[1]);
      if (teamData) return this.formatTeamStats(teamData);
    }

    // Player stats query
    const playerMatch = userMsg.match(/(?:player\s+)?(?:stats?|about|points?|scoring|how is|how's|tell me about)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z\-]+)+)/i)
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

    // Team trends query — "trends for Celtics" or "best team trends tonight"
    if (q.includes("trend")) {
      if (q.includes("tonight") || q.includes("best") || q.includes("all")) {
        const allTrends = TrendsAgent.getBestTrendsTonight(games);
        if (!allTrends.length) return "No strong trends detected in tonight's games.";
        return `📈 **Best Team Trends Tonight:**\n\n${allTrends.slice(0,5).map(({ game: g, trends }) => `**${g.awayAbbr} @ ${g.homeAbbr}:**\n${trends.map(t => `  ${t}`).join("\n")}`).join("\n\n")}`;
      }
      // Specific team trend
      const teamWord = q.replace(/trend[s]?\s*(for)?/i, "").trim().split(/\s+/)[0];
      if (teamWord) {
        const td = DataAgent.findTeam(teamWord);
        if (td) {
          const trends = TrendsAgent.getTeamTrends(td);
          if (!trends.length) return `No notable trends for ${td.abbr} right now.`;
          return `📈 **${td.name} (${td.abbr}) Trends:**\n\n${trends.map(t => t.text).join("\n")}`;
        }
      }
      return "Specify a team (e.g. 'Celtics trends') or ask for 'best trends tonight'.";
    }

    // Parlay query — build or view
    if (q.includes("parlay")) {
      // Auto-build parlay: "give me a 3 leg parlay" or "build a parlay with 75% chance"
      const legMatch = q.match(/(\d+)\s*leg/);
      const probMatch = q.match(/(\d+)\s*%/);
      const numLegs = legMatch ? parseInt(legMatch[1]) : null;
      const targetProb = probMatch ? parseInt(probMatch[1]) : null;

      if (numLegs || q.includes("build") || q.includes("give") || q.includes("make") || q.includes("suggest") || q.includes("create")) {
        const sorted = [...games].sort((a,b) => Math.max(b.homeProb,b.awayProb) - Math.max(a.homeProb,a.awayProb));
        const legs = numLegs ? Math.min(numLegs, sorted.length) : 3;

        // If target probability, pick legs to get close to that combined prob
        let picks;
        if (targetProb) {
          // Greedy: add favorites until combined prob drops to ~targetProb
          picks = [];
          let combinedProb = 1;
          for (const g of sorted) {
            if (picks.length >= Math.min(legs, 6)) break;
            const fav = g.homeProb > g.awayProb;
            const prob = Math.max(g.homeProb, g.awayProb) / 100;
            if (combinedProb * prob >= targetProb / 100 * 0.8 || picks.length < legs) {
              picks.push({ game: g, fav, prob: Math.max(g.homeProb, g.awayProb) });
              combinedProb *= prob;
            }
          }
          if (picks.length < legs) picks = sorted.slice(0, legs).map(g => ({
            game: g, fav: g.homeProb > g.awayProb, prob: Math.max(g.homeProb, g.awayProb)
          }));
        } else {
          picks = sorted.slice(0, legs).map(g => ({
            game: g, fav: g.homeProb > g.awayProb, prob: Math.max(g.homeProb, g.awayProb)
          }));
        }

        const combinedProb = picks.reduce((acc, p) => acc * (p.prob / 100), 1);
        const combinedDecimal = picks.reduce((acc, p) => {
          const odds = p.fav ? p.game.homeOddsRaw : p.game.awayOddsRaw;
          return acc * AnalyticsAgent.toDecimal(odds);
        }, 1);
        const combinedAmerican = combinedDecimal >= 2
          ? `+${Math.round((combinedDecimal - 1) * 100)}`
          : `-${Math.round(100 / (combinedDecimal - 1))}`;

        return `🎰 **Suggested ${picks.length}-Leg Parlay${targetProb ? ` (~${targetProb}% target)` : ""}:**

${picks.map((p, i) => {
  const abbr = p.fav ? (p.game.homeProb > p.game.awayProb ? p.game.homeAbbr : p.game.awayAbbr) : (p.game.homeProb <= p.game.awayProb ? p.game.homeAbbr : p.game.awayAbbr);
  const odds = p.fav ? (p.game.homeProb > p.game.awayProb ? p.game.homeOdds : p.game.awayOdds) : (p.game.homeProb <= p.game.awayProb ? p.game.homeOdds : p.game.awayOdds);
  const opp = p.fav ? (p.game.homeProb > p.game.awayProb ? p.game.awayAbbr : p.game.homeAbbr) : (p.game.homeProb <= p.game.awayProb ? p.game.awayAbbr : p.game.homeAbbr);
  return `**Leg ${i+1}:** ${abbr} ML ${odds} (${p.prob}%) vs ${opp}`;
}).join("\n")}

**Combined Odds:** ${combinedAmerican} (${combinedDecimal.toFixed(2)}x)
**Combined Win Prob:** ${(combinedProb * 100).toFixed(1)}%
**$100 Payout:** $${(combinedDecimal * 100).toFixed(2)}

${combinedProb > 0.5 ? "High-confidence parlay — lower payout but solid probability." : combinedProb > 0.25 ? "Moderate risk parlay — decent payout with reasonable odds." : "Long-shot parlay — big payout but lower probability. Proceed with caution."}

To lock this in, click the + buttons on each team's odds in the GAMES tab.`;
      }

      // View existing parlay
      if (parlayState.selections.length > 0 && parlayState.result) {
        let trendNotes = "";
        for (const sel of parlayState.selections) {
          const teamData = DataAgent.findTeam(sel.pick);
          if (teamData) {
            const trends = TrendsAgent.getTeamTrends(teamData);
            const hotCold = trends.find(t => t.type === "hot" || t.type === "cold");
            if (hotCold) trendNotes += `\n  ${teamData.abbr}: ${hotCold.text}`;
          }
        }
        return `🎰 Active Parlay — ${parlayState.result.legs} legs

${parlayState.selections.map(s => `• ${s.pick} ${s.odds} (${s.prob}%)`).join("\n")}

Combined Odds: ${parlayState.result.american} (decimal: ${parlayState.result.decimal})
Implied Probability: ${parlayState.result.impliedProb}%
$100 Payout: $${parlayState.result.payout100}
EV: ${parlayState.result.ev}%
${trendNotes ? `\n**TrendsAgent Notes:**${trendNotes}` : ""}

${parseFloat(parlayState.result.ev) > 0 ? "Positive EV — model suggests value here." : "Negative EV — proceed with caution."}`;
      }
      return "No active parlay. Click the + button next to any game odds to add selections, then check the PARLAY tab.\n\nOr try: **\"build me a 3 leg parlay\"** or **\"give me a parlay with 60% chance\"**";
    }

    // Game matchup query
    const game = this.findGame(q, games);
    if (game) return this.formatGameAnalysis(game);

    // Best bet / pick query — enhanced with trend context
    if (q.includes("best bet") || q.includes("best pick") || q.includes("lock") || q.includes("safest") || q.includes("who should") || q.includes("recommend")) {
      const sorted = [...games].sort((a,b) => Math.max(b.homeProb,b.awayProb) - Math.max(a.homeProb,a.awayProb));
      const top3 = sorted.slice(0,3);
      return `🔒 **Top picks by win probability** (enhanced multi-factor model):

${top3.map((g,i) => {
  const fav = g.homeProb > g.awayProb;
  const favAbbr = fav ? g.homeAbbr : g.awayAbbr;
  const favTeamData = DataAgent.findTeam(favAbbr);
  const streakInfo = favTeamData?.streak ? ` (${favTeamData.streak})` : "";
  return `${i+1}. **${favAbbr}** ML ${fav ? g.homeOdds : g.awayOdds} — ${Math.max(g.homeProb,g.awayProb)}% win prob vs ${fav ? g.awayAbbr : g.homeAbbr}${streakInfo}`;
}).join("\n")}

Model weights: Net Rating 30% | Win% 25% | Recent Form 15% | Home/Away Splits 15% | Home Court 15%`;
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

    // Over/under / total — enhanced with pace/trend data
    if (q.includes("over") || q.includes("under") || q.includes("total")) {
      const g3 = this.findGame(q, games);
      if (g3) {
        const homeTeam = DataAgent.findTeam(g3.homeAbbr);
        const awayTeam = DataAgent.findTeam(g3.awayAbbr);
        const paceInfo = homeTeam && awayTeam ? `\nAvg Pace: ${((homeTeam.pace + awayTeam.pace)/2).toFixed(1)} | O/U Records: ${g3.homeAbbr} ${homeTeam.ouRecord}, ${g3.awayAbbr} ${awayTeam.ouRecord}` : "";
        return `🎯 ${g3.awayAbbr} @ ${g3.homeAbbr} — O/U: ${g3.total}\n\n${g3.homeAbbr} averages ${g3.homePpg} PPG, ${g3.awayAbbr} averages ${g3.awayPpg} PPG.\nCombined average: ${(g3.homePpg + g3.awayPpg).toFixed(1)} points.${paceInfo}\n\n${(g3.homePpg + g3.awayPpg) > g3.total ? "Trend favors the OVER based on scoring averages." : "Trend favors the UNDER based on scoring averages."}`;
      }
    }

    // Ranking / standings
    if (q.includes("rank") || q.includes("standing") || q.includes("best team") || q.includes("top team")) {
      const sorted = Object.entries(DataAgent.teams).sort((a,b) => {
        const aNet = (a[1].offRtg || a[1].ppg) - (a[1].defRtg || a[1].oppPpg);
        const bNet = (b[1].offRtg || b[1].ppg) - (b[1].defRtg || b[1].oppPpg);
        return bNet - aNet;
      });
      return `🏆 **Team Power Rankings** (by Net Rating):\n\n${sorted.slice(0,10).map(([name, t], i) => {
        const net = ((t.offRtg || t.ppg) - (t.defRtg || t.oppPpg)).toFixed(1);
        return `${i+1}. **${t.abbr}** ${t.wins}-${t.losses} | Net: ${net > 0 ? "+" : ""}${net} | Last 10: ${t.last10 || "—"} | ${t.streak || "—"}`;
      }).join("\n")}`;
    }

    // Who wins / predict — "who wins tonight", "predict the games"
    if (q.includes("who win") || q.includes("who's going to win") || q.includes("predict") || q.includes("winner") || q.includes("pick the winner")) {
      return `🔮 **Predictions for Tonight** (multi-factor model):\n\n${games.map(g => {
        const fav = g.homeProb > g.awayProb;
        const favAbbr = fav ? g.homeAbbr : g.awayAbbr;
        const favProb = Math.max(g.homeProb, g.awayProb);
        const favOdds = fav ? g.homeOdds : g.awayOdds;
        const conf = favProb >= 65 ? "🔒" : favProb >= 55 ? "📈" : "⚖️";
        return `${conf} **${favAbbr}** wins vs ${fav ? g.awayAbbr : g.homeAbbr} — ${favProb}% (${favOdds})`;
      }).join("\n")}\n\n🔒 = High confidence | 📈 = Moderate | ⚖️ = Toss-up`;
    }

    // Upset / underdog picks — "any upsets", "underdog picks"
    if (q.includes("upset") || q.includes("underdog") || q.includes("long shot") || q.includes("sleeper")) {
      const underdogs = games.filter(g => {
        const udProb = Math.min(g.homeProb, g.awayProb);
        return udProb >= 30 && udProb <= 48;
      }).sort((a,b) => Math.min(b.homeProb,b.awayProb) - Math.min(a.homeProb,a.awayProb));

      if (!underdogs.length) return "No strong upset candidates tonight — favorites are heavily favored across the board.";

      return `🎯 **Upset Watch — Best Underdog Picks:**\n\n${underdogs.slice(0,4).map(g => {
        const udHome = g.homeProb < g.awayProb;
        const udAbbr = udHome ? g.homeAbbr : g.awayAbbr;
        const udProb = Math.min(g.homeProb, g.awayProb);
        const udOdds = udHome ? g.homeOdds : g.awayOdds;
        const favAbbr = udHome ? g.awayAbbr : g.homeAbbr;
        const tdData = DataAgent.findTeam(udAbbr);
        const streak = tdData?.streak || "";
        return `• **${udAbbr}** ${udOdds} (${udProb}%) vs ${favAbbr}${streak.startsWith("W") ? ` — ${streak} streak 🔥` : ""}`;
      }).join("\n")}\n\nThese underdogs have a realistic path. Great for plus-money value.`;
    }

    // Defense / offense questions — "best defense", "who scores the most"
    if (q.includes("best defense") || q.includes("worst defense") || q.includes("best offense") || q.includes("worst offense") || q.includes("most points") || q.includes("least points")) {
      const teams = Object.entries(DataAgent.teams);
      if (q.includes("defense") || q.includes("least points")) {
        const sorted = teams.sort((a,b) => (q.includes("worst") ? -1 : 1) * ((a[1].defRtg || a[1].oppPpg) - (b[1].defRtg || b[1].oppPpg)));
        const label = q.includes("worst") ? "Worst Defenses" : "Best Defenses";
        return `🛡️ **${label}** (by Defensive Rating):\n\n${sorted.slice(0,8).map(([n,t],i) => `${i+1}. **${t.abbr}** — DRtg: ${(t.defRtg||t.oppPpg).toFixed(1)} | Opp PPG: ${t.oppPpg}`).join("\n")}`;
      }
      const sorted = teams.sort((a,b) => (q.includes("worst") ? 1 : -1) * ((a[1].offRtg || a[1].ppg) - (b[1].offRtg || b[1].ppg)));
      const label = q.includes("worst") ? "Worst Offenses" : "Best Offenses";
      return `🏀 **${label}** (by Offensive Rating):\n\n${sorted.slice(0,8).map(([n,t],i) => `${i+1}. **${t.abbr}** — ORtg: ${(t.offRtg||t.ppg).toFixed(1)} | PPG: ${t.ppg}`).join("\n")}`;
    }

    // How many games / count
    if (q.includes("how many game")) {
      return `There are **${games.length} games** on tonight's schedule:\n\n${games.map(g => `• ${g.awayAbbr} @ ${g.homeAbbr} — ${g.time}`).join("\n")}`;
    }

    // Closest / tightest game
    if (q.includes("closest") || q.includes("tightest") || q.includes("most competitive") || q.includes("coin flip")) {
      const sorted = [...games].sort((a,b) => Math.abs(a.homeProb - 50) - Math.abs(b.homeProb - 50));
      const top = sorted.slice(0, 3);
      return `⚖️ **Closest Games Tonight:**\n\n${top.map(g => `• ${g.awayAbbr} @ ${g.homeAbbr} — ${g.homeAbbr} ${g.homeProb}% vs ${g.awayAbbr} ${g.awayProb}% | Spread: ${g.spread}`).join("\n")}\n\nThese are near coin-flip matchups — great for undecided bettors.`;
    }

    // Blowout / easiest game
    if (q.includes("blowout") || q.includes("biggest favorite") || q.includes("easiest") || q.includes("most lopsided")) {
      const sorted = [...games].sort((a,b) => Math.max(b.homeProb,b.awayProb) - Math.max(a.homeProb,a.awayProb));
      const top = sorted.slice(0, 3);
      return `💪 **Biggest Favorites Tonight:**\n\n${top.map(g => {
        const fav = g.homeProb > g.awayProb;
        return `• **${fav ? g.homeAbbr : g.awayAbbr}** ${Math.max(g.homeProb,g.awayProb)}% (${fav ? g.homeOdds : g.awayOdds}) vs ${fav ? g.awayAbbr : g.homeAbbr} | Spread: ${g.spread}`;
      }).join("\n")}`;
    }

    // Smart fallback: try to find any team mention in the query
    for (const word of q.split(/\s+/)) {
      if (word.length >= 3) {
        const td = DataAgent.findTeam(word);
        if (td) {
          // Check if they have a game today
          const teamGame = games.find(g => g.homeAbbr === td.abbr || g.awayAbbr === td.abbr);
          if (teamGame) return this.formatGameAnalysis(teamGame);
          // Otherwise show team stats
          const stats = DataAgent.getTeamStats(word);
          if (stats) return this.formatTeamStats(stats);
        }
      }
    }

    // Final smart fallback: try player name (two capitalized words)
    const twoWords = userMsg.match(/([A-Z][a-z]+)\s+([A-Z][a-z]+)/);
    if (twoWords) {
      const pData = DataAgent.getPlayerStats(twoWords[0]);
      if (pData) return `📊 ${pData.name} — ${pData.team} (${pData.position})\n2024-25 Season: ${pData.pts} PPG | ${pData.reb} RPG | ${pData.ast} APG\n🎯 FG: ${pData.fg} | 3P: ${pData.fg3} | FT: ${pData.ft}\n🛡️ ${pData.stl} SPG | ${pData.blk} BPG`;
    }

    // Default / help
    return `I can help with:\n\n• **Game analysis** — "Rockets vs Warriors" or "Celtics game"\n• **Team stats** — "team stats Nuggets" or "stats BOS"\n• **Compare teams** — "compare Lakers vs Celtics"\n• **Team trends** — "Celtics trends" or "best trends tonight"\n• **Player stats** — "LeBron James stats"\n• **Build parlays** — "give me a 3 leg parlay" or "build a parlay with 60% chance"\n• **Predictions** — "who wins tonight" or "predict the games"\n• **Upsets** — "any upsets tonight" or "underdog picks"\n• **Rankings** — "team rankings" or "best defense"\n• **Best picks** — "best bets tonight" or "safest pick"\n• **Close games** — "closest games tonight" or "coin flip"\n\nTry asking anything about NBA!`;
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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

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
        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
          {game.isLive && <span style={{ fontSize:9, background:C.red, color:"#fff", padding:"1px 5px",
            borderRadius:3, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600,
            animation:"pulse 1.8s ease-in-out infinite" }}>LIVE</span>}
          {game.isFinal && <span style={{ fontSize:9, background:C.dim, color:C.text, padding:"1px 5px",
            borderRadius:3, fontFamily:"'Barlow Condensed',sans-serif" }}>FINAL</span>}
          <span style={{ fontSize:10, background:"#1A2B44", color:C.muted, padding:"1px 6px",
            borderRadius:3, fontFamily:"'Barlow Condensed',sans-serif" }}>
            O/U {game.total}
          </span>
        </div>
      </div>

      {/* Matchup row */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
        {/* Away team */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", flex:1 }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:C.text,
              lineHeight:1 }}>{game.awayAbbr}</span>
            {(game.isLive || game.isFinal) && game.awayScore != null && (
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:18, fontWeight:700,
                color: game.isFinal && game.awayScore > game.homeScore ? C.green : C.text }}>{game.awayScore}</span>
            )}
          </div>
          <span style={{ fontSize:10, color:C.muted, fontFamily:"'Barlow Condensed',sans-serif" }}>
            {game.awayRecord}
          </span>
        </div>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, color:C.dim,
          fontWeight:600 }}>@</span>
        {/* Home team */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", flex:1 }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
            {(game.isLive || game.isFinal) && game.homeScore != null && (
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:18, fontWeight:700,
                color: game.isFinal && game.homeScore > game.awayScore ? C.green : C.text }}>{game.homeScore}</span>
            )}
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:C.text,
              lineHeight:1 }}>{game.homeAbbr}</span>
          </div>
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

function TeamStatsCard({ stats }) {
  const netRtgColor = parseFloat(stats.netRtg) > 0 ? C.green : parseFloat(stats.netRtg) < -2 ? C.red : C.accent;
  const streakColor = stats.streak.startsWith("W") ? C.green : C.red;
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:14,
      animation:"fadeIn 0.3s ease-out" }}>
      <div style={{ marginBottom:10 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:C.text,
          letterSpacing:"1px" }}>{stats.name}</div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:14, color:C.accent,
            fontWeight:600 }}>{stats.record} ({stats.winPct}%)</span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:streakColor,
            background:"rgba(255,255,255,0.05)", padding:"1px 6px", borderRadius:3 }}>{stats.streak}</span>
        </div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, color:C.muted }}>
          ⭐ {stats.star} | Last 10: {stats.last10}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:10 }}>
        {[["OFF RTG",stats.offRtg,true],["DEF RTG",stats.defRtg,false],["NET RTG",stats.netRtg,false]].map(([l,v,h]) => (
          <div key={l} style={{ background:C.panel, borderRadius:6, padding:"8px 0", textAlign:"center" }}>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:18, fontWeight:600,
              color: l === "NET RTG" ? netRtgColor : h ? C.accent : C.text }}>{v}</div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:10, color:C.muted }}>{l}</div>
          </div>
        ))}
      </div>
      <StatRow label="PPG" value={stats.ppg} highlight />
      <StatRow label="Opp PPG" value={stats.oppPpg} />
      <StatRow label="FG%" value={stats.fgPct + "%"} />
      <StatRow label="3P%" value={stats.fg3Pct + "%"} />
      <StatRow label="Pace" value={stats.pace} />
      <StatRow label="Home" value={stats.homeRecord} />
      <StatRow label="Away" value={stats.awayRecord} />
      <StatRow label="vs .500+" value={stats.vsAbove500} />
      <StatRow label="O/U Record" value={stats.ouRecord} />
    </div>
  );
}

function ComparisonBar({ label, v1, v2, abbr1, abbr2, higherBetter = true }) {
  const max = Math.max(v1, v2, 1);
  const w1 = (v1 / max) * 100;
  const w2 = (v2 / max) * 100;
  const diff = v1 - v2;
  const winner = Math.abs(diff) < 0.5 ? null : higherBetter ? (diff > 0 ? 1 : 2) : (diff < 0 ? 1 : 2);
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10,
        color:C.muted, fontFamily:"'Barlow Condensed',sans-serif", marginBottom:2 }}>
        <span style={{ color: winner === 1 ? C.green : C.text }}>{abbr1} {v1}</span>
        <span style={{ fontSize:11, color:C.muted }}>{label}</span>
        <span style={{ color: winner === 2 ? C.green : C.text }}>{v2} {abbr2}</span>
      </div>
      <div style={{ display:"flex", gap:2, height:6 }}>
        <div style={{ flex:1, display:"flex", justifyContent:"flex-end" }}>
          <div style={{ width:`${w1}%`, background: winner === 1 ? C.green : C.border, borderRadius:"3px 0 0 3px",
            transition:"width 0.4s ease" }} />
        </div>
        <div style={{ flex:1 }}>
          <div style={{ width:`${w2}%`, background: winner === 2 ? C.green : C.border, borderRadius:"0 3px 3px 0",
            transition:"width 0.4s ease" }} />
        </div>
      </div>
    </div>
  );
}

function ComparisonView({ t1, t2 }) {
  if (!t1 || !t2) return null;
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:14,
      animation:"fadeIn 0.3s ease-out" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ textAlign:"center", flex:1 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:C.text }}>{t1.abbr}</div>
          <div style={{ fontSize:11, color:C.accent, fontFamily:"'Barlow Condensed',sans-serif" }}>{t1.record}</div>
        </div>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:14, color:C.dim, padding:"0 8px" }}>VS</div>
        <div style={{ textAlign:"center", flex:1 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:C.text }}>{t2.abbr}</div>
          <div style={{ fontSize:11, color:C.accent, fontFamily:"'Barlow Condensed',sans-serif" }}>{t2.record}</div>
        </div>
      </div>
      <ComparisonBar label="OFF RTG" v1={t1.offRtg} v2={t2.offRtg} abbr1={t1.abbr} abbr2={t2.abbr} />
      <ComparisonBar label="DEF RTG" v1={t1.defRtg} v2={t2.defRtg} abbr1={t1.abbr} abbr2={t2.abbr} higherBetter={false} />
      <ComparisonBar label="NET RTG" v1={parseFloat(t1.netRtg)} v2={parseFloat(t2.netRtg)} abbr1={t1.abbr} abbr2={t2.abbr} />
      <ComparisonBar label="PPG" v1={t1.ppg} v2={t2.ppg} abbr1={t1.abbr} abbr2={t2.abbr} />
      <ComparisonBar label="OPP PPG" v1={t1.oppPpg} v2={t2.oppPpg} abbr1={t1.abbr} abbr2={t2.abbr} higherBetter={false} />
      <ComparisonBar label="FG%" v1={t1.fgPct} v2={t2.fgPct} abbr1={t1.abbr} abbr2={t2.abbr} />
      <ComparisonBar label="3P%" v1={t1.fg3Pct} v2={t2.fg3Pct} abbr1={t1.abbr} abbr2={t2.abbr} />
      <ComparisonBar label="PACE" v1={t1.pace} v2={t2.pace} abbr1={t1.abbr} abbr2={t2.abbr} />
      <div style={{ marginTop:8, padding:"6px 8px", background:"rgba(245,166,35,0.06)",
        border:`1px solid rgba(245,166,35,0.15)`, borderRadius:5 }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, color:C.muted }}>
          Last 10: {t1.abbr} {t1.last10} | {t2.abbr} {t2.last10}
        </div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, color:C.muted }}>
          vs .500+: {t1.abbr} {t1.vsAbove500} | {t2.abbr} {t2.vsAbove500}
        </div>
      </div>
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
  const isMobile = useIsMobile();

  const [games, setGames] = useState(() => DataAgent.buildStaticGames());
  const [gamesSource, setGamesSource] = useState("static");
  const [gamesLoading, setGamesLoading] = useState(true);
  const [tab, setTab] = useState("games");
  const [chatOpen, setChatOpen] = useState(false);

  // Fetch live games from ESPN via backend
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/games");
        const data = await resp.json();
        if (!cancelled && data.games && data.games.length > 0) {
          setGames(DataAgent.parseESPNGames(data.games));
          setGamesSource("espn");
        }
      } catch { /* keep static fallback */ }
      finally { if (!cancelled) setGamesLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "**NBA Analytics AI online.** I run on 7 cooperative sub-agents:\n\n**QueryUnderstandingAgent** — NLP intent classification + confidence scoring\n**DataAgent** — team + player stats, game data, and probabilistic odds\n**AnalyticsAgent** — multi-factor model (net rating, win%, recent form, home/away splits)\n**TrendsAgent** — streaks, O/U trends, strength-of-schedule analysis\n**ParlayAgent** — combined legs with EV calculation\n**WebSearchAgent** — real-time web search for news, scores, and info\n**InterfaceAgent** — that's me, synthesizing everything\n\nAsk me anything about the NBA — if I don't have the answer locally, I'll search the web for you!"
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [parlaySelections, setParlaySelections] = useState([]);
  const parlayResult = ParlayAgent.calc(parlaySelections);
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerData, setPlayerData] = useState(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [teamData, setTeamData] = useState(null);
  const [teamCompare1, setTeamCompare1] = useState("");
  const [teamCompare2, setTeamCompare2] = useState("");
  const [comparisonData, setComparisonData] = useState(null);
  const [teamError, setTeamError] = useState("");
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

  const fetchTeam = () => {
    if (!teamSearch.trim()) return;
    setTeamError("");
    setComparisonData(null);
    const result = DataAgent.getTeamStats(teamSearch);
    if (result) { setTeamData(result); }
    else { setTeamData(null); setTeamError(`Team "${teamSearch}" not found. Try city name or abbreviation (e.g. "Celtics" or "BOS").`); }
  };

  const runComparison = () => {
    if (!teamCompare1.trim() || !teamCompare2.trim()) return;
    setTeamError("");
    setTeamData(null);
    const comp = DataAgent.compareTeams(teamCompare1, teamCompare2);
    if (comp) { setComparisonData(comp); }
    else { setComparisonData(null); setTeamError("Could not find one or both teams. Try abbreviations like BOS, LAL, OKC."); }
  };

  const sendMessage = async (text) => {
    const q = text || input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role:"user", content:q }]);
    setLoading(true);

    try {
      // Step 1: QueryUnderstandingAgent classifies the query
      const classification = QueryUnderstandingAgent.classify(q);
      const needsSearch = QueryUnderstandingAgent.needsWebSearch(classification);

      // Step 2: Try local InterfaceAgent first (if confidence is decent)
      let localReply = null;
      if (classification.confidence >= 0.4) {
        localReply = InterfaceAgent.query(q, games,
          { selections: parlaySelections, result: parlayResult });
        // Check if the local engine actually answered (vs returning help text)
        if (localReply.startsWith("I can help with:")) localReply = null;
      }

      // Step 3: If local answered confidently, use it
      if (localReply && !needsSearch) {
        setTimeout(() => {
          setMessages(prev => [...prev, { role:"assistant", content: localReply }]);
          setLoading(false);
        }, 200 + Math.random() * 300);
        return;
      }

      // Step 4: If local gave a partial answer but we also need search (low confidence),
      // or if local had no answer — try web search
      if (!localReply || needsSearch) {
        const webResult = await WebSearchAgent.search(q, classification);

        if (webResult && localReply) {
          // Combine local + web: local answer is primary, web supplements
          setMessages(prev => [...prev, { role:"assistant",
            content: `${localReply}\n\n---\n\n${webResult}` }]);
        } else if (webResult) {
          // Web only
          setMessages(prev => [...prev, { role:"assistant", content: webResult }]);
        } else if (localReply) {
          // Local only (web failed)
          setMessages(prev => [...prev, { role:"assistant", content: localReply }]);
        } else {
          // Both failed — give helpful fallback
          setMessages(prev => [...prev, { role:"assistant",
            content: `I wasn't able to find specific info for "${q}". Try:\n\n• A team name: "Celtics" or "team stats BOS"\n• A player: "LeBron James stats"\n• A matchup: "Lakers vs Warriors"\n• A parlay: "build me a 3 leg parlay"\n• General: "who wins tonight" or "best bets"\n\nOr rephrase your question and I'll search the web for you.` }]);
        }
        setLoading(false);
        return;
      }
    } catch (err) {
      // Catastrophic fallback
      const localReply = InterfaceAgent.query(q, games,
        { selections: parlaySelections, result: parlayResult });
      setMessages(prev => [...prev, { role:"assistant", content: localReply }]);
      setLoading(false);
    }
  };

  const SUGGESTIONS = [
    "Who wins Lakers vs Warriors?",
    "Compare Lakers vs Celtics",
    "Team stats Nuggets",
    "Best trends tonight",
    "LeBron James stats",
    "Best bets tonight",
  ];

  return (
    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", background:C.bg, color:C.text,
      height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* ── HEADER ── */}
      <header style={{ background:C.panel, borderBottom:`2px solid ${C.accent}`,
        padding: isMobile ? "8px 12px" : "10px 16px", display:"flex", alignItems:"center",
        justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap: isMobile ? 8 : 12 }}>
          <div style={{ width: isMobile ? 30 : 36, height: isMobile ? 30 : 36, borderRadius:8,
            background:C.accent, display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"'Bebas Neue',sans-serif", fontSize: isMobile ? 14 : 18, color:"#000" }}>NBA</div>
          <div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize: isMobile ? 16 : 22,
              lineHeight:1, letterSpacing:"2px", color:C.text }}>NBA ANALYTICS AI</div>
            {!isMobile && <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11,
              color:C.muted, letterSpacing:"1px" }}>MULTI-AGENT INTELLIGENCE SYSTEM</div>}
          </div>
        </div>
        {!isMobile && (
          <div style={{ display:"flex", gap:16 }}>
            {["QueryAgent","DataAgent","AnalyticsAgent","TrendsAgent","ParlayAgent","WebSearch","InterfaceAgent"].map(a => (
              <AgentBadge key={a} name={a} />
            ))}
          </div>
        )}
        {isMobile && (
          <span style={{ fontSize:10, color: gamesSource === "espn" ? C.green : C.muted,
            fontFamily:"'Barlow Condensed',sans-serif" }}>
            {gamesSource === "espn" ? "📡 LIVE" : "📋 STATIC"}
          </span>
        )}
      </header>

      {/* ── BODY ── */}
      <div style={{ display:"flex", flex:1, overflow:"hidden",
        paddingBottom: isMobile ? 64 : 0 }}>

        {/* ── SIDEBAR (desktop) / MAIN CONTENT (mobile) ── */}
        <aside style={{ width: isMobile ? "100%" : 300, background: isMobile ? C.bg : C.panel,
          borderRight: isMobile ? "none" : `1px solid ${C.border}`,
          display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>

          {/* Tabs */}
          <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
            {[
              { id:"games", label:"GAMES" },
              { id:"teams", label:"TEAMS" },
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
            {tab === "games" && (
              <>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  marginBottom:8, padding:"0 2px" }}>
                  <span style={{ fontSize:10, color: gamesSource === "espn" ? C.green : C.muted,
                    fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"0.5px" }}>
                    {gamesLoading ? "Loading live games..." : gamesSource === "espn" ? "📡 LIVE — ESPN" : "📋 STATIC DATA"}
                  </span>
                  {gamesSource === "espn" && (
                    <button onClick={() => {
                      setGamesLoading(true);
                      fetch("/api/games").then(r => r.json()).then(data => {
                        if (data.games?.length > 0) setGames(DataAgent.parseESPNGames(data.games));
                      }).catch(() => {}).finally(() => setGamesLoading(false));
                    }} style={{ background:"transparent", border:`1px solid ${C.border}`, borderRadius:4,
                      padding:"2px 8px", color:C.muted, fontSize:10, cursor:"pointer",
                      fontFamily:"'Barlow Condensed',sans-serif" }}>
                      ↻ REFRESH
                    </button>
                  )}
                </div>
                {games.map(g => (
                  <GameCard key={g.id} game={g} parlaySelections={parlaySelections} onToggle={toggleParlay} />
                ))}
              </>
            )}

            {tab === "teams" && (
              <>
                {/* Team search */}
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, color:C.muted, fontFamily:"'Barlow Condensed',sans-serif",
                    letterSpacing:"0.5px", marginBottom:4 }}>TEAM STATS</div>
                  <div style={{ display:"flex", gap:6 }}>
                    <input value={teamSearch} onChange={e => setTeamSearch(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && fetchTeam()}
                      placeholder="Search team..."
                      style={{ flex:1, background:C.card, border:`1px solid ${C.border}`,
                        borderRadius:6, padding:"7px 10px", color:C.text, fontSize:13,
                        fontFamily:"'Barlow Condensed',sans-serif", outline:"none" }} />
                    <button onClick={fetchTeam}
                      style={{ background:C.accent, border:"none", borderRadius:6, padding:"0 12px",
                        color:"#000", fontFamily:"'Bebas Neue',sans-serif", fontSize:14,
                        cursor:"pointer", letterSpacing:"1px" }}>GO</button>
                  </div>
                </div>
                {/* Compare */}
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, color:C.muted, fontFamily:"'Barlow Condensed',sans-serif",
                    letterSpacing:"0.5px", marginBottom:4 }}>COMPARE TEAMS</div>
                  <div style={{ display:"flex", gap:4, marginBottom:4 }}>
                    <input value={teamCompare1} onChange={e => setTeamCompare1(e.target.value)}
                      placeholder="Team 1"
                      style={{ flex:1, background:C.card, border:`1px solid ${C.border}`,
                        borderRadius:6, padding:"7px 8px", color:C.text, fontSize:12,
                        fontFamily:"'Barlow Condensed',sans-serif", outline:"none" }} />
                    <span style={{ color:C.dim, fontFamily:"'Bebas Neue',sans-serif", fontSize:12,
                      display:"flex", alignItems:"center" }}>VS</span>
                    <input value={teamCompare2} onChange={e => setTeamCompare2(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && runComparison()}
                      placeholder="Team 2"
                      style={{ flex:1, background:C.card, border:`1px solid ${C.border}`,
                        borderRadius:6, padding:"7px 8px", color:C.text, fontSize:12,
                        fontFamily:"'Barlow Condensed',sans-serif", outline:"none" }} />
                  </div>
                  <button onClick={runComparison}
                    style={{ width:"100%", background:C.accent, border:"none", borderRadius:6,
                      padding:"6px 0", color:"#000", fontFamily:"'Bebas Neue',sans-serif",
                      fontSize:13, cursor:"pointer", letterSpacing:"1px" }}>COMPARE</button>
                </div>
                {teamError && (
                  <div style={{ background:"rgba(255,68,68,0.08)", border:`1px solid rgba(255,68,68,0.2)`,
                    borderRadius:6, padding:10, fontSize:13, color:"#FF8080", marginBottom:8 }}>{teamError}</div>
                )}
                {teamData && <TeamStatsCard stats={teamData} />}
                {comparisonData && <ComparisonView t1={comparisonData.t1} t2={comparisonData.t2} />}
                {!teamData && !comparisonData && !teamError && (
                  <div style={{ padding:"12px 0" }}>
                    <div style={{ fontSize:12, color:C.muted, marginBottom:8,
                      fontFamily:"'Barlow Condensed',sans-serif" }}>QUICK SEARCH:</div>
                    {["BOS","OKC","CLE","HOU","MIN","DEN","NYK","LAL"].map(abbr => (
                      <button key={abbr} onClick={() => { setTeamSearch(abbr); setTeamData(DataAgent.getTeamStats(abbr)); setComparisonData(null); setTeamError(""); }}
                        style={{ display:"inline-block", background:C.card, border:`1px solid ${C.border}`,
                          borderRadius:5, padding:"5px 10px", color:C.muted, margin:"0 4px 4px 0",
                          cursor:"pointer", fontFamily:"'Bebas Neue',sans-serif", fontSize:13,
                          letterSpacing:"0.5px", transition:"all 0.15s" }}
                        onMouseEnter={e => { e.target.style.color=C.accent; e.target.style.borderColor=C.accent; }}
                        onMouseLeave={e => { e.target.style.color=C.muted; e.target.style.borderColor=C.border; }}>
                        {abbr}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

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
                    Searching...
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

        {/* ── CHAT PANEL (desktop only, or mobile overlay) ── */}
        <main style={{ flex:1, display: isMobile ? "none" : "flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Agent pipeline indicator */}
          <div style={{ borderBottom:`1px solid ${C.border}`, padding:"6px 16px",
            display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            <span style={{ fontSize:11, color:C.muted, fontFamily:"'Barlow Condensed',sans-serif",
              letterSpacing:"0.5px" }}>PIPELINE:</span>
            {["User Query","QueryUnderstanding","DataAgent + Analytics","Trends + Parlay","WebSearch (if needed)","Unified Response"].map((s,i,arr) => (
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
              Team + Player Stats · Multi-Factor Model · TrendsAgent · Not financial advice
            </div>
          </div>
        </main>
      </div>

      {/* ── MOBILE: Bottom Navigation ── */}
      <nav className="nba-bottom-nav">
        {[
          { id:"games", icon:"🏠", label:"Home" },
          { id:"teams", icon:"🏀", label:"Teams" },
          { id:"stats", icon:"👤", label:"Players" },
          { id:"parlay", icon:"🎰", label:`Parlay${parlaySelections.length > 0 ? ` (${parlaySelections.length})` : ""}` },
        ].map(item => (
          <button key={item.id} className="nba-bottom-nav-btn"
            onClick={() => { setTab(item.id); setChatOpen(false); }}>
            <span className="nba-bottom-nav-icon">{item.icon}</span>
            <span className="nba-bottom-nav-label"
              style={{ color: tab === item.id && !chatOpen ? C.accent : C.muted }}>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* ── MOBILE: Floating Chat Button ── */}
      <button className="nba-chat-fab" onClick={() => setChatOpen(true)}
        aria-label="Open AI Chat">
        💬
      </button>

      {/* ── MOBILE: Chat Overlay ── */}
      <div className={`nba-chat-overlay ${chatOpen ? "open" : ""}`}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"12px 16px", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:24, height:24, borderRadius:6, background:C.accent,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:"'Bebas Neue',sans-serif", fontSize:12, color:"#000" }}>AI</div>
            <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, color:C.text,
              letterSpacing:"1px" }}>NBA ANALYTICS AI</span>
          </div>
          <button onClick={() => setChatOpen(false)}
            style={{ background:"transparent", border:"none", color:C.muted, fontSize:24,
              cursor:"pointer", padding:"4px 8px", minHeight:44, minWidth:44,
              display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 16px", WebkitOverflowScrolling:"touch" }}>
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

        {/* Quick prompts */}
        <div style={{ padding:"6px 12px", display:"flex", gap:6, flexWrap:"wrap",
          borderTop:`1px solid ${C.border}`, flexShrink:0 }}>
          {["Best bet tonight","Who wins?","Build a parlay","Lakers game"].map(s => (
            <button key={s} className="suggestion-btn" onClick={() => sendMessage(s)}
              style={{ background:"transparent", border:`1px solid ${C.border}`,
                borderRadius:20, padding:"6px 14px", cursor:"pointer", fontSize:13,
                color:C.muted, fontFamily:"'Barlow Condensed',sans-serif",
                minHeight:36 }}>
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ padding:"8px 12px", paddingBottom:"max(8px, env(safe-area-inset-bottom))", flexShrink:0 }}>
          <div style={{ display:"flex", gap:8, background:C.card,
            border:`1px solid ${C.border}`, borderRadius:10, padding:"4px 4px 4px 14px" }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask anything about NBA..."
              disabled={loading}
              style={{ flex:1, background:"transparent", border:"none", outline:"none",
                color:C.text, fontSize:16, fontFamily:"'Barlow Condensed',sans-serif",
                padding:"8px 0", minHeight:44 }} />
            <button className="send-btn" onClick={() => sendMessage()} disabled={loading}
              style={{ background: loading ? C.dim : C.accent, border:"none", borderRadius:7,
                padding:"10px 20px", cursor: loading ? "not-allowed" : "pointer",
                fontFamily:"'Bebas Neue',sans-serif", fontSize:15, letterSpacing:"1px",
                color:"#000", flexShrink:0, minHeight:44 }}>
              {loading ? "..." : "SEND"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
