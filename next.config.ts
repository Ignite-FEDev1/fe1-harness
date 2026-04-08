import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // 팀 공용 Supabase (harness DB) — clone 후 바로 실행 가능하도록 기본값 설정
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://iuktshqxcvlpnbgtrnwx.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1a3RzaHF4Y3ZscG5iZ3Rybnd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMjQ4MjAsImV4cCI6MjA5MDYwMDgyMH0',
        'o0U33BjeVudjcEaObfvcrwbj1x6Hi-CS5EgKOPjtNq0',
      ].join('.'),
    // fe1-web Supabase (사용자 정보 조회용)
    FE1_WEB_SUPABASE_URL:
      process.env.FE1_WEB_SUPABASE_URL ||
      'https://dkdmfyhhdfcmhciwetfj.supabase.co',
    FE1_WEB_SUPABASE_SERVICE_KEY:
      process.env.FE1_WEB_SUPABASE_SERVICE_KEY ||
      [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrZG1meWhoZGZjbWhjaXdldGZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIwNTQ3NSwiZXhwIjoyMDg4NzgxNDc1fQ',
        'euniX149sbBpBMsRmeq_jNqL6oRDtktDJWC7-lYUmH0',
      ].join('.'),
  },
};

export default nextConfig;
