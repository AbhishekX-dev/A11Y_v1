import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { Command } from 'commander';
import readline from 'readline';
import { scanPage } from './tools/scanner.js';
import { createGitHubIssue, getDefaultBranchSha, createBranch, getFile, updateFile, createPullRequest } from './tools/github.js';
import { getMcpClient } from './tools/mcp.js';
import { findSitemap, extractUrlsFromSitemap, crawlSite } from './tools/crawler.js';
import {
  printBanner,
  printPhase,
  printLog,
  printViolationCard,
  printSummary,
  printSpinner
} from './ui.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL
});

// ─── Reasoning Function ─────────────────────────────────────────────

async function reasonWithMiniMax(violations, url) {
  const prompt = `You are auditing the webpage: ${url}

Here are the accessibility violations found by axe-core:
${JSON.stringify(violations, null, 2)}

Analyze each violation and return a JSON array where each item has exactly this shape:
{
  "violationId": "string (axe rule id)",
  "description": "string (clear plain English description)",
  "affectedUsers": ["string array of affected user groups"],
  "businessImpact": "string (real-world business consequence)",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW",
  "confidence": number (0-100, how confident you are in this severity),
  "releaseRecommendation": "DO NOT SHIP | SHIP WITH WARNING | OK TO SHIP",
  "remediationHint": {
    "current": "string (broken HTML snippet)",
    "suggested": "string (fixed HTML snippet)",
    "explanation": "string (why this fix matters)"
  },
  "escalate": boolean
}

Return only the raw JSON array. No markdown. No explanation. No code fences.`;

  // 1. Initialize MCP Client
  let formattedTools = [];
  try {
    const mcpClient = await getMcpClient();
    const { tools } = await mcpClient.listTools();
    formattedTools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema
    }));
  } catch(e) {
    printLog('Warning', `Failed to load MCP tools: ${e.message}`, 'yellow');
  }

  let messages = [
    {
      role: 'user',
      content: prompt + "\nFeel free to use the get_rules or other tools to lookup specific rule context before generating the final JSON array. ONLY return JSON at the end, nothing else."
    }
  ];

  let msg;
  try {
    // 2. Autonomous Tool Calling Loop for Reason Phase
    while (true) {
      msg = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL,
        max_tokens: 4000,
        temperature: 0.2,
        system: 'You are an expert accessibility QA engineer. You may use tools to gather information. Once you have all info, always respond with valid JSON only. No markdown, no explanation outside the JSON array. No code fences.',
        tools: formattedTools.length > 0 ? formattedTools : undefined,
        messages: messages
      });

      if (msg.stop_reason === 'tool_use') {
        messages.push({ role: "assistant", content: msg.content });
        for (const content of msg.content) {
          if (content.type === "tool_use") {
            printLog('Tool Use', `Executing MCP tool: ${content.name}...`, 'cyan');
            const mcpClient = await getMcpClient();
            try {
              const result = await mcpClient.callTool({
                name: content.name,
                arguments: content.input
              });
              printLog('Tool Use', `✓ MCP tool ${content.name} returned successfully`, 'green');
              messages.push({
                role: "user",
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: content.id,
                    content: JSON.stringify(result.content)
                  }
                ]
              });
            } catch (e) {
              messages.push({
                role: "user",
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: content.id,
                    content: `Error: ${e.message}`,
                    is_error: true
                  }
                ]
              });
            }
          }
        }
      } else {
        break; // Got the final JSON response
      }
    }
  } catch (err) {
      // Fallback Mode: If API key fails, provide realistic mock data so the hackathon demo still works
      printLog('Warning', `API error: ${err.message}`, 'yellow');
      printLog('Info', 'Falling back to local Mock Reasoning Mode for Demo...', 'blue');
      
      return violations.map(v => {
        const confidence = v.impact === 'critical' ? 95 : v.impact === 'serious' ? 85 : 45;
        const severityStr = v.impact === 'critical' ? 'CRITICAL' : v.impact === 'serious' ? 'HIGH' : 'MEDIUM';
        return {
          violationId: v.id,
          description: v.description,
          affectedUsers: "[MOCK] Users relying on screen readers or keyboard navigation.",
          businessImpact: "[MOCK] Non-compliance risks legal action and blocks visually impaired users from core functionality.",
          severity: severityStr,
          confidence: confidence,
          releaseRecommendation: confidence >= 80 ? "DO NOT SHIP" : "SHIP WITH WARNING",
          remediationHint: {
            current: `<${v.nodes?.[0]?.html?.substring(0, 20) || 'Missing element'}...>`,
            suggested: `<!-- [MOCK FIX] Follow WCAG guidelines for ${v.id} -->`,
            explanation: "[MOCK] Implementing this fix ensures assistive technologies can parse the element."
          },
          escalate: confidence >= 80
        };
      });
  }

  let content = msg.content[0]?.text || msg.content;
  if (Array.isArray(msg.content)) {
    content = msg.content.map(c => c.text).join('\n');
  } else if (typeof msg.content === 'string') {
    content = msg.content;
  }

  // Strip markdown code fences if model ignores instructions
  content = content.replace(/```json/gi, '').replace(/```/g, '').trim();

  // Extract JSON array if the model includes conversational text
  const startIndex = content.indexOf('[');
  const endIndex = content.lastIndexOf(']');
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    content = content.substring(startIndex, endIndex + 1);
  }

  try {
    return JSON.parse(content);
  } catch (e) {
    console.error('Raw response:', content);
    throw new Error('Failed to parse response as JSON');
  }
}

// ─── GitHub Issue Body Formatter ─────────────────────────────────────────────

function formatGitHubBody(issue, url) {
  const affected = Array.isArray(issue.affectedUsers)
    ? issue.affectedUsers.map(u => `- ${u}`).join('\n')
    : `- ${issue.affectedUsers}`;

  return `## 🤖 AI Accessibility QA Agent Report

| Field | Value |
|-------|-------|
| **URL Audited** | ${url} |
| **WCAG Rule** | \`${issue.violationId}\` |
| **Severity** | ${issue.severity} |
| **Confidence** | ${issue.confidence}% |
| **Release Recommendation** | ${issue.releaseRecommendation} |

---

## 👥 Affected Users

${affected}

---

## 💼 Business Impact

${issue.businessImpact}

---

## 🔧 Remediation

**Current (broken):**
\`\`\`html
${issue.remediationHint?.current || '(see violation above)'}
\`\`\`

**Suggested (fixed):**
\`\`\`html
${issue.remediationHint?.suggested || '(see remediation hint)'}
\`\`\`

**Why this matters:**
${issue.remediationHint?.explanation || ''}

---

*Generated by AI Accessibility QA Agent | QA Fraternity Hackathon 2026*`;
}

// ─── Main Audit Function ──────────────────────────────────────────────────────

async function runAudit(url, exitOnError = true) {
  try {
    // ── PHASE 1: OBSERVE ──────────────────────────────────────────
    printBanner();
    printPhase('OBSERVE', `Scanning ${url}`);

    const spinner1 = printSpinner('Launching browser and scanning for WCAG violations...');
    spinner1.start();

    let violations;
    try {
      violations = await scanPage(url);
    } catch (err) {
      spinner1.fail(`Scanner error: ${err.message}`);
      throw err;
    }

    spinner1.stop(`Found ${violations.length} WCAG violations`);

    if (violations.length === 0) {
      printLog('Action', '✓ No violations found! Page is accessible.', 'green');
      return;
    }

    // ── PHASE 2: REASON ───────────────────────────────────────────
    printPhase('REASON', `Sending ${violations.length} violations to OpenRouter (Minimax M2)`);
    printLog('Reason', 'Analyzing who is affected by each violation...', 'magenta');
    printLog('Reason', 'Calculating business impact and severity...', 'magenta');
    printLog('Reason', 'Generating confidence scores and remediation hints...', 'magenta');

    const spinner2 = printSpinner('Model is reasoning...');
    spinner2.start();

    let reasonedIssues;
    try {
      reasonedIssues = await reasonWithMiniMax(violations, url);
    } catch (err) {
      spinner2.fail(`Reasoning error: ${err.message}`);
      throw err;
    }

    spinner2.stop(`Reasoning complete — ${reasonedIssues.length} issues analyzed`);

    // ── PHASE 3: DECIDE + ACT ─────────────────────────────────────
    const githubEnabled = !!(process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN !== 'paste_your_github_pat_here');

    printPhase('DECIDE', 'Applying confidence-based decision logic');
    printLog('Decision', `confidence ≥ 80%   →  AUTO ESCALATE ${githubEnabled ? '(GitHub issue)' : '(terminal only — GitHub not configured)'}`, 'yellow');
    printLog('Decision', 'confidence 50–80%  →  HUMAN REVIEW required', 'yellow');
    printLog('Decision', 'confidence < 50%   →  LOG ONLY', 'yellow');
    if (!githubEnabled) {
      printLog('Decision', '⚠  GitHub token not set — issue creation skipped', 'gray');
    }

    let autoEscalated = 0;
    let humanReview = 0;
    let logOnly = 0;
    const issuesCreated = [];

    for (const issue of reasonedIssues) {
      const confidence = issue.confidence ?? 0;
      const decision = confidence >= 80 ? 'AUTO_ESCALATE'
                     : confidence >= 50 ? 'HUMAN_REVIEW'
                     : 'LOG_ONLY';

      printViolationCard(issue);

      if (decision === 'AUTO_ESCALATE') {
        autoEscalated++;
        printLog('Decision', `Confidence ${confidence}% ≥ 80% → AUTO ESCALATING`, 'yellow');

        if (githubEnabled) {
          printLog('Action', 'Creating GitHub issue...', 'green');
          const title = `[${issue.severity}] ${issue.description} — AI Accessibility Agent`;
          const body = formatGitHubBody(issue, url);
          const labels = ['accessibility', 'ai-generated', (issue.severity || 'medium').toLowerCase()];

          try {
            const ghIssue = await createGitHubIssue({ title, body, labels });
            printLog('Action', `✓ Issue #${ghIssue.number} → ${ghIssue.html_url}`, 'green');
            issuesCreated.push({ number: ghIssue.number, url: ghIssue.html_url });

            if (issue.remediationHint?.current && issue.remediationHint?.suggested) {
              printLog('Action', 'Generating suggested patch and Draft PR...', 'cyan');
              
              const { branch: defaultBranch, sha: baseSha } = await getDefaultBranchSha();
              const branchName = `fix/a11y-issue-${ghIssue.number}`;
              await createBranch(branchName, baseSha);
              
              const targetPath = 'index.html';
              const fileData = await getFile(targetPath, defaultBranch);
              
              if (fileData) {
                const newContent = fileData.content.replace(
                  issue.remediationHint.current.trim(),
                  issue.remediationHint.suggested.trim()
                );
                
                if (newContent !== fileData.content) {
                  await updateFile({
                    path: targetPath,
                    content: newContent,
                    message: `Fix ${issue.severity} accessibility issue: ${issue.description}\n\nResolves #${ghIssue.number}`,
                    branch: branchName,
                    sha: fileData.sha
                  });
                  
                  const pr = await createPullRequest({
                    title: `[A11y] Fix: ${issue.description}`,
                    body: `This PR fixes the accessibility issue described in #${ghIssue.number}.\n\n### Changes Made\n\`\`\`html\n- ${issue.remediationHint.current.trim()}\n+ ${issue.remediationHint.suggested.trim()}\n\`\`\`\n\n**Note:** This is an AI-generated draft PR. Please review before merging.`,
                    head: branchName,
                    base: defaultBranch,
                    draft: true
                  });
                  printLog('Action', `✓ Draft PR Created: #${pr.number} → ${pr.html_url}`, 'green');
                } else {
                  printLog('Error', 'Could not apply patch: Current code snippet not exactly found in target file.', 'gray');
                }
              } else {
                printLog('Error', `Target file ${targetPath} not found in repository. Cannot create PR.`, 'gray');
              }
            }
          } catch (err) {
            printLog('Error', `GitHub action failed: ${err.message}`, 'red');
          }
        } else {
          printLog('Action', `[Would create issue] ${issue.severity}: ${issue.description}`, 'gray');
        }

      } else if (decision === 'HUMAN_REVIEW') {
        humanReview++;
        printLog('Decision', `Confidence ${confidence}% → Flagged for human review`, 'yellow');

      } else {
        logOnly++;
        printLog('Decision', `Confidence ${confidence}% → Logged only`, 'gray');
      }
    }

    // ── SUMMARY ───────────────────────────────────────────────────
    const hasCritical = reasonedIssues.some(
      i => i.severity === 'CRITICAL' && (i.confidence ?? 0) >= 80
    );

    printSummary({
      total: reasonedIssues.length,
      autoEscalated,
      humanReview,
      logOnly,
      issuesCreated,
      recommendation: hasCritical ? 'DO NOT SHIP' : 'REVIEW REQUIRED'
    }, url);

  } catch (err) {
    printLog('Error', err.message, 'red');
    if (exitOnError) process.exit(1);
    else throw err;
  }
}

// ─── Site Automation Function ──────────────────────────────────────────────────

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function auditSite(baseUrl, options) {
  try {
    printBanner();
    printPhase('DISCOVER', `Analyzing site structure for ${baseUrl}`);

    let urls = [];
    
    if (options.crawler) {
      printLog('Info', 'User forced Playwright crawler (--crawler flag).', 'cyan');
      const spinner = printSpinner('Crawling site for links...');
      spinner.start();
      urls = await crawlSite(baseUrl);
      spinner.stop(`Found ${urls.length} URLs`);
    } else {
      printLog('Info', 'Checking for sitemap.xml...', 'cyan');
      const sitemapUrl = await findSitemap(baseUrl);

      if (sitemapUrl) {
        printLog('Success', `Found sitemap at: ${sitemapUrl}`, 'green');
        printLog('Info', 'Extracting URLs from sitemap...', 'cyan');
        urls = await extractUrlsFromSitemap(sitemapUrl);
      } else {
        printLog('Warning', 'No sitemap found. Falling back to Playwright Crawler.', 'yellow');
        const spinner = printSpinner('Crawling site for links...');
        spinner.start();
        urls = await crawlSite(baseUrl);
        spinner.stop(`Found ${urls.length} URLs`);
      }
    }

    if (urls.length === 0) {
      printLog('Error', 'No URLs found to scan.', 'red');
      return;
    }

    printLog('Success', `Found ${urls.length} pages. Starting batch audit...`, 'green');

    for (let i = 0; i < urls.length; i++) {
      console.log(`\n======================================================`);
      console.log(`  Auditing Page ${i + 1} of ${urls.length}: ${urls[i]}`);
      console.log(`======================================================\n`);
      try {
        await runAudit(urls[i], false);
      } catch (err) {
        printLog('Error', `Audit failed for ${urls[i]}: ${err.message}`, 'red');
      }

      if (i < urls.length - 1) {
        const answer = await askQuestion(`\nNext up: ${urls[i + 1]}\nPress [Enter] to continue to the next page, or type "q" to quit: `);
        if (answer.toLowerCase() === 'q') {
          printLog('Info', 'Batch audit aborted by user.', 'yellow');
          break;
        }
      }
    }

    printLog('Success', 'Finished batch audit of the entire site.', 'green');

  } catch (err) {
    printLog('Error', err.message, 'red');
    process.exit(1);
  }
}

// ─── Explain Command ──────────────────────────────────────────────────────────

async function explain(violationId) {
  try {
    printBanner();
    printPhase('REASON', `Explaining WCAG violation: ${violationId}`);

    const spinner = printSpinner(`Initializing MCP A11y Tools & Reasoning about '${violationId}'...`);
    spinner.start();

    // 1. Initialize MCP Client
    const mcpClient = await getMcpClient();
    const { tools } = await mcpClient.listTools();
    const formattedTools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema
    }));

    let messages = [
      {
        role: 'user',
        content: `Explain WCAG violation '${violationId}' in plain English. Use the provided tools (like get_rules) to find out exactly what this rule means first! Who does it affect, why does it matter, and give a concrete real-world example of the problem. Keep it under 150 words. Write for a developer who is not an accessibility expert.`
      }
    ];

    let explanation = "";

    // 2. Autonomous Tool Calling Loop
    while (true) {
      const msg = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL,
        max_tokens: 500,
        temperature: 0.3,
        tools: formattedTools,
        messages: messages
      });

      if (msg.stop_reason === 'tool_use') {
        messages.push({ role: "assistant", content: msg.content });
        for (const content of msg.content) {
          if (content.type === "tool_use") {
            spinner.text = `Agent is calling MCP tool: ${content.name}...`;
            try {
              const result = await mcpClient.callTool({
                name: content.name,
                arguments: content.input
              });
              messages.push({
                role: "user",
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: content.id,
                    content: JSON.stringify(result.content)
                  }
                ]
              });
            } catch (e) {
              messages.push({
                role: "user",
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: content.id,
                    content: `Error: ${e.message}`,
                    is_error: true
                  }
                ]
              });
            }
          }
        }
      } else {
        if (Array.isArray(msg.content)) {
          explanation = msg.content.map(c => c.text || '').join('\n');
        } else if (typeof msg.content === 'string') {
          explanation = msg.content;
        } else {
          explanation = msg.content[0]?.text || '';
        }
        break;
      }
    }

    spinner.stop('Explanation ready');
    console.log('');
    explanation.split('\n').forEach(line => {
      printLog('Reason', line, 'magenta');
    });
    console.log('');

  } catch (err) {
    printLog('Error', err.message, 'red');
    process.exit(1);
  }
}

// ─── CLI Setup ────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('qa-agent')
  .description('AI Accessibility QA Agent — Observe, Reason, Act');

program
  .command('audit <url>')
  .description('Scan a URL for WCAG violations and auto-file GitHub issues')
  .action((url) => runAudit(url, true));

program
  .command('audit-site <baseUrl>')
  .description('Automatically discover and scan all pages on a site (via sitemap or crawler)')
  .option('-c, --crawler', 'Force using the Playwright crawler instead of looking for a sitemap')
  .action((baseUrl, options) => auditSite(baseUrl, options));

program
  .command('explain <violationId>')
  .description('Explain a specific WCAG violation in plain English')
  .action(explain);

program.parse(process.argv);
