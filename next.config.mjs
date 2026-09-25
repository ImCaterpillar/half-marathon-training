/** @type {import('next').NextConfig} */

// 基础安全响应头：禁止 MIME 嗅探 / 限制 referrer / 禁止被 iframe 嵌套 / 关闭无用的浏览器能力。
// 未启用 CSP：App Router 依赖内联样式与脚本，硬开 CSP 会破坏现有页面，故只做低风险加固。
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // 显式声明响应压缩（Next 默认开启，写明避免被误关）
  compress: true,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
    ];
  },
};

export default nextConfig;
