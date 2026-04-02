import type { RepoData } from './git.js'

export interface ChartData {
  commits: RepoData['commits']
  contributors: RepoData['contributors']
  fileChurn: RepoData['fileChurn']
  repoName: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function buildStyle(): string {
  return `
    :root {
      --bg: #f5f1e8;
      --panel: rgba(255, 252, 245, 0.88);
      --panel-border: rgba(91, 74, 57, 0.16);
      --text: #2b241d;
      --muted: #6d5f51;
      --accent: #b85c38;
      --accent-2: #355c7d;
      --accent-3: #6c8b4e;
      --accent-4: #c58f2c;
      --grid: rgba(53, 92, 125, 0.12);
      --shadow: 0 18px 40px rgba(43, 36, 29, 0.12);
      --font-display: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
      --font-body: "Avenir Next", "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--font-body);
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(184, 92, 56, 0.16), transparent 34%),
        radial-gradient(circle at top right, rgba(53, 92, 125, 0.18), transparent 28%),
        linear-gradient(180deg, #f7f3eb 0%, #eee5d6 100%);
    }
    header {
      padding: 32px 24px 20px;
    }
    h1, h2 {
      font-family: var(--font-display);
      margin: 0;
      letter-spacing: 0.02em;
    }
    h1 {
      font-size: clamp(2rem, 5vw, 3.8rem);
    }
    .subtitle {
      margin-top: 10px;
      color: var(--muted);
      max-width: 70ch;
      line-height: 1.5;
    }
    nav {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      padding: 14px 24px 18px;
      backdrop-filter: blur(12px);
      background: rgba(247, 243, 235, 0.76);
      border-bottom: 1px solid rgba(91, 74, 57, 0.08);
    }
    nav a {
      text-decoration: none;
      color: var(--text);
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.55);
      border: 1px solid transparent;
      transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
    }
    nav a:hover {
      transform: translateY(-1px);
      border-color: rgba(184, 92, 56, 0.2);
      background: rgba(255, 255, 255, 0.88);
    }
    main {
      display: grid;
      gap: 18px;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      padding: 0 24px 24px;
    }
    section {
      min-height: 320px;
      padding: 20px;
      border: 1px solid var(--panel-border);
      border-radius: 24px;
      background: var(--panel);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    section.wide {
      grid-column: 1 / -1;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin: 20px 24px 24px;
    }
    .stat {
      border-radius: 18px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.56);
      border: 1px solid rgba(91, 74, 57, 0.1);
    }
    .stat strong {
      display: block;
      font-size: 1.6rem;
      font-family: var(--font-display);
    }
    .chart {
      width: 100%;
      min-height: 260px;
    }
    .table-wrap {
      overflow: auto;
      max-height: 420px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95rem;
    }
    th, td {
      padding: 10px 8px;
      border-bottom: 1px solid rgba(91, 74, 57, 0.12);
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .tooltip {
      position: fixed;
      pointer-events: none;
      opacity: 0;
      padding: 10px 12px;
      border-radius: 14px;
      background: rgba(34, 27, 21, 0.92);
      color: #fff9f0;
      font-size: 0.88rem;
      box-shadow: 0 18px 32px rgba(0, 0, 0, 0.24);
      transition: opacity 120ms ease;
      max-width: 280px;
      z-index: 30;
    }
    .legend {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 10px;
      color: var(--muted);
      font-size: 0.9rem;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .legend-swatch {
      width: 12px;
      height: 12px;
      border-radius: 999px;
    }
    footer {
      padding: 0 24px 28px;
      color: var(--muted);
      font-size: 0.9rem;
    }
    @media (max-width: 720px) {
      main, nav, header, footer { padding-left: 16px; padding-right: 16px; }
      section { border-radius: 18px; }
    }
  `
}

function buildScript(data: RepoData): string {
  const json = JSON.stringify(data)
  return `
    const DATA = ${json};
    const tooltip = d3.select('body').append('div').attr('class', 'tooltip');
    const palette = ['#b85c38', '#355c7d', '#6c8b4e', '#c58f2c', '#7c4d6d', '#228b8d', '#c06c84', '#8b6f47'];
    const branchNames = [...new Set(DATA.commits.map((commit) => commit.branch || 'detached'))];
    const branchColor = d3.scaleOrdinal(branchNames, palette.concat(d3.schemeTableau10));

    function showTooltip(event, html) {
      tooltip.style('opacity', 1).html(html)
        .style('left', \`\${event.clientX + 12}px\`)
        .style('top', \`\${event.clientY + 12}px\`);
    }

    function hideTooltip() {
      tooltip.style('opacity', 0);
    }

    function sectionSvg(selector, height) {
      const container = d3.select(selector);
      const width = Math.max(300, container.node().clientWidth);
      container.selectAll('*').remove();
      return container.append('svg').attr('viewBox', \`0 0 \${width} \${height}\`).attr('class', 'chart');
    }

    function renderSummary() {
      document.getElementById('summary').innerHTML = [
        ['Commits', DATA.commits.length],
        ['Branches', DATA.branches.length],
        ['Contributors', DATA.contributors.length],
        ['Files', DATA.fileChurn.length]
      ].map(([label, value]) => \`<div class="stat"><strong>\${value}</strong><span>\${label}</span></div>\`).join('');
    }

    function renderBranchLegend() {
      document.getElementById('branch-legend').innerHTML = branchNames.map((branch) => (
        \`<div class="legend-item"><span class="legend-swatch" style="background:\${branchColor(branch)}"></span>\${branch}</div>\`
      )).join('');
    }

    function renderBranchGraph() {
      const svg = sectionSvg('#branch-graph', 420);
      const width = svg.node().viewBox.baseVal.width;
      const margin = { top: 20, right: 24, bottom: 42, left: 80 };
      const commits = [...DATA.commits]
        .map((commit) => ({ ...commit, dateObj: new Date(commit.date), branch: commit.branch || 'detached' }))
        .sort((a, b) => a.dateObj - b.dateObj);
      const x = d3.scaleTime()
        .domain(d3.extent(commits, (d) => d.dateObj))
        .range([margin.left, width - margin.right]);
      const y = d3.scalePoint()
        .domain(branchNames)
        .range([margin.top, 360])
        .padding(0.9);
      const byHash = new Map(commits.map((commit) => [commit.hash, commit]));

      svg.append('g')
        .attr('transform', \`translate(0,\${360})\`)
        .call(d3.axisBottom(x).ticks(Math.min(8, commits.length)).tickSizeOuter(0))
        .call((g) => g.selectAll('text').attr('fill', '#6d5f51'))
        .call((g) => g.selectAll('path,line').attr('stroke', 'rgba(53,92,125,0.25)'));

      svg.append('g')
        .attr('transform', \`translate(\${margin.left - 16},0)\`)
        .call(d3.axisLeft(y).tickSize(0))
        .call((g) => g.selectAll('text').attr('fill', '#6d5f51'))
        .call((g) => g.select('.domain').remove());

      svg.append('g').selectAll('line')
        .data(branchNames)
        .join('line')
        .attr('x1', margin.left)
        .attr('x2', width - margin.right)
        .attr('y1', (branch) => y(branch))
        .attr('y2', (branch) => y(branch))
        .attr('stroke', 'rgba(53,92,125,0.08)');

      svg.append('g')
        .selectAll('line.parent-link')
        .data(commits.flatMap((commit) => commit.parents.map((parent) => ({ commit, parent: byHash.get(parent) })).filter((entry) => entry.parent)))
        .join('line')
        .attr('x1', (d) => x(d.commit.dateObj))
        .attr('x2', (d) => x(d.parent.dateObj))
        .attr('y1', (d) => y(d.commit.branch))
        .attr('y2', (d) => y(d.parent.branch || 'detached'))
        .attr('stroke', (d) => branchColor(d.commit.branch))
        .attr('stroke-width', 1.6)
        .attr('opacity', 0.55);

      svg.append('g')
        .selectAll('circle.commit')
        .data(commits)
        .join('circle')
        .attr('cx', (d) => x(d.dateObj))
        .attr('cy', (d) => y(d.branch))
        .attr('r', 5.5)
        .attr('fill', (d) => branchColor(d.branch))
        .attr('stroke', '#fffaf2')
        .attr('stroke-width', 2)
        .on('mousemove', (event, d) => {
          showTooltip(event, \`<strong>\${d.shortHash}</strong> · \${d.author}<br>\${new Date(d.date).toLocaleString()}<br>\${d.subject}\`);
        })
        .on('mouseleave', hideTooltip);
    }

    function renderHeatmap() {
      const svg = sectionSvg('#heatmap', 240);
      const width = svg.node().viewBox.baseVal.width;
      const contributors = DATA.contributors.slice(0, 6);
      const commitsByDay = d3.rollup(
        DATA.commits,
        (items) => items.length,
        (commit) => commit.email,
        (commit) => commit.date.slice(0, 10)
      );
      const square = 14;
      const gap = 3;
      const start = d3.timeWeek.floor(d3.min(DATA.commits, (commit) => new Date(commit.date)));
      const end = d3.timeWeek.ceil(new Date());
      const weeks = d3.timeWeeks(start, end);
      const maxCount = d3.max(contributors.flatMap((contributor) => [...(commitsByDay.get(contributor.email)?.values() || [])])) || 1;
      const color = d3.scaleLinear().domain([0, maxCount]).range(['#f3e9d8', '#b85c38']);

      contributors.forEach((contributor, row) => {
        svg.append('text')
          .attr('x', 8)
          .attr('y', 28 + row * 30)
          .attr('fill', '#6d5f51')
          .attr('font-size', 11)
          .text(contributor.author);

        weeks.forEach((weekStart, weekIndex) => {
          for (let day = 0; day < 7; day += 1) {
            const date = d3.timeDay.offset(weekStart, day);
            const key = d3.timeFormat('%Y-%m-%d')(date);
            const count = commitsByDay.get(contributor.email)?.get(key) || 0;
            svg.append('rect')
              .attr('x', 90 + weekIndex * (square + gap))
              .attr('y', 16 + row * 30)
              .attr('width', square)
              .attr('height', square)
              .attr('rx', 3)
              .attr('fill', color(count))
              .attr('stroke', 'rgba(53,92,125,0.08)')
              .on('mousemove', (event) => {
                showTooltip(event, \`<strong>\${contributor.author}</strong><br>\${key}<br>\${count} commits\`);
              })
              .on('mouseleave', hideTooltip);
          }
        });
      });
    }

    function renderChurn() {
      const svg = sectionSvg('#churn', 420);
      const width = svg.node().viewBox.baseVal.width;
      const margin = { top: 16, right: 24, bottom: 24, left: 180 };
      const files = DATA.fileChurn.slice(0, 12).reverse();
      const x = d3.scaleLinear()
        .domain([0, d3.max(files, (d) => d.changeCount) || 1])
        .range([margin.left, width - margin.right]);
      const y = d3.scaleBand()
        .domain(files.map((entry) => entry.file))
        .range([margin.top, 360])
        .padding(0.18);

      svg.append('g')
        .selectAll('rect')
        .data(files)
        .join('rect')
        .attr('x', margin.left)
        .attr('y', (d) => y(d.file))
        .attr('width', (d) => x(d.changeCount) - margin.left)
        .attr('height', y.bandwidth())
        .attr('rx', 8)
        .attr('fill', (d) => branchColor(d.authors[0] || 'mixed'))
        .on('mousemove', (event, d) => {
          showTooltip(event, \`<strong>\${d.file}</strong><br>\${d.changeCount} changes<br>+\${d.insertions} / -\${d.deletions}<br>\${d.authors.join(', ')}\`);
        })
        .on('mouseleave', hideTooltip);

      svg.append('g')
        .attr('transform', \`translate(0,\${360})\`)
        .call(d3.axisBottom(x).ticks(5).tickSizeOuter(0))
        .call((g) => g.selectAll('text').attr('fill', '#6d5f51'))
        .call((g) => g.selectAll('path,line').attr('stroke', 'rgba(53,92,125,0.25)'));

      svg.append('g')
        .attr('transform', \`translate(\${margin.left},0)\`)
        .call(d3.axisLeft(y).tickSize(0))
        .call((g) => g.selectAll('text').attr('fill', '#6d5f51').attr('font-size', 11))
        .call((g) => g.select('.domain').remove());
    }

    function renderTimeline() {
      const svg = sectionSvg('#timeline', 300);
      const width = svg.node().viewBox.baseVal.width;
      const margin = { top: 20, right: 24, bottom: 38, left: 56 };
      const weekly = d3.rollups(
        DATA.commits,
        (items) => items.length,
        (commit) => d3.timeWeek.floor(new Date(commit.date))
      ).map(([week, count]) => ({ week, count })).sort((a, b) => a.week - b.week);
      const x = d3.scaleTime()
        .domain(d3.extent(weekly, (d) => d.week))
        .range([margin.left, width - margin.right]);
      const y = d3.scaleLinear()
        .domain([0, d3.max(weekly, (d) => d.count) || 1])
        .nice()
        .range([240, margin.top]);
      const area = d3.area()
        .x((d) => x(d.week))
        .y0(240)
        .y1((d) => y(d.count))
        .curve(d3.curveMonotoneX);

      svg.append('path')
        .datum(weekly)
        .attr('fill', 'rgba(53, 92, 125, 0.28)')
        .attr('stroke', '#355c7d')
        .attr('stroke-width', 2)
        .attr('d', area);

      svg.append('g')
        .attr('transform', 'translate(0,240)')
        .call(d3.axisBottom(x).ticks(Math.min(8, weekly.length)).tickSizeOuter(0))
        .call((g) => g.selectAll('text').attr('fill', '#6d5f51'))
        .call((g) => g.selectAll('path,line').attr('stroke', 'rgba(53,92,125,0.25)'));

      svg.append('g')
        .attr('transform', \`translate(\${margin.left},0)\`)
        .call(d3.axisLeft(y).ticks(5).tickSizeOuter(0))
        .call((g) => g.selectAll('text').attr('fill', '#6d5f51'))
        .call((g) => g.selectAll('path,line').attr('stroke', 'rgba(53,92,125,0.25)'));
    }

    function renderContributorTable() {
      document.getElementById('contributors-table').innerHTML = [
        '<table><thead><tr><th>Author</th><th>Commits</th><th>Lines</th><th>Range</th><th>Active Days</th></tr></thead><tbody>',
        DATA.contributors.map((contributor) => (
          \`<tr><td><strong>\${contributor.author}</strong><br><span style="color:#6d5f51">\${contributor.email}</span></td><td>\${contributor.commitCount}</td><td>+\${contributor.insertions} / -\${contributor.deletions}</td><td>\${contributor.firstCommit.slice(0, 10)} → \${contributor.lastCommit.slice(0, 10)}</td><td>\${contributor.activeDays}</td></tr>\`
        )).join(''),
        '</tbody></table>'
      ].join('');
    }

    function renderBlameTable() {
      document.getElementById('blame-table').innerHTML = [
        '<table><thead><tr><th>File</th><th>Lines</th><th>Top Authors</th></tr></thead><tbody>',
        DATA.blameSummary.map((item) => {
          const authors = item.authors.slice(0, 3).map((author) => \`\${author.author} (\${author.percentage}%)\`).join('<br>');
          return \`<tr><td><strong>\${item.file}</strong></td><td>\${item.totalLines}</td><td>\${authors || 'Unavailable'}</td></tr>\`;
        }).join(''),
        '</tbody></table>'
      ].join('');
    }

    function render() {
      renderSummary();
      renderBranchLegend();
      renderBranchGraph();
      renderHeatmap();
      renderChurn();
      renderTimeline();
      renderContributorTable();
      renderBlameTable();
    }

    window.addEventListener('resize', () => render());
    render();
  `
}

export function generateReport(data: RepoData): string {
  const title = `reposcope — ${data.repoName}`
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <style>${buildStyle()}</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(data.repoName)}</h1>
    <p class="subtitle">Interactive repository forensics for branches, churn, authorship, and delivery cadence. Generated at ${escapeHtml(new Date(data.analyzedAt).toLocaleString())}.</p>
  </header>
  <nav>
    <a href="#branch">Branch Graph</a>
    <a href="#heatmap-section">Heatmap</a>
    <a href="#churn-section">File Churn</a>
    <a href="#timeline-section">Timeline</a>
    <a href="#contributors-section">Contributors</a>
    <a href="#blame-section">Blame</a>
  </nav>
  <div id="summary" class="stats"></div>
  <main>
    <section id="branch" class="wide">
      <h2>Branch Graph</h2>
      <div id="branch-legend" class="legend"></div>
      <div id="branch-graph"></div>
    </section>
    <section id="heatmap-section">
      <h2>Contributor Heatmap</h2>
      <div id="heatmap"></div>
    </section>
    <section id="timeline-section">
      <h2>Commit Timeline</h2>
      <div id="timeline"></div>
    </section>
    <section id="churn-section" class="wide">
      <h2>File Churn</h2>
      <div id="churn"></div>
    </section>
    <section id="contributors-section">
      <h2>Contributors</h2>
      <div id="contributors-table" class="table-wrap"></div>
    </section>
    <section id="blame-section">
      <h2>Blame Summary</h2>
      <div id="blame-table" class="table-wrap"></div>
    </section>
  </main>
  <footer>reposcope is a local-first, account-free Git history explorer.</footer>
  <script>${buildScript(data)}</script>
</body>
</html>`
}
