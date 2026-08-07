# Codex Usage Manager

Ứng dụng web chạy cục bộ để theo dõi quota Codex qua giao thức chính thức `codex app-server` (JSONL stdio). Ứng dụng không scraping ChatGPT, không dùng Platform Usage API và không đọc token/password của người dùng.

## Yêu cầu

- Windows 10/11
- Node.js LTS và Codex CLI đã đăng nhập được

## Chạy lần đầu

Sau khi cài Node.js, hãy đóng và mở lại PowerShell để PATH được cập nhật. Nếu cửa sổ hiện tại vẫn báo `npm is not recognized`, chạy một lần:

```powershell
$env:Path = "$env:ProgramFiles\nodejs;$env:Path"
```

Trên máy bị chặn `npm.ps1` bởi Execution Policy, dùng `npm.cmd` thay cho `npm`:

```powershell
npm.cmd install
npm.cmd run setup
npm.cmd run dev
```

Mở `http://127.0.0.1:3000`. Runtime data nằm ở `%LOCALAPPDATA%\CodexUsageManager` (có thể đổi bằng `CODEX_USAGE_DATA_DIR`). Mỗi tài khoản có `CODEX_HOME` riêng; `auth.json` không bao giờ được ghi vào database hoặc log.

## Shortcut ngoài Desktop

Tạo biểu tượng `Codex Usage Manager` trên Desktop một lần bằng lệnh:

```powershell
npm.cmd run desktop:shortcut
```

Sau đó chỉ cần bấm đúp biểu tượng. Launcher sẽ tự build khi source thay đổi, khởi động production server tối ưu ở chế độ ẩn, chờ app sẵn sàng rồi mở `http://127.0.0.1:3000` trong browser mặc định. Nếu server đã chạy, shortcut chỉ mở lại trang và không tạo tiến trình trùng.

Lưu ý: hãy mở đúng địa chỉ `http://127.0.0.1:3000`. Không mở qua URL VS Code Dev Tunnel (`*.devtunnels.ms` hoặc cổng Forwarded trong mục Ports), vì Dev Tunnel sẽ yêu cầu đăng nhập GitHub riêng. Màn hình “Sign in to GitHub to continue to Dev Tunnels” không phải màn hình đăng nhập Codex và không liên quan đến tài khoản Gmail trong Chrome.

Nếu Codex CLI không nằm trong PATH, đặt đường dẫn tuyệt đối trong `.env`:

```text
CODEX_CLI_PATH=C:/path/to/codex.exe
```

Với Codex cài cùng VS Code trên Windows, có thể dùng dạng đường dẫn sau (phiên bản thư mục có thể thay đổi):

```text
CODEX_CLI_PATH=C:/Users/<user>/.vscode/extensions/openai.chatgpt-<version>-win32-x64/bin/windows-x86_64/codex.exe
```

Sau khi sửa `.env`, hãy dừng và chạy lại `npm.cmd run dev` để Next.js nạp biến môi trường mới.

## Kiểm tra chất lượng

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

`account/usage/read` và một số trường quota phụ thuộc phiên bản Codex CLI. Khi CLI không tương thích, dashboard giữ snapshot cũ và hiển thị trạng thái tương ứng; không suy diễn ngày hết hạn gói.

## Bảo mật và xử lý lỗi

Chỉ bind `127.0.0.1`, spawn CLI bằng argument array (`shell: false`), giới hạn request timeout và redact token/cookie/header trong lỗi. Xóa session yêu cầu xác nhận trên giao diện và xóa toàn bộ Codex home cô lập cùng metadata local.
