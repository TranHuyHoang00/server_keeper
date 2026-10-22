// Server nhận và phát token cho Session Keeper.
//
// Extension (máy B) đẩy token mới nhất lên đây; máy/dự án khác lấy token qua GET.
// Mọi request phải mang header khóa bí mật: X-Session-Keeper-Key.
// Token chỉ giữ trong bộ nhớ (mất khi restart; extension sẽ đẩy lại khi có token mới).
//
// Chạy:  SK_KEY=chuoi-bi-mat-dai node server.mjs
// Biến môi trường: PORT (mặc định 7777), HOST (mặc định 127.0.0.1), SK_KEY (bắt buộc)

import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.PORT || 7777);
const HOST = process.env.HOST || "127.0.0.1"; // mặc định chỉ nghe localhost; ngrok trỏ vào đây
const KEY = process.env.SK_KEY;
const MAX_BODY = 64 * 1024; // chặn body quá lớn

if (!KEY || KEY.length < 8) {
  console.error("Thiếu SK_KEY hoặc khóa quá ngắn (cần >= 8 ký tự). Ví dụ: SK_KEY=chuoi-bi-mat-dai node server.mjs");
  process.exit(1);
}

const store = new Map(); // site -> { token, cookie, exp, at }

// So khóa kiểu timing-safe để tránh đoán khóa qua thời gian phản hồi.
function authorized(req) {
  const got = req.headers["x-session-keeper-key"];
  if (typeof got !== "string") return false;
  const a = Buffer.from(got);
  const b = Buffer.from(KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const json = (res, code, obj) => {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
};

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("body quá lớn"));
        req.destroy();
        return;
      }
      data += c;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // /health không cần khóa, để kiểm tra server sống (không lộ token).
  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { ok: true, sites: [...store.keys()] });
  }

  if (!authorized(req)) return json(res, 401, { error: "unauthorized" });

  // Extension đẩy token mới lên
  if (req.method === "POST" && url.pathname === "/token") {
    let body;
    try {
      body = await readBody(req, MAX_BODY);
    } catch {
      return json(res, 413, { error: "body quá lớn" });
    }
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return json(res, 400, { error: "json sai" });
    }
    const { site, cookie, token, exp } = data;
    if (!site || !token) return json(res, 400, { error: "thiếu site/token" });
    store.set(site, { token, cookie: cookie || null, exp: exp || null, at: Date.now() });
    const when = exp ? new Date(exp * 1000).toLocaleTimeString() : "?";
    console.log(`[${new Date().toLocaleTimeString()}] nhận token của ${site}, hết hạn ${when}`);
    return json(res, 200, { ok: true });
  }

  // Dự án lấy token mới nhất: GET /token?site=app.congty.vn
  // Không có ?site mà đang giữ nhiều site → yêu cầu nói rõ, tránh trả nhầm token.
  if (req.method === "GET" && url.pathname === "/token") {
    const site = url.searchParams.get("site");
    if (!site && store.size > 1) {
      return json(res, 400, { error: "có nhiều site, cần ?site=", sites: [...store.keys()] });
    }
    const rec = site ? store.get(site) : [...store.values()][0];
    if (!rec) return json(res, 404, { error: "chưa có token", sites: [...store.keys()] });
    return json(res, 200, rec);
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, HOST, () =>
  console.log(`Server token chạy ở http://${HOST}:${PORT} (health: /health). Đang giữ token cho 0 site.`)
);
