// Server nhận và phát token cho Session Keeper. Chạy: SK_KEY=chuoi-bi-mat node server.mjs
import http from "node:http";

const PORT = Number(process.env.PORT || 7777);
const KEY = process.env.SK_KEY; // khóa bí mật, BẮT BUỘC
if (!KEY) {
  console.error("Thiếu SK_KEY (khóa bí mật).");
  process.exit(1);
}

const store = new Map(); // site -> { token, cookie, exp, at }

const auth = (req) => req.headers["x-session-keeper-key"] === KEY;
const json = (res, code, obj) => {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(obj));
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (!auth(req)) return json(res, 401, { error: "unauthorized" });

    // Extension đẩy token mới lên
    if (req.method === "POST" && url.pathname === "/token") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try {
          const { site, cookie, token, exp } = JSON.parse(body);
          if (!site || !token)
            return json(res, 400, { error: "thiếu site/token" });
          store.set(site, { token, cookie, exp, at: Date.now() });
          console.log(
            `[${new Date().toLocaleTimeString()}] nhận token của ${site}, hết hạn ${new Date(exp * 1000).toLocaleTimeString()}`,
          );
          json(res, 200, { ok: true });
        } catch {
          json(res, 400, { error: "json sai" });
        }
      });
      return;
    }

    // Dự án A lấy token mới nhất: GET /token?site=app.congty.vn
    if (req.method === "GET" && url.pathname === "/token") {
      const site = url.searchParams.get("site");
      const rec = site ? store.get(site) : [...store.values()].at(-1);
      if (!rec) return json(res, 404, { error: "chưa có token" });
      return json(res, 200, rec);
    }

    json(res, 404, { error: "not found" });
  })
  .listen(PORT, () =>
    console.log(`Server token chạy ở http://localhost:${PORT}`),
  );
