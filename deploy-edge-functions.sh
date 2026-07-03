#!/bin/bash
# Deploy all Edge Functions (folders under supabase/functions with index.ts, excluding _shared).

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ ! -d "supabase/functions" ]; then
  echo "Error: run from project root."
  exit 1
fi

if ! command -v supabase &> /dev/null; then
  echo "Error: Supabase CLI not installed."
  exit 1
fi

echo -e "${BLUE}Deploying Edge Functions (verify_jwt follows supabase/config.toml)...${NC}"
count=0
for dir in supabase/functions/*/; do
  name=$(basename "$dir")
  if [ "$name" = "_shared" ]; then
    continue
  fi
  if [ -f "${dir}index.ts" ]; then
    echo -e "${GREEN}→${NC} $name"
    supabase functions deploy "$name" --no-verify-jwt
    count=$((count + 1))
  fi
done

echo -e "${GREEN}Done. Deployed ${count} function(s).${NC}"
