import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Exclude packages from server-side bundling to prevent test files from being included
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream"],
  // Turbopack configuration
  turbopack: {},
  // Webpack configuration (for non-Turbopack builds)
  webpack: (config, { webpack }) => {
    // Ignore test files from thread-stream package
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/test\//,
        contextRegExp: /thread-stream/,
      })
    );

    // Ignore test dependencies that are only used in test files
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^(tap|tape|why-is-node-running)$/,
      })
    );

    return config;
  },
};

export default nextConfig;
