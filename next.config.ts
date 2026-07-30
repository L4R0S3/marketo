import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le rendu Satori lit les polices sur le disque (fs.readFileSync). Sans cette
  // inclusion explicite, le traçage de fichiers de Vercel ne les embarque pas dans
  // la fonction et la route /api/og échoue seulement en production.
  outputFileTracingIncludes: {
    "/api/og/[id]": ["./public/fonts/**/*"],
  },
};

export default nextConfig;
