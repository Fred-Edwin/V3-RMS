/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Add your image host here when you have one, e.g.:
      // { protocol: 'https', hostname: 'your-bucket.s3.amazonaws.com' },
      // { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
};

export default nextConfig;
