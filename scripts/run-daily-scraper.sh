#!/bin/bash
# Corn Intel Daily Scraper Runner
# Called by launchd (corn-intel-scraper.plist) at 6:00 AM CT weekdays
#
# Logs go to /tmp/corn-intel-scraper.log

LOG="/tmp/corn-intel-scraper.log"
PROJECT="/Users/cornelius/Documents/Corn Intel"

echo "========================================" >> "$LOG"
echo "Scraper run: $(date)" >> "$LOG"
echo "========================================" >> "$LOG"

# Ensure node/npx are in PATH
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

cd "$PROJECT" || { echo "Failed to cd to $PROJECT" >> "$LOG"; exit 1; }

# Run the scraper
npx tsx scripts/scrape-live-bids.ts >> "$LOG" 2>&1
EXIT_CODE=$?

echo "" >> "$LOG"
echo "Exit code: $EXIT_CODE" >> "$LOG"
echo "Completed: $(date)" >> "$LOG"
echo "" >> "$LOG"

exit $EXIT_CODE
