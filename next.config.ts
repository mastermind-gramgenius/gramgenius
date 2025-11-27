import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Google avatars
      },
      {
        protocol: "https",
        hostname: "platform-lookaside.fbsbx.com", // Facebook avatars
      },
      {
        protocol: "https",
        hostname: "scontent.xx.fbcdn.net", // FB CDN fallback
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com", // Cloudinary uploads (optional)
      }
    ],
  },
};

export default nextConfig;
