const API = 'https://api.github.com';

function repoAndBranch() {
  const repo = process.env.GH_REPO;
  const branch = process.env.GH_BRANCH || 'main';
  if (!repo) throw new Error('GH_REPO environment variable is not set');
  return { repo, branch };
}

function authHeaders() {
  const token = process.env.GH_TOKEN;
  if (!token) throw new Error('GH_TOKEN environment variable is not set');
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function ghGetFile(path) {
  const { repo, branch } = repoAndBranch();
  const res = await fetch(`${API}/repos/${repo}/contents/${path}?ref=${branch}`, {
    headers: authHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return {
    sha: json.sha,
    text: Buffer.from(json.content, 'base64').toString('utf8'),
  };
}

async function ghGetFileRaw(path) {
  const { repo, branch } = repoAndBranch();
  const res = await fetch(`${API}/repos/${repo}/contents/${path}?ref=${branch}`, {
    headers: authHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return { sha: json.sha, base64: json.content.replace(/\n/g, '') };
}

async function ghPutBase64(path, base64Content, message, sha) {
  const { repo, branch } = repoAndBranch();
  const res = await fetch(`${API}/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: base64Content, branch, sha: sha || undefined }),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function ghMoveFile(fromPath, toPath, message) {
  const file = await ghGetFileRaw(fromPath);
  if (!file) throw new Error(`Cannot move missing file: ${fromPath}`);
  await ghPutBase64(toPath, file.base64, message, null);
  await ghDeleteFile(fromPath, message, file.sha);
}

async function ghGetJson(path, fallback) {
  const file = await ghGetFile(path);
  if (!file) return { data: fallback, sha: null };
  return { data: JSON.parse(file.text), sha: file.sha };
}

async function ghPutFile(path, contentBufferOrString, message, sha) {
  const { repo, branch } = repoAndBranch();
  const content = Buffer.isBuffer(contentBufferOrString)
    ? contentBufferOrString.toString('base64')
    : Buffer.from(contentBufferOrString, 'utf8').toString('base64');
  const res = await fetch(`${API}/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content, branch, sha: sha || undefined }),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function ghPutJson(path, data, message, sha) {
  return ghPutFile(path, JSON.stringify(data, null, 2) + '\n', message, sha);
}

async function ghDeleteFile(path, message, sha) {
  const { repo, branch } = repoAndBranch();
  const res = await fetch(`${API}/repos/${repo}/contents/${path}`, {
    method: 'DELETE',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha, branch }),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE ${path} failed: ${res.status} ${await res.text()}`);
  }
}

module.exports = { ghGetFile, ghGetFileRaw, ghGetJson, ghPutFile, ghPutBase64, ghPutJson, ghDeleteFile, ghMoveFile };
