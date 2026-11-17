"use strict";

const missionDifficulties = ["初級", "中級", "上級"];
const dailyPools = [
  [["fish30", "魚を累計30匹キャッチ", "catches", 30], ["play3", "3回プレイ完了", "plays", 3],
    ["clean", "長靴を一度もキャッチせずにクリア", "clean", 1]],
  [["gold3", "金の魚を3匹キャッチ", "gold", 3], ["rare2", "レア魚を2匹キャッチ", "rare", 2],
    ["combo10", "10コンボ達成", "combo", 10], ["score300", "1プレイで300点達成", "score", 300]],
  [["fish100", "魚を累計100匹キャッチ", "catches", 100], ["combo20", "20コンボ達成", "combo", 20],
    ["score500", "1プレイで500点達成", "score", 500]],
];
const weeklyGoals = [
  { id: "play14", label: "14回プレイ完了", metric: "plays", target: 14, xp: 300, tier: 0 },
  { id: "fish250", label: "累計250匹キャッチ", metric: "catches", target: 250, xp: 600, tier: 1 },
  { id: "rare8", label: "レア魚を累計8匹キャッチ", metric: "rare", target: 8, xp: 1000, tier: 2 },
];
const playerTitles = [
  { id: "first", label: "はじめてのねこ", hint: "1回プレイ完了", earned: (p) => p.plays >= 1 },
  { id: "hunter", label: "おさかなハンター", hint: "魚を累計50匹キャッチ", earned: (p) => p.catches >= 50 },
  { id: "combo", label: "コンボの達人", hint: "10コンボ達成", earned: (p) => p.maxCombo >= 10 },
  { id: "gold", label: "金魚コレクター", hint: "金の魚を累計10匹キャッチ", earned: (p) => p.gold >= 10 },
  { id: "rare", label: "レア魚博士", hint: "レア魚を6種類発見", earned: (p) => Object.keys(p.collection).length >= 6 },
  { id: "ghost", label: "まぼろしを追うねこ", hint: "まぼろしフィッシュを発見", earned: (p) => Boolean(p.collection.ghost) },
  { id: "legend", label: "伝説のおさかなマスター", hint: "でんせつの金魚を発見", earned: (p) => Boolean(p.collection.legend) },
];
const periodMetrics = ["catches", "gold", "rare", "combo", "score", "plays", "clean"];

function shiftPlayDay(day, offset) {
  // UTC arithmetic on a local date label avoids daylight-saving jumps.
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function weekStart(day) {
  const weekday = new Date(day + "T00:00:00Z").getUTCDay();
  return shiftPlayDay(day, -((weekday + 6) % 7));
}

function dailyGoals(day) {
  const ordinal = Date.parse(day + "T00:00:00Z") / 86400000;
  return dailyPools.map((pool, tier) => {
    const index = ((ordinal + tier) % pool.length + pool.length) % pool.length;
    const [id, label, metric, target] = pool[index];
    return { id, label, metric, target, tier, xp: (tier + 1) * 50 };
  });
}

function emptyPeriod() {
  return { counts: Object.fromEntries(periodMetrics.map((key) => [key, 0])), claimed: [], bonus: false, sweep: false };
}

function normalizePeriods(raw, weekly) {
  const periods = {};
  if (!raw || typeof raw !== "object") return periods;
  for (const [day, value] of Object.entries(raw)) {
    if (!isPlayDay(day) || (weekly && weekStart(day) !== day) || !value || typeof value !== "object") continue;
    const valid = weekly ? weeklyGoals : dailyGoals(day);
    periods[day] = {
      counts: Object.fromEntries(periodMetrics.map((key) => [key, safeCount(value.counts?.[key])])),
      claimed: valid.filter(({ id }) => Array.isArray(value.claimed) && value.claimed.includes(id)).map(({ id }) => id),
      bonus: !weekly && value.bonus === true,
      sweep: !weekly && value.sweep === true,
    };
  }
  return periods;
}

function knownPlayStreak(days, today = localPlayDay()) {
  const ordered = [...new Set(days)].sort();
  let previous;
  let longest = 0;
  let run = 0;
  let current = 0;
  const yesterday = shiftPlayDay(today, -1);
  for (const day of ordered) {
    run = previous && shiftPlayDay(previous, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    if (day === today || day === yesterday) current = run;
    previous = day;
  }
  return { current, longest };
}

function totalRareCaught(collection) {
  return Object.values(collection).reduce((total, fish) => addCounts(total, fish.count), 0);
}

function advancePeriod(period, goals, round, rewards) {
  const counts = period.counts;
  counts.catches = addCounts(counts.catches, round.catches);
  counts.gold = addCounts(counts.gold, round.gold);
  counts.rare = addCounts(counts.rare, totalRareCaught(round.collection));
  counts.combo = Math.max(counts.combo, round.maxCombo);
  counts.score = Math.max(counts.score, round.roundScore);
  counts.plays = addCounts(counts.plays, 1);
  if (!round.boots) counts.clean = addCounts(counts.clean, 1);
  for (const goal of goals) {
    if (counts[goal.metric] < goal.target || period.claimed.includes(goal.id)) continue;
    period.claimed.push(goal.id);
    rewards.push({ label: goal.label, xp: goal.xp });
  }
}

function awardPeriodicRewards(progress, round) {
  const rewards = [];
  const day = round.day;
  const week = weekStart(day);
  const copy = (period) => period
    ? { ...period, counts: { ...period.counts }, claimed: [...period.claimed] }
    : emptyPeriod();
  const daily = copy(progress.daily[day]);
  const weekly = copy(progress.weekly[week]);
  progress.daily = { ...progress.daily, [day]: daily };
  progress.weekly = { ...progress.weekly, [week]: weekly };
  const goals = dailyGoals(day);
  if (!daily.bonus) {
    daily.bonus = true;
    rewards.push({ label: "デイリーボーナス", xp: 100 });
  }
  advancePeriod(daily, goals, round, rewards);
  advancePeriod(weekly, weeklyGoals, round, rewards);
  if (!daily.sweep && goals.every(({ id }) => daily.claimed.includes(id))) {
    daily.sweep = true;
    rewards.push({ label: "デイリー全達成", xp: 200 });
  }
  return rewards;
}
