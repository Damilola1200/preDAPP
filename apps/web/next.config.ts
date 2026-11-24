import type { NextConfig } from "next";
const config: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NODE_ENV === "production" ? ".next-production" : ".next",
};
export default config;
