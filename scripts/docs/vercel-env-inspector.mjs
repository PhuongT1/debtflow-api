import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Development-only, loopback-only bridge. Optional defaults live in a Git-ignored local file.
export const inspectorPath = '/__vercel-env-inspector';

export function buildVercelEnvUrl(input) {
  const { project, team, target, branch, action, id } = input;
  if (!/^[\w-]{1,150}$/.test(project ?? '') || (team && !/^[\w-]{1,150}$/.test(team)))
    throw new Error('Project/Team ID không hợp lệ.');
  if (!['preview', 'production', 'development'].includes(target))
    throw new Error('Environment không hợp lệ.');
  if (branch && (typeof branch !== 'string' || branch.length > 200))
    throw new Error('Branch không hợp lệ.');
  let path;
  if (action === 'list') path = `/v10/projects/${project}/env`;
  else if (action === 'pull') {
    path = `/v3/env/pull/${project}/${target}`;
    if (target === 'preview' && branch) path += `/${encodeURIComponent(branch)}`;
  } else if (action === 'read' && /^[\w-]{1,150}$/.test(id ?? ''))
    path = `/v1/projects/${project}/env/${id}`;
  else throw new Error('Thao tác không hợp lệ.');
  const url = new URL(path, 'https://api.vercel.com');
  if (team) url.searchParams.set(team.startsWith('team_') ? 'teamId' : 'slug', team);
  if (action === 'list') {
    url.searchParams.set('target', target);
    if (target === 'preview' && branch) url.searchParams.set('gitBranch', branch);
  }
  return url;
}

export function createInspectorMiddleware(request = fetch, readDefaults = () => ({})) {
  return async (req, res, next) => {
    if (req.url?.split('?')[0] !== inspectorPath) return next();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, data) => {
      res.statusCode = status;
      res.end(JSON.stringify(data));
    };
    let origin;
    try {
      origin = new URL(req.headers.origin);
    } catch {
      /* rejected below */
    }
    if (
      !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) ||
      !origin ||
      !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) ||
      origin.host !== req.headers.host ||
      origin.protocol !== 'http:'
    )
      return send(403, { error: 'Chỉ cho phép docs local và request cùng origin.' });
    if (req.method !== 'POST') return send(405, { error: 'Chỉ hỗ trợ POST.' });
    if (!req.headers['content-type']?.startsWith('application/json'))
      return send(415, { error: 'Yêu cầu JSON.' });
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 16_384) return send(413, { error: 'Request quá lớn.' });
      }
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        return send(400, { error: 'JSON không hợp lệ.' });
      }
      if (input?.action === 'defaults') return send(200, { token: readDefaults().token || '' });
      if (
        !input ||
        typeof input.token !== 'string' ||
        !input.token.trim() ||
        input.token.length > 4096
      )
        return send(400, { error: 'Nhập Vercel Access Token.' });
      let url;
      try {
        url = buildVercelEnvUrl(input);
      } catch (error) {
        return send(400, { error: error.message });
      }
      const options = {
        method: 'GET',
        headers: { Authorization: `Bearer ${input.token.trim()}` },
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      };
      const response = await request(url, options);
      if (!response.ok)
        return send(200, {
          status: response.status,
          endpoint: url.pathname,
          error: `Vercel trả HTTP ${response.status}. Kiểm tra token, team, project và quyền truy cập.`,
        });
      const data = await response.json();
      if (input.action === 'pull') {
        const metadataUrl = buildVercelEnvUrl({ ...input, action: 'list', branch: '' });
        const metadata = await request(metadataUrl, options);
        if (!metadata.ok)
          return send(200, {
            error: `Không đọc được danh sách cấu hình (HTTP ${metadata.status}).`,
          });
        const { envs } = await metadata.json();
        if (!Array.isArray(envs)) throw new Error('Invalid project environment response');
        data.configuredKeys = envs
          .filter(
            ({ target, gitBranch }) =>
              (Array.isArray(target) ? target.includes(input.target) : target === input.target) &&
              (!gitBranch || (input.target === 'preview' && gitBranch === input.branch)),
          )
          .map(({ key }) => key);
      }
      return send(200, { status: response.status, endpoint: url.pathname, data });
    } catch {
      // Never echo upstream errors, tokens, response bodies or connection strings.
      return send(502, {
        error: 'Không gọi được Vercel API (network, timeout hoặc response không hợp lệ).',
      });
    }
  };
}

export function vercelEnvInspector() {
  return {
    name: 'debtflow-local-vercel-env-inspector',
    apply: 'serve',
    configureServer(server) {
      const defaultsFile = new URL('../../.env.vercel-inspector.local', import.meta.url);
      const readDefaults = () => {
        try {
          return { token: parseEnv(readFileSync(defaultsFile, 'utf8')).VERCEL_INSPECTOR_TOKEN };
        } catch {
          return {};
        }
      };
      server.middlewares.use(createInspectorMiddleware(fetch, readDefaults));
    },
  };
}
