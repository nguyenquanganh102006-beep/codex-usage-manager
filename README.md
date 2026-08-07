# Codex Usage Manager

Ứng dụng web chạy hoàn toàn trên máy local để quản lý nhiều tài khoản Codex và theo dõi quota còn lại từ một dashboard duy nhất.

Ứng dụng giao tiếp trực tiếp với `codex app-server` qua JSONL/stdio. Không scraping giao diện ChatGPT, không dùng browser automation, không yêu cầu mật khẩu, mã 2FA, cookie hoặc access token của người dùng.

> Dự án cá nhân, không phải sản phẩm chính thức của OpenAI.

## Tính năng

- Quản lý nhiều tài khoản Codex bằng các phiên đăng nhập được cô lập.
- Hiển thị gói hiện tại, trạng thái tài khoản và email đã che bớt.
- Hiển thị phần trăm quota **còn lại** cho từng cửa sổ giới hạn.
- Hiển thị thời gian còn lại trước khi quota reset.
- Lưu snapshot usage, lịch sử thay đổi gói và dữ liệu token khi Codex trả về.
- Cảnh báo khi gần hết quota, cần đăng nhập lại hoặc không thể truy cập.
- Hỗ trợ giao diện Light và Dark.
- Cập nhật dữ liệu khi tải lại trang hoặc nhấn `F5`; không tự động gọi kiểm tra theo chu kỳ.
- Có shortcut ngoài Desktop để tự khởi động server và mở ứng dụng.
- Chỉ lắng nghe tại `127.0.0.1:3000` và không gửi telemetry.

## Cách hoạt động

Mỗi tài khoản có một `CODEX_HOME` riêng tại:

```text
%LOCALAPPDATA%\CodexUsageManager\accounts\<account-id>\codex-home
```

Khi đăng nhập, ứng dụng mở trang OAuth chính thức trong trình duyệt. Bạn tự đăng nhập và xử lý MFA trên trang của nhà cung cấp. Sau khi hoàn tất, backend gọi Codex App Server để lấy trạng thái tài khoản và quota.

Ứng dụng không đọc hoặc lưu mật khẩu. File phiên đăng nhập của Codex không được ghi vào database hay log.

## Yêu cầu hệ thống

- Windows 10 hoặc Windows 11.
- [Node.js LTS](https://nodejs.org/).
- Codex CLI có thể chạy trên máy.
- Tài khoản ChatGPT có quyền sử dụng Codex.

Xem hướng dẫn Codex CLI trong [tài liệu OpenAI chính thức](https://learn.chatgpt.com/docs/codex/cli).

Kiểm tra sau khi cài đặt:

```powershell
node --version
npm.cmd --version
codex --version
```

Nếu PowerShell báo `npm is not recognized`, hãy đóng rồi mở lại PowerShell. Nếu vẫn chưa nhận Node.js:

```powershell
$env:Path = "$env:ProgramFiles\nodejs;$env:Path"
```

## Cài đặt lần đầu

Mở PowerShell tại thư mục dự án và chạy:

```powershell
npm.cmd install
npm.cmd run setup
npm.cmd run dev
```

Sau đó mở:

```text
http://127.0.0.1:3000
```

Không dùng URL VS Code Dev Tunnel (`*.devtunnels.ms`) hoặc cổng Forwarded trong VS Code. Dev Tunnel yêu cầu đăng nhập GitHub riêng và không liên quan đến phiên đăng nhập Codex.

## Cấu hình Codex CLI

Ứng dụng tự tìm lệnh `codex` trong `PATH`. Nếu hiện thông báo **Không tìm thấy Codex CLI**, hãy tạo file `.env` ở thư mục gốc dự án và đặt đường dẫn tuyệt đối:

```env
CODEX_CLI_PATH=C:/duong-dan-den/codex.exe
```

Nếu Codex được cài cùng extension OpenAI trong VS Code, đường dẫn thường có dạng:

```env
CODEX_CLI_PATH=C:/Users/<ten-user>/.vscode/extensions/openai.chatgpt-<version>-win32-x64/bin/windows-x86_64/codex.exe
```

Tên thư mục phiên bản có thể thay đổi sau khi extension cập nhật. Sau khi sửa `.env`, hãy dừng server bằng `Ctrl+C` rồi chạy lại:

```powershell
npm.cmd run dev
```

File `.env.example` chứa các biến cấu hình được hỗ trợ:

```env
CODEX_USAGE_DATA_DIR=
CODEX_CLI_PATH=
DATABASE_URL=
```

- `CODEX_USAGE_DATA_DIR`: thay đổi nơi lưu dữ liệu runtime.
- `CODEX_CLI_PATH`: đường dẫn tuyệt đối tới `codex.exe`.
- `DATABASE_URL`: được `npm.cmd run setup` tạo tự động; thông thường không cần nhập.

## Đăng nhập tài khoản

1. Mở dashboard và tạo tài khoản bằng một tên hiển thị dễ nhận biết.
2. Nhấn nút đăng nhập trên thẻ tài khoản.
3. Hoàn thành đăng nhập và MFA trong tab OAuth vừa mở.
4. Khi trang báo đăng nhập thành công, đóng tab OAuth và quay lại dashboard.
5. Tải lại dashboard nếu dữ liệu chưa xuất hiện ngay.

Mỗi tài khoản mới phải đăng nhập một lần vì ứng dụng chủ động cô lập các phiên. Tài khoản Google đang mở trong tab Chrome khác không tự động quyết định tài khoản Codex được chọn.

## Cập nhật usage

Usage được làm mới khi:

- tải lại trang;
- nhấn `F5`;
- hoặc nhấn nút làm mới trên từng tài khoản.

Ứng dụng không chạy lịch cập nhật 15 phút ở nền. Nếu OpenAI không trả về một trường dữ liệu, dashboard hiển thị trạng thái không có dữ liệu thay vì tự suy diễn.

## Tạo shortcut trên Desktop

Sau khi hoàn tất cài đặt lần đầu, chạy:

```powershell
npm.cmd run desktop:shortcut
```

Desktop sẽ có shortcut **Codex Usage Manager**. Khi bấm đúp, launcher sẽ:

1. kiểm tra ứng dụng đã chạy hay chưa;
2. tự cài dependency nếu chưa có `node_modules`;
3. chạy setup nếu chưa có `.env`;
4. build lại khi source mới hơn bản build;
5. khởi động server ẩn tại `127.0.0.1:3000`;
6. mở ứng dụng trong trình duyệt mặc định.

Log của launcher và server nằm tại:

```text
%LOCALAPPDATA%\CodexUsageManager\logs
```

Nếu shortcut mở rồi đóng ngay, kiểm tra các file:

```text
desktop-launcher.log
server-output.log
server-error.log
```

## Các lệnh phát triển

```powershell
npm.cmd run dev          # Chạy development server
npm.cmd run build        # Tạo production build
npm.cmd run start        # Chạy production server
npm.cmd run lint         # Kiểm tra ESLint
npm.cmd run typecheck    # Kiểm tra TypeScript
npm.cmd test             # Chạy test
npm.cmd run setup        # Tạo database và kiểm tra Codex CLI
npm.cmd run desktop:shortcut
```

## Dữ liệu và bảo mật

Dữ liệu runtime mặc định nằm ngoài repository và ngoài thư mục OneDrive:

```text
%LOCALAPPDATA%\CodexUsageManager
├── manager.db
├── accounts\
├── launcher\
└── logs\
```

Các nguyên tắc chính:

- Server chỉ bind `127.0.0.1`.
- Codex CLI được chạy bằng argument array với `shell: false`.
- Email được che trước khi ghi database.
- Log được lọc token, cookie và authorization header.
- `.env`, database, log và Codex auth cache không được commit vào Git.
- Xóa session sẽ xóa Codex home riêng của tài khoản trên máy local.

## Giới hạn

- Codex App Server có thể thay đổi giữa các phiên bản CLI.
- OpenAI có thể không trả về token usage hoặc một số trường quota cho mọi tài khoản.
- Ứng dụng không biết ngày hết hạn Plus; nó chỉ phát hiện khi loại gói được server trả về thay đổi.
- `401`, `403` hoặc lỗi refresh session chỉ được hiển thị là cần đăng nhập lại hoặc không truy cập được.
- Ứng dụng không tiêu thụ reset credits và không tự gửi prompt để kiểm tra tài khoản.

## Xử lý lỗi nhanh

### `npm` không được nhận diện

Cài Node.js LTS, mở lại PowerShell rồi dùng `npm.cmd` thay cho `npm`.

### Không tìm thấy Codex CLI

Chạy `codex --version`. Nếu lệnh không hoạt động, đặt `CODEX_CLI_PATH` trong `.env` rồi khởi động lại server.

### Đăng nhập thành công nhưng dashboard vẫn báo cần đăng nhập

Đóng tab OAuth, quay lại đúng `http://127.0.0.1:3000`, chờ vài giây rồi tải lại trang. Không mở ứng dụng qua Dev Tunnel.

### Cổng 3000 đang được sử dụng

Đóng tiến trình Next.js cũ hoặc tab terminal đang chạy dự án, sau đó khởi động lại shortcut.

### Dữ liệu quota không xuất hiện

Kiểm tra trạng thái đăng nhập, nhấn làm mới và xem log. Một số phiên bản Codex CLI hoặc loại tài khoản có thể không trả về đầy đủ dữ liệu.

## Công nghệ

- Next.js 16 và React 19
- TypeScript và Tailwind CSS
- Prisma và SQLite
- TanStack Query
- Zod và Vitest
- Codex App Server qua JSONL/stdio

## License

Repository hiện chưa khai báo giấy phép mã nguồn mở. Mọi quyền được bảo lưu cho đến khi có file `LICENSE`.
