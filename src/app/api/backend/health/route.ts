import { getBackendBaseUrl } from "../_backend";

export async function GET(): Promise<Response> {
  try {
    const res = await fetch(getBackendBaseUrl(), { method: "GET" });
    const ok = res.ok;
    return Response.json({ ok }, { status: ok ? 200 : 502 });
  } catch {
    return Response.json({ ok: false }, { status: 502 });
  }
}
