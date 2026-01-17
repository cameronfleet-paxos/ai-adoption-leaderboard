import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable static export - we need server-side routes for OAuth
  // output: 'export',

  // Disable image optimization for external GitHub avatars
  images: {
    unoptimized: true,
  },

  // Ensure trailing slashes for compatibility
  trailingSlash: true,
};

export default nextConfig;
