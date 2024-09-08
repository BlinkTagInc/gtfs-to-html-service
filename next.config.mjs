/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.module.unknownContextCritical = false
 
    return config
  },
};

export default nextConfig;
