#!/usr/bin/env bash
#
# Manual full backup of the Supabase project this app points at.
#
# Why this exists: the project is on Supabase's free plan, which has no
# automated PITR / daily backups. This dumps every table's data (via the
# REST API, service-role key — bypasses RLS) plus every Storage object,
# into a timestamped folder OUTSIDE the git repo. Schema (tables,
# constraints, RLS policies, functions) is NOT re-captured here — it
# already lives as version-controlled SQL in supabase/migrations/, and
# restoring this backup's data assumes those migrations are applied first.
#
# Usage:
#   bash scripts/backup-supabase.sh [output-dir]
#   npm run backup:supabase
#
# Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
# .env.local in the repo root. Requires curl and node (both already
# needed to work on this repo).

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found." >&2
  exit 1
fi

SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d= -f2-)
SERVICE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV_FILE" | cut -d= -f2-)

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_KEY" ]; then
  echo "Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from .env.local." >&2
  exit 1
fi

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT_DIR="${1:-$REPO_ROOT/../wacrm-biodata-backups/$TIMESTAMP}"
mkdir -p "$OUT_DIR/tables" "$OUT_DIR/storage"

echo "Backing up to: $OUT_DIR"

# ------------------------------------------------------------------
# 1. Table data — table list derived from the migrations themselves so
#    this stays in sync as the schema grows, rather than a hardcoded
#    list that goes stale.
# ------------------------------------------------------------------
TABLES=$(grep -rhoE "CREATE TABLE( IF NOT EXISTS)? [a-z_]+" "$REPO_ROOT"/supabase/migrations/*.sql \
  | awk '{print $NF}' | sort -u)

FAILED=""
for t in $TABLES; do
  out="$OUT_DIR/tables/$t.json"
  http_code=$(curl -s -o "$out" -w "%{http_code}" "$SUPABASE_URL/rest/v1/$t?select=*" \
    -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY")
  if [ "$http_code" != "200" ]; then
    echo "  FAILED table $t (HTTP $http_code)"
    FAILED="$FAILED $t"
  fi
done
echo "Tables backed up: $(echo "$TABLES" | wc -l | tr -d ' ')"

# ------------------------------------------------------------------
# 2. Storage buckets — bucket list + object listing fetched live
#    (not hardcoded), objects downloaded preserving their path.
# ------------------------------------------------------------------
BUCKETS=$(curl -s "$SUPABASE_URL/storage/v1/bucket" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
  | node -e 'const b=JSON.parse(require("fs").readFileSync(0,"utf8"));b.forEach(x=>console.log(x.id))')

# Recursively list a bucket prefix (Storage's list API returns folders
# as entries with id:null — we recurse into those) and download every
# real object found, preserving its path under storage/<bucket>/...
list_and_download() {
  local bucket="$1" prefix="$2"
  local listing
  listing=$(curl -s -X POST "$SUPABASE_URL/storage/v1/object/list/$bucket" \
    -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"prefix\":\"$prefix\",\"limit\":1000,\"offset\":0}")

  node -e '
    const entries = JSON.parse(process.argv[1]);
    for (const e of entries) {
      console.log((e.id === null ? "DIR:" : "FILE:") + e.name);
    }
  ' "$listing" | while IFS= read -r line; do
    local kind="${line%%:*}"
    local name="${line#*:}"
    local full="${prefix:+$prefix/}$name"
    if [ "$kind" = "DIR" ]; then
      list_and_download "$bucket" "$full"
    else
      mkdir -p "$OUT_DIR/storage/$bucket/$(dirname "$full")"
      curl -s -o "$OUT_DIR/storage/$bucket/$full" \
        "$SUPABASE_URL/storage/v1/object/$bucket/$full" \
        -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY"
    fi
  done
}

for bucket in $BUCKETS; do
  list_and_download "$bucket" ""
done
echo "Storage objects backed up: $(find "$OUT_DIR/storage" -type f | wc -l | tr -d ' ')"

# ------------------------------------------------------------------
# 3. Manifest + row counts
# ------------------------------------------------------------------
node -e '
  const fs = require("fs");
  const path = require("path");
  const dir = path.join(process.argv[1], "tables");
  const counts = {};
  for (const f of fs.readdirSync(dir)) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      counts[f.replace(".json", "")] = Array.isArray(data) ? data.length : "ERROR";
    } catch {
      counts[f.replace(".json", "")] = "ERROR";
    }
  }
  fs.writeFileSync(path.join(process.argv[1], "row_counts.json"), JSON.stringify(counts, null, 2));
' "$OUT_DIR"

cat > "$OUT_DIR/MANIFEST.md" <<EOF
# Supabase backup — $TIMESTAMP

Manual backup (Supabase free plan has no automated PITR/daily backups).

## Included
- tables/*.json — full data dump of every table (see row_counts.json)
- storage/ — every object in every Storage bucket, original paths preserved

## NOT included
- Schema (tables/constraints/RLS/functions) — already version-controlled in supabase/migrations/
- auth.users — not reachable via this key; recreate logins separately if ever lost

## Restore
Data only, assumes migrations already applied to the target DB. POST each
tables/<name>.json array to {SUPABASE_URL}/rest/v1/<name> (service-role key,
Prefer: return=representation), parents before children (accounts, profiles,
contacts/tags, conversations, messages, flows, flow_nodes, flow_runs, ...).
Re-upload storage/<bucket>/<path> files to the matching bucket/path.

## Reminder
Contains real customer data. Move this folder to encrypted/secure storage —
don't leave it as plain files, don't commit it to git.
EOF

if [ -n "$FAILED" ]; then
  echo ""
  echo "Completed with failures:$FAILED"
  exit 1
fi

echo ""
echo "Backup complete: $OUT_DIR"
