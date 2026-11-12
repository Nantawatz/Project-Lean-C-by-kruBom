// Legacy clients get an explicit error; arbitrary native execution is removed.
// The current UI compiles and runs C in a dedicated browser WebAssembly worker.
export async function POST() {
  return Response.json({error:'Server execution has been removed. Refresh the page to use the browser compiler.'},{status:410,headers:{'Cache-Control':'no-store'}});
}
