#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# update-dev-stats.sh
# Genera src/data/devStats.js con métricas auditables del repositorio.
# Ejecutar antes de cada build o cuando se quiera actualizar el panel de valoración.
# Uso: bash scripts/update-dev-stats.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

COMMITS=$(git log --oneline | wc -l | tr -d ' ')
FIRST_DATE=$(git log --format="%ad" --date=short | tail -1)
LAST_DATE=$(git log --format="%ad" --date=short | head -1)
ACTIVE_DAYS=$(git log --format="%ad" --date=format:"%Y-%m-%d" | sort -u | wc -l | tr -d ' ')
LINES_ADDED=$(git log --numstat --format="" | awk 'NF==3 {sum+=$1} END {print sum}')
LINES_DELETED=$(git log --numstat --format="" | awk 'NF==3 {sum+=$2} END {print sum}')
SLOC=$(find src -name "*.jsx" -o -name "*.js" -o -name "*.css" | grep -v node_modules | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
JSX_FILES=$(find src -name "*.jsx" | grep -v node_modules | wc -l | tr -d ' ')
JS_FILES=$(find src -name "*.js" | grep -v node_modules | wc -l | tr -d ' ')
CSS_FILES=$(find src -name "*.css" | grep -v node_modules | wc -l | tr -d ' ')
TOTAL_FILES=$((JSX_FILES + JS_FILES + CSS_FILES))

# Top 5 commit days
TOP_DAYS=$(git log --format="%ad" --date=format:"%Y-%m-%d" | sort | uniq -c | sort -rn | head -5 | awk '{print "{\"date\":\""$2"\",\"commits\":"$1"}"}' | paste -sd ',' -)

# Recent commits (last 15)
RECENT=$(git log --format="%ad|||%s" --date=format:"%Y-%m-%d" | head -15 | while IFS='|||' read date msg; do
  msg_escaped=$(echo "$msg" | sed 's/"/\\"/g')
  echo "{\"date\":\"$date\",\"msg\":\"$msg_escaped\"}"
done | paste -sd ',' -)

GENERATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > src/data/devStats.js << EOF
// AUTO-GENERADO — ejecutar: bash scripts/update-dev-stats.sh
// Fuente de verdad: git history del repositorio (inmutable, auditable)
// Generado: $GENERATED_AT

export const DEV_STATS = {
  generatedAt: "$GENERATED_AT",
  repo: {
    firstCommit: "$FIRST_DATE",
    lastCommit:  "$LAST_DATE",
    totalCommits: $COMMITS,
    activeDays:   $ACTIVE_DAYS,
  },
  code: {
    sloc:          $SLOC,
    linesAdded:    $LINES_ADDED,
    linesDeleted:  $LINES_DELETED,
    totalFiles:    $TOTAL_FILES,
    jsxComponents: $JSX_FILES,
    jsFiles:       $JS_FILES,
    cssFiles:      $CSS_FILES,
  },
  activity: {
    topDays:      [$TOP_DAYS],
    recentCommits: [$RECENT],
  },
};
EOF

echo "✓ src/data/devStats.js actualizado"
echo "  Commits: $COMMITS | SLOC: $SLOC | Días activos: $ACTIVE_DAYS"
