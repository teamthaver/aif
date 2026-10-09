/** @type {import('next').NextConfig} */
export default {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // KYC documents are uploaded through Server Actions (3 MB per file is enforced in the action)
    serverActions: { bodySizeLimit: '5mb' },
  },
};
