# Miru Public Site

Public site riêng của Miru, dùng Next.js App Router.

## Chạy local

```bash
npm install
npm run dev
```

Mặc định:
- Public site: `http://localhost:3001`
- App chính: `http://localhost:3000`
- Backend API: `http://localhost:8008`

## Biến môi trường

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8008
NEXT_PUBLIC_SITE_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Route công khai

- `/`
- `/therapists`
- `/therapists/[therapistId]`
- `/bai-viet`
- `/bai-viet/[slug]`
