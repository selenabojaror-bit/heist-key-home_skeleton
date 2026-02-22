export function scoresRepo(db) {
  function orderByClause() {
    return `
      CASE WHEN score IS NULL THEN 1 ELSE 0 END ASC,
      score DESC,
      CASE WHEN time_ms IS NULL THEN 1 ELSE 0 END ASC,
      time_ms ASC,
      CASE WHEN ticks IS NULL THEN 1 ELSE 0 END ASC,
      ticks ASC,
      created_at DESC
    `;
  }

  return {
    async insertScore({ levelId, playerName, timeMs, ticks, score, alerts }) {
      const res = await db.run(
        `
        INSERT INTO scores (level_id, player_name, time_ms, ticks, score, alerts)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          levelId,
          playerName,
          timeMs ?? null,
          ticks ?? null,
          score ?? null,
          alerts ?? null,
        ]
      );

      return res.lastID;
    },

    async getBestByPlayerLevel(levelId, playerName) {
      return db.get(
        `
        SELECT
          id, level_id, player_name, time_ms, ticks, score, alerts, created_at
        FROM scores
        WHERE level_id = ? AND player_name = ?
        ORDER BY ${orderByClause()}
        LIMIT 1
        `,
        [levelId, playerName]
      );
    },

    async updateScore(id, { timeMs, ticks, score, alerts }) {
      await db.run(
        `
        UPDATE scores
        SET time_ms = ?, ticks = ?, score = ?, alerts = ?, created_at = datetime('now')
        WHERE id = ?
        `,
        [timeMs ?? null, ticks ?? null, score ?? null, alerts ?? null, id]
      );
      return id;
    },

    async getLevelStats(levelId) {
      return db.get(
        `
        SELECT
          MIN(time_ms)  AS min_time_ms,
          MAX(time_ms)  AS max_time_ms,
          MIN(ticks)    AS min_ticks,
          MAX(ticks)    AS max_ticks
        FROM scores
        WHERE level_id = ?
          AND time_ms IS NOT NULL
          AND ticks IS NOT NULL
        `,
        [levelId]
      );
    },

    async getTopScoresByLevel(levelId, limit = 10) {
      return db.all(
        `
        WITH ranked AS (
          SELECT
            id, level_id, player_name, time_ms, ticks, score, alerts, created_at,
            ROW_NUMBER() OVER (
              PARTITION BY level_id, player_name
              ORDER BY ${orderByClause()}
            ) AS rn
          FROM scores
          WHERE level_id = ?
        )
        SELECT
          id, level_id, player_name, time_ms, ticks, score, alerts, created_at
        FROM ranked
        WHERE rn = 1
        ORDER BY ${orderByClause()}
        LIMIT ?
        `,
        [levelId, limit]
      );
    },
  };
}