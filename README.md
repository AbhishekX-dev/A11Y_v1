<div align="center">
  <h1>🤖 AI Accessibility QA Agent</h1>
  <p>An autonomous AI agent that bridges the gap between automated accessibility scanning and actionable developer feedback.</p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
</div>

## 🚀 Overview

Traditional accessibility scanners (like `axe-core`) tell you **what** is broken. This agent takes it a step further: it tells you **who** is affected, **why** it matters for the business, and **how** to fix it—all while autonomously managing your GitHub issue tracker.

### The Loop: Observe → Reason → Act

1. 🔍 **Observe**: Uses Playwright and `axe-core` to perform a deep scan of the target URL for WCAG 2.0/2.1 violations.
2. 🧠 **Reason**: Sends structured violation data to the **MiniMax-M2** LLM to analyze user impact, business risk, and remediation steps.
3. ⚖️ **Decide**: Applies a confidence-weighted logic to determine the next step:
   - **Confidence ≥ 80%**: Auto-escalates (Creates a GitHub Issue and Draft PR).
   - **Confidence 50-80%**: Flags for human review.
   - **Confidence < 50%**: Logs for audit only.
4. 🛠️ **Act**: For high-confidence issues, it automatically populates your GitHub repository with descriptive, formatted issues and creates draft Pull Requests with the suggested fixes.

---

## ✨ Features

- **Autonomous Triage**: No more manually sorting through hundreds of "moderate" violations.
- **User-Centric Analysis**: Identifies exactly which user groups (screen-reader users, keyboard-only users, etc.) are blocked.
- **Remediation Hints**: Provides "Before" (Broken) and "After" (Fixed) HTML snippets directly in GitHub issues.
- **Auto-Fix PRs**: Automatically generates draft Pull Requests to fix high-confidence violations.
- **Premium CLI UI**: A beautiful terminal interface featuring phase headers, live spinners, and summary cards.
- **Confidence Thresholds**: Ensures high-quality automation while flagging uncertain cases for manual verification.

---

## 🛠️ Setup

### Prerequisites

- **Node.js**: v18 or higher.
- **Git**: For repository management.
- **GitHub Token**: A Personal Access Token (PAT) with `repo` scope (for creating issues/PRs).
- **MiniMax API Key**: From [platform.minimax.io](https://platform.minimax.io).

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/qa-agent.git
   cd qa-agent
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Install Playwright browsers**:
   ```bash
   npx playwright install chromium
   ```

4. **Configure Environment**:
   Create a `.env` file in the root directory:
   ```env
   MINIMAX_API_KEY=your_minimax_api_key
   GITHUB_TOKEN=your_github_personal_access_token
   # Optional: Default fallback repository for issues/PRs
   GITHUB_REPO=username/repository-name 
   ```

---

## 📖 Usage

The CLI supports several commands to audit single pages, entire sites, or explain specific rules.

### 1. Audit a Single Page
Scan any URL and let the agent triage and file issues.
```bash
# Push issues to the default GITHUB_REPO set in .env
node agent.js audit https://example.com

# Explicitly specify the target GitHub repository for this audit
node agent.js audit https://example.com --repo my-username/my-repo
```

### 2. Audit an Entire Site
Automatically discover and scan all pages on a site using its `sitemap.xml` or via crawling.
```bash
node agent.js audit-site https://example.com

# Force using the Playwright crawler instead of looking for a sitemap
node agent.js audit-site https://example.com --crawler
```

### 3. Explain a Violation
Get a plain-English explanation of a specific WCAG rule to better understand it without reading long specification docs.
```bash
node agent.js explain color-contrast
```

---

## 📂 Project Structure

```text
qa-agent/
├── agent.js          # Main CLI entry point and agent logic
├── ui.js             # Terminal UI components and styling
├── tools/
│   ├── scanner.js    # Playwright + axe-core integration
│   ├── crawler.js    # Sitemap discovery and site crawler
│   ├── github.js     # GitHub REST API client
│   └── mcp.js        # Model Context Protocol tools setup
├── .env              # Local environment variables (not tracked)
└── package.json      # Dependencies and scripts
```

---

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for more information.

---
<div align="center">
  <i>Generated by the AI Accessibility QA Agent.</i>
</div>
