"use client";

import { parseGras } from "@/lib/templates/social/parseGras";
import { GEOMETRIE, THEMES } from "@/lib/templates/social/themes";
import type { PostVisuelT } from "@/lib/templates/social/schema";

// Aperçu en direct du post social, au format réel 1080 × 1350 puis réduit.
// Mêmes trois couches que le rendu Satori — photo, frame PNG, texte — et les
// mêmes limites de placement, pour que ce qu'on voit ici corresponde au PNG
// produit à l'étape suivante. Le frame est servi depuis /public/frames.
//
// Reste une approximation : les polices du navigateur ne sont pas Anton et
// Raleway sous-ensemblées, donc les coupures de lignes peuvent différer de
// quelques caractères.

const L = GEOMETRIE.largeur;
const H = GEOMETRIE.hauteur;
const CONTENU_X = GEOMETRIE.bordure; // pastilles collées à la bordure intérieure
const TITRE_X = 34;
const MARGE_DROITE = 40;
const BLANC = "#ffffff";
const ENCRE = "#141414";

// Même règle que le gabarit Satori : le titre remplit la largeur du bandeau.
const tailleDuTitre = (titre: string) =>
  Math.max(18, Math.min(150, Math.floor((L - TITRE_X - MARGE_DROITE) / (0.425 * Math.max(titre.length, 1)))));

function Ligne({ texte, taille }: { texte: string; taille: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignSelf: "flex-start",
        background: BLANC,
        borderRadius: 12,
        padding: "8px 18px",
        marginBottom: 8,
        color: ENCRE,
        fontSize: taille,
        lineHeight: 1.25,
        whiteSpace: "pre",
      }}
    >
      {parseGras(texte).map((s, i) => (
        <span key={i} style={{ fontWeight: s.gras ? 800 : 400 }}>
          {s.texte}
        </span>
      ))}
    </span>
  );
}

function BlocPrix({
  prix,
  compact,
  supplement,
}: {
  prix: PostVisuelT["prix_secondaire"];
  compact?: boolean;
  supplement?: boolean;
}) {
  if (!prix) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", color: BLANC }}>
      <span style={{ fontSize: compact ? 26 : 30, textShadow: "0 3px 10px rgba(0,0,0,.65)" }}>
        {prix.surtitre}
      </span>
      <span
        style={{
          fontSize: compact ? 82 : 140,
          fontWeight: 900,
          lineHeight: 1,
          transform: "skewX(-12deg)",
          textShadow: "0 6px 18px rgba(0,0,0,.6)",
        }}
      >
        {supplement ? "+" : ""}${prix.montant}
      </span>
      {prix.mentions.map((m, i) => (
        <span key={i} style={{ fontSize: 24, textShadow: "0 3px 10px rgba(0,0,0,.65)" }}>
          {m}
        </span>
      ))}
    </div>
  );
}

export function ApercuPost({
  visuel,
  echelle = 0.36,
}: {
  visuel: PostVisuelT;
  echelle?: number;
}) {
  const theme = THEMES[visuel.theme];
  const double = visuel.colonnes.length === 2;
  const position =
    visuel.photo.focale === "haut" ? "top" : visuel.photo.focale === "bas" ? "bottom" : "center";

  return (
    <div
      style={{ width: L * echelle, height: H * echelle }}
      className="overflow-hidden rounded-md border bg-muted"
    >
      <div
        style={{
          position: "relative",
          width: L,
          height: H,
          transform: `scale(${echelle})`,
          transformOrigin: "top left",
          backgroundColor: "#2b3440",
        }}
      >
        {/* Couche 1 — la photo */}
        {visuel.photo.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={visuel.photo.url}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: L,
              height: H,
              objectFit: "cover",
              objectPosition: position,
            }}
          />
        )}

        {/* Couche 2 — le frame : cadre, dégradé, voile et signature */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/frames/${theme.fichier}`}
          alt=""
          style={{ position: "absolute", inset: 0, width: L, height: H }}
        />

        {/* Couche 3 — le texte */}
        <div style={{ position: "absolute", inset: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: GEOMETRIE.bandeauHaut,
              padding: `0 ${MARGE_DROITE}px 0 ${TITRE_X}px`,
            }}
          >
            <span
              style={{
                color: BLANC,
                fontSize: tailleDuTitre(visuel.titre || "Titre du post"),
                fontWeight: 900,
                lineHeight: 1.05,
                transform: "skewX(-12deg)",
                textShadow: "0 6px 18px rgba(0,0,0,.45)",
              }}
            >
              {visuel.titre || "Titre du post"}
            </span>
          </div>

          {/* Sous la diagonale du frame : au-dessus, une pastille collée à
              gauche chevaucherait le coin coupé. */}
          <div
            style={{
              position: "absolute",
              top: GEOMETRIE.contenuHaut,
              left: CONTENU_X,
              right: MARGE_DROITE,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                alignSelf: "flex-start",
                background: BLANC,
                color: ENCRE,
                borderRadius: 12,
                padding: "12px 22px",
                marginBottom: 22,
                fontWeight: 800,
                fontSize: 34,
              }}
            >
              <span style={{ marginRight: 14 }}>→</span>
              {visuel.bandeau.toUpperCase()}
            </span>

            <div style={{ display: "flex", gap: 20 }}>
              {visuel.colonnes.map((col, i) => (
                <div
                  key={i}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start" }}
                >
                  {col.entete && <Ligne texte={`**${col.entete}**`} taille={double ? 28 : 30} />}
                  {col.blocs.map((b, j) => (
                    <div
                      key={j}
                      style={{ display: "flex", flexDirection: "column", marginBottom: 10 }}
                    >
                      {b.lignes.map((l, k) => (
                        <Ligne key={k} texte={l} taille={double ? 27 : 30} />
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Prix : à gauche de la signature portée par le frame */}
          <div
            style={{
              position: "absolute",
              left: TITRE_X,
              bottom: 46,
              display: "flex",
              flexDirection: "column",
              width: GEOMETRIE.signatureX - TITRE_X - 20,
            }}
          >
            {double ? (
              <div style={{ display: "flex", gap: 28 }}>
                {visuel.colonnes.map((col, i) => (
                  <BlocPrix key={i} prix={col.prix} compact />
                ))}
              </div>
            ) : (
              <BlocPrix prix={visuel.colonnes[0].prix} />
            )}
            {visuel.prix_secondaire && (
              <div style={{ marginTop: 14 }}>
                <BlocPrix prix={visuel.prix_secondaire} compact supplement />
              </div>
            )}
          </div>

          {visuel.badge && (
            <span
              style={{
                position: "absolute",
                right: MARGE_DROITE,
                bottom: 150,
                display: "inline-flex",
                alignItems: "center",
                background: "#f3ecdd",
                color: ENCRE,
                borderRadius: 20,
                padding: "12px 22px",
                fontWeight: 700,
                fontSize: 24,
              }}
            >
              <span style={{ fontWeight: 900, fontSize: 34, marginRight: 12 }}>
                {visuel.badge.icone.toUpperCase()}
              </span>
              {visuel.badge.texte}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
