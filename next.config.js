// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false, // Manter desabilitado em produção
  webpack: (config, { isServer, dev }) => {
    // A configuração de source map padrão do Next.js será usada em dev
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        readline: false,
        child_process: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;