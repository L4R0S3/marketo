// Détection du type réel d'un fichier par sa signature binaire (magic bytes),
// indépendante du MIME déclaré par le client (qui est spoofable).
// Réutilisable sur les deux buckets (documents, photos).

export type TypeReconnu = "png" | "jpeg" | "webp" | "pdf";

const MIME: Record<TypeReconnu, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};

export type Detection = { type: TypeReconnu; mime: string; estImage: boolean };

// Renvoie null si la signature ne correspond à aucun type accepté.
export function detecterType(buf: Buffer): Detection | null {
  let type: TypeReconnu | null = null;

  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    type = "png"; // 89 50 4E 47 0D 0A 1A 0A
  } else if (
    buf.length >= 3 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff
  ) {
    type = "jpeg"; // FF D8 FF
  } else if (
    buf.length >= 12 &&
    buf.toString("latin1", 0, 4) === "RIFF" &&
    buf.toString("latin1", 8, 12) === "WEBP"
  ) {
    type = "webp"; // RIFF....WEBP
  } else if (buf.length >= 5 && buf.toString("latin1", 0, 5) === "%PDF-") {
    type = "pdf"; // %PDF-
  }

  if (!type) return null;
  return { type, mime: MIME[type], estImage: type !== "pdf" };
}
