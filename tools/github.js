export async function fetchGitHubAPI(path, method = 'GET', body = null) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  
  const options = {
    method,
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, options);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`GitHub API error (${response.status}): ${errorData.message || response.statusText}`);
  }

  return response.json();
}

export async function createGitHubIssue({ title, body, labels }) {
  return fetchGitHubAPI('/issues', 'POST', { title, body, labels });
}

export async function getDefaultBranchSha() {
  const repoData = await fetchGitHubAPI('');
  const defaultBranch = repoData.default_branch;
  const refData = await fetchGitHubAPI(`/git/ref/heads/${defaultBranch}`);
  return { branch: defaultBranch, sha: refData.object.sha };
}

export async function createBranch(branchName, sha) {
  return fetchGitHubAPI('/git/refs', 'POST', {
    ref: `refs/heads/${branchName}`,
    sha: sha
  });
}

export async function getFile(path, branch) {
  try {
    const data = await fetchGitHubAPI(`/contents/${path}?ref=${branch}`);
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return { content, sha: data.sha };
  } catch (err) {
    if (err.message.includes('404')) return null;
    throw err;
  }
}

export async function updateFile({ path, content, message, branch, sha }) {
  return fetchGitHubAPI(`/contents/${path}`, 'PUT', {
    message,
    content: Buffer.from(content).toString('base64'),
    branch,
    sha
  });
}

export async function createPullRequest({ title, body, head, base, draft = true }) {
  return fetchGitHubAPI('/pulls', 'POST', {
    title,
    body,
    head,
    base,
    draft
  });
}
