import type {NextConfig} from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  experimental: {cpus: 2},
  async headers() {
    return [{source:'/:path*',headers:[
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Referrer-Policy',value:'no-referrer'},
      {key:'Permissions-Policy',value:'microphone=(self), camera=(), geolocation=()'},
      {key:'Content-Security-Policy',value:"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"}
    ]},{source:'/api/:path*',headers:[{key:'Cache-Control',value:'no-store'}]}];
  }
};
export default config;
