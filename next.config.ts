import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le rendu Satori lit les polices sur le disque (fs.readFileSync). Sans cette
  // inclusion explicite, le traçage de fichiers de Vercel ne les embarque pas dans
  // la fonction et la route /api/og échoue seulement en production.
  // MJML est un compilateur : il lit des fichiers et n'a rien à faire dans le
  // paquet client. On le laisse hors du bundle serveur.
  serverExternalPackages: ["mjml"],

  outputFileTracingIncludes: {
    "/api/og/[id]": ["./public/fonts/**/*", "./public/frames/**/*"],
  },
};

export default nextConfig;
