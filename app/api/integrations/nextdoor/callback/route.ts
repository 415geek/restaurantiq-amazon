import { NextResponse } from 'next/server';

function buildHtml(params: {
  status: 'success' | 'error';
  title: string;
  message: string;
  detail?: string;
}) {
  const tone =
    params.status === 'success'
      ? { border: '#14532d', bg: '#052e16', text: '#bbf7d0' }
      : { border: '#7f1d1d', bg: '#450a0a', text: '#fecaca' };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nextdoor OAuth Callback</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0; padding: 24px; background: #0a0a0a; color: #fff;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        display: grid; place-items: center; min-height: 100vh;
      }
      .card {
        width: min(720px, 100%); background: #111111; border: 1px solid #27272a;
        border-radius: 16px; padding: 20px;
        box-shadow: 0 16px 48px rgba(0,0,0,.35);
      }
      .badge {
        display: inline-flex; align-items: center; gap: 8px; border-radius: 999px;
        padding: 6px 10px; font-size: 12px; border: 1px solid ${tone.border};
        background: ${tone.bg}; color: ${tone.text};
      }
      h1 { font-size: 22px; margin: 14px 0 8px; }
      p { color: #a1a1aa; margin: 0 0 8px; line-height: 1.5; }
      code {
        display: block; margin-top: 12px; padding: 12px; border-radius: 12px;
        background: #09090b; border: 1px solid #27272a; color: #d4d4d8;
        word-break: break-word;
      }
      .actions { margin-top: 14px; display: flex; gap: 10px; flex-wrap: wrap; }
      button, a {
        appearance: none; border: 1px solid #3f3f46; background: #18181b; color: #fff;
        border-radius: 10px; padding: 10px 14px; cursor: pointer; text-decoration: none; font-size: 14px;
      }
      .primary { border-color: #f26a36; background: #f26a36; color: #fff; }
    </style>
  </head>
  <body>
    <div class="card">
      <span class="badge">${params.status === 'success' ? 'Authorization callback received' : 'Authorization callback error'}</span>
      <h1>${params.title}</h1>
      <p>${params.message}</p>
      ${params.detail ? `<code>${params.detail}</code>` : ''}
      <div class="actions">
        <a class="primary" href="https://restaurantiq.ai/settings">Open Settings</a>
        <button onclick="window.close()">Close Window</button>
      </div>
    </div>
  </body>
</html>`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) {
    const html = buildHtml({
      status: 'error',
      title: 'Nextdoor authorization was not completed',
      message: errorDescription ?? 'The provider returned an error during authorization.',
      detail: JSON.stringify({ error, errorDescription, state }, null, 2),
    });
    return new NextResponse(html, {
      status: 400,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  if (!code) {
    return NextResponse.json(
      {
        error: 'Missing authorization code.',
        hint: 'Nextdoor should redirect here with ?code=...&state=...',
        callback: url.pathname,
      },
      { status: 400 }
    );
  }

  const html = buildHtml({
    status: 'success',
    title: 'Nextdoor authorization callback received',
    message:
      'The redirect URI is working. Token exchange is not implemented yet in this callback route. Next step: exchange the authorization code server-side and store tokens securely.',
    detail: JSON.stringify(
      {
        code_preview: `${code.slice(0, 8)}...`,
        state: state ?? null,
        received_at: new Date().toISOString(),
      },
      null,
      2
    ),
  });

  return new NextResponse(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

