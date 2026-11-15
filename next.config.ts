import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev badge sits on top of the console timeline.
  devIndicators: false,
  // evacuid.us reaches this laptop through the Vultr server's tunnel.
  allowedDevOrigins: ["evacuid.us", "www.evacuid.us", "evacuaid.us", "www.evacuaid.us"],
};

export default nextConfig;
