# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IRoar Premium is a Chrome extension (Manifest V3) that enhances Clemson University's course registration page by displaying Rate My Professors ratings and historical grade distribution data for each professor.

## Development Setup

1. Load extension in Chrome: `chrome://extensions/` -> Enable Developer mode -> Load unpacked -> Select project folder
2. Test on: https://regssb.sis.clemson.edu/StudentRegistrationSsb/ssb/prepareRegistration/prepareRegistration

No build process required - vanilla JavaScript, CSS, and static CSV files.

## Architecture

### Extension Components

- **manifest.json**: Manifest V3 configuration. Defines content script injection on `regssb.sis.clemson.edu` and background service worker.

- **background.js**: Service worker handling two types of requests:
  - Rate My Professors GraphQL API queries (search + detailed professor data)
  - Grade distribution CSV parsing and search
  - Uses hardcoded Clemson school ID `U2Nob29sLTI0Mg==` for RMP queries

- **content.js**: Injected into Clemson registration pages. Uses MutationObserver to detect professor cells (`td[data-property="instructor"]`) and:
  - Connects to background.js via `chrome.runtime.connect()` ports
  - Inserts RMP ratings (rating, difficulty, would-take-again %)
  - Adds clickable "Grade Distribution" links that open popup modal

- **styles.css**: Styling for injected rating elements and grade distribution popup

### Data Flow

1. Content script finds professor names in DOM (from `mailto:` links)
2. Sends professor name to background.js via port messaging
3. Background.js queries RMP GraphQL API or searches CSV files
4. Response displayed inline in registration table

### Grade Distribution Data

CSV files in `grade_distributions_final/` contain historical grade data (2013-2024). Format: Course info + grade percentages (A, B, C, D, F, P, F(P), W, I). Background.js searches by professor first/last name across all CSV files.

### Caching

- **RMP data**: Two-tier cache (in-memory Map + `chrome.storage.local`) with 7-day TTL. Caches both successful lookups and "not found" results.
- **CSV data**: In-memory cache loads all CSV files once per service worker lifetime, pre-computes lowercase search text for fast filtering.

## Key Implementation Details

- Professor names extracted from format "Last, First" and converted to "First Last"
- `data-processed="true"` attribute prevents duplicate processing
- Popup positioning uses fixed centering with transform
- RMP API auth token is public (`dGVzdDp0ZXN0` = "test:test")
