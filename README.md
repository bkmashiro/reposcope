# reposcope

`reposcope` is a local-first CLI and web dashboard for exploring Git repositories without a paid plan, browser extension, or hosted account. It generates a single HTML report with branch topology, contributor activity, churn hotspots, blame breakdowns, and commit cadence.

## What the dashboard shows

The generated report opens as a single-page dashboard:

- A branch graph with commits plotted across branch lanes, showing merges and branch ownership over time.
- A contributor heatmap inspired by GitHub's calendar view, highlighting active days per author.
- A file churn chart ranking the files changed most often, with author context and line movement.
- A contributor table summarizing commit volume, insertions, deletions, and active days.
- A blame summary table listing the current top authors for frequently changed files.
- A timeline area chart showing weekly commit activity.

If this README had screenshots, they would show a warm-toned dashboard with a multi-lane branch graph at the top, compact heatmaps and timeline cards in the middle, and contributor plus blame tables below.

## Install

```bash
npm i -g reposcope
```

## Quick start

```bash
reposcope analyze . && open reposcope-report.html
```

## Commands

### `reposcope analyze [repo-path] [options]`

Analyze a repository and write a self-contained HTML report by default.

Options:

- `--output <file>`: Output file path. Defaults to `reposcope-report.html`.
- `--limit <n>`: Maximum number of commits to analyze. Defaults to `1000`.
- `--json`: Print the raw analysis payload instead of writing HTML.

Example:

```bash
reposcope analyze . --output history.html --limit 500
```

### `reposcope serve [repo-path] [options]`

Run a local HTTP server that re-analyzes the repository on each request and serves a fresh dashboard.

Options:

- `--port <n>`: Port to bind. Defaults to `4242`.
- `--open`: Open the browser automatically after the server starts.

Example:

```bash
reposcope serve . --port 4242 --open
```

### `reposcope stats [repo-path]`

Print a quick terminal summary without generating HTML.

Example:

```bash
reposcope stats .
```

## How it works

`reposcope` shells out to the local Git binary to extract commit metadata, contributor activity, numstat churn data, and blame details. The CLI serializes that data into one HTML file with inline CSS and inline D3 rendering code, so reports are portable and easy to archive.

## GitKraken and GitLens comparison

- `reposcope` is free and open-source.
- `reposcope` runs entirely on your machine with no account required.
- `reposcope` produces a shareable static report instead of locking history views behind a running app.
- `reposcope` is better suited for repository audits and snapshots than for in-editor review workflows.

## Development

```bash
pnpm install
pnpm build
pnpm test
```
