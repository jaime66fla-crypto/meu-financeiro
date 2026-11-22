// PoupeMais API - Cloudflare Workers + D1
// Development scaffold. No financial data is exposed without authentication.
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra }
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowedOrigin = env.ALLOWED_ORIGIN || "";
    const cors = origin && origin === allowedOrigin
      ? { "access-control-allow-origin": origin, "vary": "Origin" }
      : {};
    if (request.method === "OPTIONS") {
      if (!origin || origin !== allowedOrigin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: {
        ...cors, "access-control-allow-methods": "GET",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "600"
      }});
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "poupemais-api" }, 200, cors);
    }
    if (request.method === "GET" && url.pathname === "/health/db") {
      if (!env.DB) return json({ ok: false, error: "D1 binding DB ausente" }, 503, cors);
      try {
        const row = await env.DB.prepare("SELECT 1 AS connected").first();
        return json({ ok: row?.connected === 1, database: "connected" }, 200, cors);
      } catch {
        return json({ ok: false, error: "Falha ao conectar ao D1" }, 503, cors);
      }
    }
    return json({ error: "Rota nao encontrada" }, 404, cors);
  }
};
