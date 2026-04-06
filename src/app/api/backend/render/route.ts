import { buildBackendUrl, passthroughHeaders } from "../_backend";

export async function POST(req: Request): Promise<Response> {
  const upstream = await fetch(buildBackendUrl("/render"), {
    method: "POST",
    headers: {
      "content-type": req.headers.get("content-type") || "application/json",
      accept: req.headers.get("accept") || "*/*",
    },
    body: await req.arrayBuffer(),
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: passthroughHeaders(upstream.headers),
  });
}
