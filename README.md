# Server Keeper

Server trung chuyển token cho [Session Keeper](https://github.com/TranHuyHoang00/extension_session_keeper).
Extension (máy B) đẩy token mới nhất lên đây; một máy/dự án **khác** lấy token qua HTTP để tự gọi API công ty.

```
Ext (máy B) ──POST /token──►  Server Keeper (máy B, localhost:7777) ──ngrok──►  Máy A: GET /token
   token mới                         giữ token mới nhất trong RAM                 lấy token mới nhất
```

Server **không tạo hay sửa token**, chỉ nhận và chuyển tiếp. Token chỉ giữ trong bộ nhớ,
mất khi restart (extension sẽ đẩy lại khi có token mới).

## Chạy

Cần Node.js (không cần cài thư viện ngoài). Khóa bí mật là **bắt buộc**.

```bash
# Linux/macOS
SK_KEY=mot-chuoi-bi-mat-dai npm start

# Windows (cmd)
set SK_KEY=mot-chuoi-bi-mat-dai
npm start
```

Biến môi trường:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `SK_KEY` | (bắt buộc) | Khóa bí mật, tối thiểu 8 ký tự. Phải trùng với khóa khai trong extension và bên gọi. |
| `PORT` | `7777` | Cổng server. |
| `HOST` | `127.0.0.1` | Địa chỉ nghe. Mặc định chỉ localhost; ngrok trỏ vào đây. |

## Mở ra ngoài bằng ngrok

```bash
ngrok http 7777
```

ngrok cho một URL dạng `https://abcd.ngrok-free.app`.

- Trong extension → Cài đặt website → **Nâng cao → đẩy token lên server**:
  - URL: `https://abcd.ngrok-free.app/token`
  - Khóa bí mật: đúng chuỗi `SK_KEY`

## API

Mọi request (trừ `/health`) phải có header `X-Session-Keeper-Key: <SK_KEY>`.

### `POST /token` — extension đẩy token lên

```json
{ "site": "app.congty.vn", "cookie": "privateToken", "token": "<JWT>", "exp": 1792722565 }
```

→ `200 { "ok": true }`

### `GET /token?site=app.congty.vn` — lấy token mới nhất

```
GET /token?site=app.congty.vn
X-Session-Keeper-Key: <SK_KEY>
```

→ `200 { "token": "<JWT>", "cookie": "privateToken", "exp": 1792722565, "at": 1792636165000 }`

Nếu đang giữ nhiều site mà không truyền `?site=`, server trả `400` kèm danh sách site để tránh trả nhầm.

### `GET /health` — kiểm tra server sống (không cần khóa, không lộ token)

→ `200 { "ok": true, "sites": ["app.congty.vn"] }`

### Ví dụ lấy token từ máy A

```bash
curl -H "X-Session-Keeper-Key: mot-chuoi-bi-mat-dai" \
  "https://abcd.ngrok-free.app/token?site=app.congty.vn"
```

## Cảnh báo bảo mật

- Đây là nơi **token production đi qua**. URL ngrok là công khai, nên **khóa bí mật là bắt buộc**;
  đừng để lộ URL kèm khóa.
- Server dùng HTTPS của ngrok, so khóa kiểu timing-safe, và không ghi giá trị token ra log.
- Token chỉ nằm trong RAM, không ghi ra file.
- Nếu mục tiêu là để một máy tự động gọi API công ty, cân nhắc xin **tài khoản dịch vụ
  (client credentials)** thay vì mượn token phiên của người dùng. Nên hỏi bộ phận bảo mật trước khi dùng thật.
