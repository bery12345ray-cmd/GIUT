import type { NextConfig } from "next";

const deployOrigins = [process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL];
if (process.env.CONTEXT === 'production') deployOrigins.push(process.env.URL);

const nextConfig: NextConfig = {
  // CONTEXT is a build variable; bake this non-secret label into server code
  // so production uploads remain site-scoped even across later deploys.
  env: {
    GIUT_DEPLOY_CONTEXT: process.env.CONTEXT || 'dev',
    GIUT_ALLOWED_ORIGINS: deployOrigins.filter(Boolean).join(','),
    GIUT_AUTH_ORIGIN: (process.env.CONTEXT === 'production' ? process.env.URL : process.env.DEPLOY_PRIME_URL) || 'http://localhost:3000',
  },
};

export default nextConfig;
