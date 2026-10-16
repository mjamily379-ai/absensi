// backend/config/scoring.js
// Centralized, configurable scoring rules for the attendance ranking (Phase 5.6).
//
// Previously the weights were hardcoded inline in attendanceController.getRanking
// (base 50 + 10/record, -5 late, +2 early/on-time). They now live here and can be
// tuned via environment variables without touching the controller logic:
//
//   RANKING_BASE           base participation score when a user has any records   (default 50)
//   RANKING_PER_RECORD     points earned per clock-in record                      (default 10)
//   RANKING_LATE_PENALTY   points deducted per late arrival on a workday          (default 5)
//   RANKING_ON_TIME_BONUS  bonus for arriving early / on-time on a workday        (default 2)
//   RANKING_MIN_SCORE      scores are clamped to this floor                       (default 0)
//
// Ranking behavior notes (documented so the rule stays transparent):
//   * Window is one calendar month (configurable via month/year query on the endpoint).
//   * Only clock-in records count toward the score.
//   * "Late" = arrival later than the role's WorkDay.startTime for that weekday.
//   * Only workdays (WorkDay.isWorkDay === true) earn the late penalty / on-time bonus.

const numberFromEnv = (name, fallback) => {
    const raw = process.env[name];
    if (raw === undefined || raw === null || raw === '') return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const scoring = {
    ranking: {
        base: numberFromEnv('RANKING_BASE', 50),
        perRecord: numberFromEnv('RANKING_PER_RECORD', 10),
        latePenalty: numberFromEnv('RANKING_LATE_PENALTY', 5),
        onTimeBonus: numberFromEnv('RANKING_ON_TIME_BONUS', 2),
        minScore: numberFromEnv('RANKING_MIN_SCORE', 0)
    }
};

module.exports = scoring;