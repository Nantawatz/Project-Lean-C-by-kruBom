import { runProgram, stop } from '../../../lib/runner.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function allowed(request: Request) {
  const host = request.headers.get('host'), origin = request.headers.get('origin');
  if (!host) return false;
  const url = new URL(`http://${host}`);
  return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && (!origin || origin === url.origin) && request.headers.get('x-c-studio') === '1';
}
export async function POST(request: Request) {
  if (!allowed(request)) return Response.json({error:'The compiler is available on localhost only.'}, {status:403});
  try {
    if (Number(request.headers.get('content-length')) > 220000) return Response.json({error:'Request too large'}, {status:413});
    const body = await request.json();
    if (typeof body.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(body.id)) throw new Error('Invalid run ID');
    if (body.action === 'stop') { stop(body.id); return Response.json({stopped:true}); }
    const result = await runProgram(body);
    if ('binary' in result) return new Response(result.binary, {headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${result.name}"`}});
    return Response.json(result);
  } catch (error) { return Response.json({error: error instanceof Error ? error.message : 'Run failed'}, {status:400}); }
}
