// ANSI color codes
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
  white:   '\x1b[37m',
  gray:    '\x1b[90m',
  bgRed:   '\x1b[41m',
};

const WIDTH = 62;

function repeat(char, n) {
  return char.repeat(n);
}

export function printBanner() {
  const line = repeat('═', WIDTH);
  console.log(`\n${C.cyan}${line}${C.reset}`);
  console.log(`${C.bold}${C.white}  🤖 AI Accessibility QA Agent${C.reset}`);
  console.log(`${C.gray}  QA Fraternity AI Agent Hackathon 2026${C.reset}`);
  console.log(`${C.cyan}  Observe → Reason → Act${C.reset}`);
  console.log(`${C.cyan}${line}${C.reset}\n`);
}

export function printPhase(phase, message) {
  const phaseColors = {
    OBSERVE: C.cyan,
    REASON:  C.magenta,
    DECIDE:  C.yellow,
    ACT:     C.green,
  };
  const color = phaseColors[phase] || C.white;
  const label = `[${phase}] ${message}`;
  const totalPad = WIDTH - label.length - 4; // 2 for └ ┘ and 2 for '─ '
  const rightPad = Math.max(0, totalPad);
  const numDashes = Math.max(0, Math.min(rightPad, WIDTH - label.length - 2));
  const dashes = repeat('─', numDashes);
  console.log(`\n${color}┌─ ${label} ${dashes}┐${C.reset}`);
}

export function printLog(tag, message, color) {
  const colorMap = {
    cyan:    C.cyan,
    magenta: C.magenta,
    yellow:  C.yellow,
    green:   C.green,
    red:     C.red,
    gray:    C.gray,
    white:   C.white,
  };
  const col = colorMap[color] || C.white;
  const paddedTag = tag.padEnd(10);
  console.log(`  ${col}[${paddedTag}]${C.reset} ${message}`);
}

export function printViolationCard(issue) {
  const severityColors = {
    CRITICAL: C.red,
    HIGH:     C.yellow,
    MEDIUM:   C.cyan,
    LOW:      C.gray,
  };
  const recColors = {
    'DO NOT SHIP':      C.red,
    'SHIP WITH WARNING': C.yellow,
    'OK TO SHIP':       C.green,
  };

  const sev = (issue.severity || 'MEDIUM').toUpperCase();
  const sevColor = severityColors[sev] || C.white;
  const recColor = recColors[issue.releaseRecommendation] || C.yellow;

  // confidence bar
  const pct = Math.max(0, Math.min(100, issue.confidence || 0));
  const filled = Math.round(pct / 5);
  const empty = 20 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  const affected = Array.isArray(issue.affectedUsers) ? issue.affectedUsers.join(', ') : (issue.affectedUsers || '—');

  const line = repeat('─', WIDTH);
  console.log(`\n  ${sevColor}┌─ ${sev} ${repeat('─', Math.max(0, WIDTH - sev.length - 4))}┐${C.reset}`);
  console.log(`  │ ${C.bold}${issue.description || issue.violationId}${C.reset}`);
  console.log(`  │ ${C.gray}Affected: ${affected}${C.reset}`);
  console.log(`  │ ${C.dim}Impact:   ${issue.businessImpact || '—'}${C.reset}`);
  console.log(`  │ ${C.white}Confidence: ${pct}% ${C.cyan}${bar}${C.reset}`);
  console.log(`  │ ${recColor}Recommendation: ${issue.releaseRecommendation || '—'}${C.reset}`);
  console.log(`  ${sevColor}└${repeat('─', WIDTH)}┘${C.reset}`);
}

export function printSummary(stats) {
  const { total, autoEscalated, humanReview, logOnly, issuesCreated, recommendation } = stats;
  const recColor = recommendation === 'DO NOT SHIP' ? C.red : C.yellow;
  const line = repeat('═', WIDTH);

  console.log(`\n${C.cyan}${line}${C.reset}`);
  console.log(`${C.bold}${C.white}  📊 AGENT AUDIT COMPLETE${C.reset}`);
  console.log(`${C.cyan}${line}${C.reset}`);
  console.log(`  ${C.white}Total violations analyzed : ${C.bold}${total}${C.reset}`);
  console.log(`  ${C.green}Auto-escalated (≥80%)    : ${C.bold}${autoEscalated}${C.reset}`);
  console.log(`  ${C.yellow}Flagged for human review  : ${C.bold}${humanReview}${C.reset}`);
  console.log(`  ${C.gray}Logged only (<50%)        : ${C.bold}${logOnly}${C.reset}`);

  if (issuesCreated && issuesCreated.length > 0) {
    console.log(`\n  ${C.green}GitHub Issues Created:${C.reset}`);
    issuesCreated.forEach(i => {
      console.log(`    ${C.green}• Issue #${i.number} → ${i.url}${C.reset}`);
    });
  }

  console.log(`\n  ${recColor}${C.bold}▶ FINAL DECISION: ${recommendation}${C.reset}`);
  console.log(`${C.cyan}${line}${C.reset}\n`);
}

export function printSpinner(message) {
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  let i = 0;
  let timer = null;

  return {
    start() {
      process.stdout.write(`  ${frames[0]} ${message}`);
      timer = setInterval(() => {
        i = (i + 1) % frames.length;
        process.stdout.write(`\r  ${C.cyan}${frames[i]}${C.reset} ${message}`);
      }, 80);
    },
    stop(successMsg) {
      if (timer) clearInterval(timer);
      process.stdout.write(`\r  ${C.green}✓${C.reset} ${successMsg}\n`);
    },
    fail(errorMsg) {
      if (timer) clearInterval(timer);
      process.stdout.write(`\r  ${C.red}✗${C.reset} ${errorMsg}\n`);
    }
  };
}
