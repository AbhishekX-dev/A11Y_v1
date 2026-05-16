// ANSI color codes for a sleek modern CLI (Claude-like)
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[38;5;196m',
  green:   '\x1b[38;5;48m',
  yellow:  '\x1b[38;5;226m',
  cyan:    '\x1b[38;5;51m',
  magenta: '\x1b[38;5;207m', // Claude-like purple
  purple:  '\x1b[38;5;141m', 
  white:   '\x1b[38;5;255m',
  gray:    '\x1b[38;5;242m',
  dark:    '\x1b[38;5;236m',
};

const WIDTH = 68;

function repeat(char, n) {
  return char.repeat(n);
}

export function printBanner() {
  console.log(`\n${C.purple}    ╭───╮${C.reset}`);
  console.log(`${C.purple}  ╭─╯   ╰─╮${C.reset}  ${C.bold}${C.white}WCAGent${C.reset}`);
  console.log(`${C.purple}  ╰─╮   ╭─╯${C.reset}  ${C.cyan}AI Accessibility QA Agent${C.reset}`);
  console.log(`${C.purple}    ╰───╯${C.reset}`);
  console.log(`\n${C.dark}  ${repeat('─', WIDTH)}${C.reset}\n`);
}

export function printPhase(phase, message) {
  const phaseColors = {
    OBSERVE: C.cyan,
    REASON:  C.purple,
    DECIDE:  C.yellow,
    ACT:     C.green,
  };
  const color = phaseColors[phase] || C.white;
  const label = ` ${phase} `;
  const totalPad = WIDTH - label.length - 2; 
  const rightPad = Math.max(0, totalPad);
  const dashes = repeat('─', Math.min(rightPad, WIDTH - label.length));
  
  console.log(`\n${color}╭─${C.reset}${C.bold}${C.white}${label}${C.reset}${color}${dashes}╮${C.reset}`);
  console.log(`${color}│${C.reset} ${C.gray}Target:${C.reset} ${C.white}${message}${C.reset}`);
}

export function printLog(tag, message, color) {
  const colorMap = {
    cyan:    C.cyan,
    magenta: C.magenta,
    purple:  C.purple,
    yellow:  C.yellow,
    green:   C.green,
    red:     C.red,
    gray:    C.gray,
    white:   C.white,
  };
  const col = colorMap[color] || C.white;
  // Get current time
  const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  console.log(`${C.dark}│${C.reset} ${C.dim}[${time}]${C.reset} ${col}${tag.padEnd(8)}${C.reset} ${C.white}${message}${C.reset}`);
}

export function printViolationCard(issue) {
  const severityColors = {
    CRITICAL: C.red,
    HIGH:     C.yellow,
    MEDIUM:   C.cyan,
    LOW:      C.gray,
  };

  const sev = (issue.severity || 'MEDIUM').toUpperCase();
  const sevColor = severityColors[sev] || C.white;

  // confidence bar
  const pct = Math.max(0, Math.min(100, issue.confidence || 0));
  const filled = Math.round(pct / 5);
  const empty = 20 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  const affected = Array.isArray(issue.affectedUsers) ? issue.affectedUsers.join(', ') : (issue.affectedUsers || '—');

  console.log(`${C.dark}│${C.reset}`);
  console.log(`${C.dark}│${C.reset}  ${sevColor}╭─ ${sev} ${repeat('─', Math.max(0, WIDTH - sev.length - 6))}╮${C.reset}`);
  console.log(`${C.dark}│${C.reset}  ${sevColor}│${C.reset} ${C.bold}${issue.description || issue.violationId}${C.reset}`);
  console.log(`${C.dark}│${C.reset}  ${sevColor}│${C.reset} ${C.gray}Affected:${C.reset} ${C.white}${affected}${C.reset}`);
  console.log(`${C.dark}│${C.reset}  ${sevColor}│${C.reset} ${C.gray}Impact:  ${C.reset} ${C.dim}${issue.businessImpact || '—'}${C.reset}`);
  console.log(`${C.dark}│${C.reset}  ${sevColor}│${C.reset} ${C.gray}Score:   ${C.reset} ${C.white}${pct}%${C.reset} ${C.cyan}${bar}${C.reset}`);
  console.log(`${C.dark}│${C.reset}  ${sevColor}╰${repeat('─', WIDTH - 2)}╯${C.reset}`);
}

export function printSummary(stats, url) {
  const { total, autoEscalated, humanReview, logOnly, issuesCreated, recommendation } = stats;
  const recColor = recommendation === 'DO NOT SHIP' ? C.red : C.yellow;
  console.log(`\n${C.purple}╭─ SUMMARY ${repeat('─', WIDTH - 9)}╮${C.reset}`);
  console.log(`${C.purple}│${C.reset} ${C.white}Violations Analyzed : ${C.bold}${total}${C.reset}`);
  console.log(`${C.purple}│${C.reset} ${C.green}Auto-escalated      : ${C.bold}${autoEscalated}${C.reset} ${C.dim}(PRs generated)${C.reset}`);
  console.log(`${C.purple}│${C.reset} ${C.yellow}Needs Human Review  : ${C.bold}${humanReview}${C.reset}`);
  console.log(`${C.purple}│${C.reset} ${C.gray}Logged Only         : ${C.bold}${logOnly}${C.reset}`);

  if (issuesCreated && issuesCreated.length > 0) {
    console.log(`${C.purple}│${C.reset}`);
    console.log(`${C.purple}│${C.reset} ${C.bold}Escalations:${C.reset}`);
    issuesCreated.forEach(i => {
      console.log(`${C.purple}│${C.reset} ${C.green}↳ ${i.url}${C.reset}`);
    });
  }

  console.log(`${C.purple}│${C.reset}`);
  console.log(`${C.purple}│${C.reset} ${C.gray}Decision:${C.reset} ${recColor}${C.bold}${recommendation}${C.reset}`);
  console.log(`${C.purple}╰${repeat('─', WIDTH)}╯${C.reset}\n`);
}

export function printSpinner(message) {
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  let i = 0;
  let timer = null;

  // Get current time for spinner
  const getTime = () => new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return {
    start() {
      process.stdout.write(`${C.dark}│${C.reset} ${C.dim}[${getTime()}]${C.reset} ${C.cyan}${frames[0]}${C.reset} ${C.white}${message}${C.reset}`);
      timer = setInterval(() => {
        i = (i + 1) % frames.length;
        process.stdout.write(`\r${C.dark}│${C.reset} ${C.dim}[${getTime()}]${C.reset} ${C.cyan}${frames[i]}${C.reset} ${C.white}${message}${C.reset}`);
      }, 80);
    },
    stop(successMsg) {
      if (timer) clearInterval(timer);
      process.stdout.write(`\r${C.dark}│${C.reset} ${C.dim}[${getTime()}]${C.reset} ${C.green}✓${C.reset} ${C.white}${successMsg}${C.reset}${repeat(' ', 20)}\n`);
    },
    fail(errorMsg) {
      if (timer) clearInterval(timer);
      process.stdout.write(`\r${C.dark}│${C.reset} ${C.dim}[${getTime()}]${C.reset} ${C.red}✗${C.reset} ${C.red}${errorMsg}${C.reset}${repeat(' ', 20)}\n`);
    }
  };
}
