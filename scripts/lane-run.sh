#!/usr/bin/env bash
# Runs the back-end and front-end stages of one Schedule vertical, one after the other, each in a fresh
# Claude session (a fresh process is a cleared context). Design stays manual: the owner approves it.
#
#   scripts/lane-run.sh <lane> <vertical> <first-stage> [last-stage]
#   scripts/lane-run.sh 2 v3 frontend          # only the front end
#   scripts/lane-run.sh 4 v2 backend frontend  # back end, check, then front end
#
# Stops (and says why) when a check fails. Nothing is pushed and nothing touches main.
set -uo pipefail

LANE="${1:-}"; VERT="${2:-}"; FIRST="${3:-}"; LAST="${4:-${3:-}}"
[[ -n "$LANE" && -n "$VERT" && -n "$FIRST" ]] || { sed -n 2,10p "$0"; exit 2; }

DIR="$HOME/Projects/V3-RMS-lanes/lane-$LANE"
BRANCH="design/workforce-2-$VERT"
FLOW="docs/features/workforce"
DEVNOTES="$FLOW/final-pass/design-notes-2-$VERT.md"
LOG="$HOME/Projects/owner-review/lane-run-$VERT-$(date +%Y%m%d-%H%M).log"
mkdir -p "$(dirname "$LOG")"

say() { echo "[lane-run $(date +%H:%M:%S)] $*" | tee -a "$LOG"; }
stop() { say "STOPPED: $*"; exit 1; }

[[ -d "$DIR" ]] || stop "no worktree at $DIR"
cd "$DIR" || stop "cannot enter $DIR"

# One session per lane: refuse to start if another Claude session already runs from this lane.
for p in $(pgrep -x claude 2>/dev/null); do
  [[ "$(readlink "/proc/$p/cwd" 2>/dev/null)" == "$DIR"* ]] && stop "a Claude session (pid $p) is already open in lane $LANE; close it first"
done

[[ -z "$(git status --porcelain)" ]] || stop "lane $LANE has uncommitted changes; commit or stash them first"
git fetch -q origin
git checkout -q "$BRANCH" || stop "branch $BRANCH is not in this worktree's repo"

stage_prompt() { # $1 stage  $2 previous hand-off file
  local what
  case "$1" in
    backend)  what="the BACK-END STAGE ONLY: the checklist in section (c). Do not touch the front end or Paper. Write the API notes in docs/API_CONTRACT.md and the module README, and write $FLOW/handoff-2-$VERT-backend.md in the fixed shape (sections (a) to (h), 60 lines at most)." ;;
    frontend) what="the FRONT-END STAGE ONLY: the checklist in section (c). Build from the approved Paper frames named in the design notes (read each frame in Paper before building it, compare line by line afterwards). Change the back end only to report a gap. Verify in one real browser page (console clean, network correct), run pnpm build in frontend, and finish with Deleted and Kept lists." ;;
  esac
  cat <<EOF
You are the $1 session for Wendo RMS Workforce, final pass, section 2 (Schedule), vertical ${VERT^^}, in the lane $LANE worktree ($DIR) on branch $BRANCH. The owner is not a developer and is away: plain words, short, no he, she, her or his; role alone or name plus role. Nobody can answer questions: when a decision belongs to the owner, do not guess; write it under "stopped for" in your final message and stop.
Read, in this order and only these: $2 (all), $DEVNOTES, $FLOW/final-pass/2-schedule-plan.md (this vertical's row and the hand-off protocol), $FLOW/TESTING.md, then the files the hand-off names in section (e).
Do $what
Use your own clean test database for lane $LANE as TESTING.md names it, never the owner's main database or a demo-seeded lane. Access goes through requireCapability, never a new requireRole list. Edit and Write tools only (no sed, python or heredoc edits). Keep a live task list, no subagents. Commit with git add of explicit paths and the attribution line you were given. Never push, never touch main. Leave the servers stopped. Finish with a plain five-line recap, the rule slips, and what you stopped for. Do this stage only, then stop.
EOF
}

check_stage() { # $1 stage  $2 commit before
  local after; after="$(git rev-parse HEAD)"
  [[ "$after" != "$2" ]] || stop "$1 made no commit"
  [[ -z "$(git status --porcelain -- backend/src frontend/features frontend/components docs)" ]] || say "WARNING: uncommitted changes remain after $1: $(git status --porcelain | head -5 | tr '\n' ' ')"
  if [[ "$1" == "backend" ]]; then
    local f="$FLOW/handoff-2-$VERT-backend.md"
    [[ -f "$f" ]] || stop "backend left no hand-off file $f"
    [[ "$(wc -l <"$f")" -le 60 ]] || stop "hand-off is longer than 60 lines"
    for h in a b c d e f g h; do grep -q "^## ($h)" "$f" || stop "hand-off lacks section ($h)"; done
    (cd backend && pnpm exec tsc --noEmit) >>"$LOG" 2>&1 || stop "back-end type check failed (see $LOG)"
  else
    rm -rf frontend/.next/types
    (cd frontend && pnpm exec tsc --noEmit) >>"$LOG" 2>&1 || stop "front-end type check failed (see $LOG)"
    (cd frontend && pnpm exec vitest run features/workforce) >>"$LOG" 2>&1 || stop "front-end Workforce tests failed (see $LOG)"
  fi
  say "$1 passed its checks"
}

STAGES=(backend frontend)
run=0
for s in "${STAGES[@]}"; do
  [[ "$s" == "$FIRST" ]] && run=1
  [[ $run -eq 1 ]] || continue
  if [[ "$s" == "backend" ]]; then prev="$FLOW/handoff-2-$VERT-design.md"; else prev="$FLOW/handoff-2-$VERT-backend.md"; fi
  [[ -f "$prev" ]] || stop "the previous hand-off $prev is missing on $BRANCH"
  before="$(git rev-parse HEAD)"
  say "starting $s (log: $LOG)"
  claude -p --dangerously-skip-permissions "$(stage_prompt "$s" "$prev")" >>"$LOG" 2>&1 || stop "$s session ended with an error (see $LOG)"
  check_stage "$s" "$before"
  [[ "$s" == "$LAST" ]] && break
done
say "DONE. Branch $BRANCH is committed and not pushed. Paste the log's last report to the orchestrator."
