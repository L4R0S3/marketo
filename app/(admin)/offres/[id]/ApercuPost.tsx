"use client";

import { parseGras } from "@/lib/templates/social/parseGras";
import { THEMES } from "@/lib/templates/social/themes";
import type { PostVisuelT } from "@/lib/templates/social/schema";

// Aperçu en direct du post social, au format réel 1080 × 1350 puis réduit.
// C'est une MAQUETTE DE STRUCTURE : elle sert à voir les coupures de lignes, la
// densité des blocs et les débordements pendant la saisie. Le rendu définitif
// (polices sous-ensemblées, cadre en dégradé, signature SVG, couleurs de marque)
// est produit par Satori en phase 4 — cf. CLAUDE.md §7 et §12.

const L = 1080;
const H = 1350;

function Ligne({ texte, className }: { texte: string; className?: string }) {
  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        background: "white",
        borderRadius: 10,
        padding: "6px 16px",
        color: "#111",
        fontStyle: "italic",
        fontSize: 30,
        lineHeight: 1.25,
        marginBottom: 6,
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
  compact = false,
}: {
  prix: PostVisuelT["prix_secondaire"];
  compact?: boolean;
}) {
  if (!prix) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", color: "white" }}>
      <span style={{ fontSize: compact ? 24 : 28, textShadow: "0 2px 6px rgba(0,0,0,.6)" }}>
        {prix.surtitre}
      </span>
      <span
        style={{
          fontSize: compact ? 80 : 140,
          fontWeight: 900,
          lineHeight: 0.95,
          fontStyle: "italic",
          textShadow: "0 4px 12px rgba(0,0,0,.55)",
        }}
      >
        {compact ? "+" : ""}${prix.montant}
      </span>
      <span style={{ fontSize: 22, opacity: 0.95, textShadow: "0 2px 6px rgba(0,0,0,.6)" }}>
        {prix.mentions.join(" ")}
      </span>
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

  return (
    <div
      style={{ width: L * echelle, height: H * echelle }}
      className="overflow-hidden rounded-md border bg-muted"
    >
      <div
        style={{
          width: L,
          height: H,
          transform: `scale(${echelle})`,
          transformOrigin: "top left",
          background: `linear-gradient(90deg, ${theme.gauche}, ${theme.droite})`,
          padding: 12,
          display: "flex",
        }}
      >
        <div
          style={{
            position: "relative",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 28,
            backgroundColor: "#334",
            backgroundImage: visuel.photo.url ? `url(${visuel.photo.url})` : undefined,
            backgroundSize: "cover",
            backgroundPosition:
              visuel.photo.focale === "haut"
                ? "top"
                : visuel.photo.focale === "bas"
                  ? "bottom"
                  : "center",
          }}
        >
          {/* Voile : même rôle que dans le gabarit Satori — un titre blanc doit
              rester lisible sur une photo claire. */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 620,
              background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)",
            }}
          />

          {/* Titre + bandeau */}
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14 }}>
            <span
              style={{
                color: "white",
                fontSize: 78,
                fontWeight: 900,
                fontStyle: "italic",
                lineHeight: 1,
                textShadow: "0 6px 16px rgba(0,0,0,.6)",
                transform: "skewX(-12deg)",
                transformOrigin: "left bottom",
              }}
            >
              {visuel.titre || "Titre du post"}
            </span>
            <span
              style={{
                display: "inline-block",
                background: "white",
                color: theme.droite,
                fontWeight: 800,
                fontSize: 34,
                padding: "10px 18px",
                borderRadius: 10,
              }}
            >
              → {visuel.bandeau.toUpperCase()}
            </span>

            {/* Colonnes de blocs */}
            <div style={{ display: "flex", gap: 18, marginTop: 10 }}>
              {visuel.colonnes.map((col, i) => (
                <div
                  key={i}
                  style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}
                >
                  {col.entete && (
                    <Ligne texte={`**${col.entete}**`} />
                  )}
                  {col.blocs.map((b, j) => (
                    <div key={j} style={{ display: "flex", flexDirection: "column" }}>
                      {b.lignes.map((l, k) => (
                        <span key={k} style={{ display: "block" }}>
                          <Ligne texte={l} />
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Bas : prix, prix secondaire, badge, signature */}
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {visuel.colonnes.length === 1 && <BlocPrix prix={visuel.colonnes[0].prix} />}
              {visuel.prix_secondaire && <BlocPrix prix={visuel.prix_secondaire} compact />}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
              {visuel.badge && (
                <span
                  style={{
                    background: "#f5f0e6",
                    color: "#111",
                    borderRadius: 14,
                    padding: "10px 18px",
                    fontSize: 26,
                    fontWeight: 700,
                  }}
                >
                  {visuel.badge.icone.toUpperCase()} {visuel.badge.texte}
                </span>
              )}
              <span
                style={{
                  background: "rgba(40,40,40,.85)",
                  color: "white",
                  borderRadius: 14,
                  padding: "14px 22px",
                  fontSize: 30,
                  fontWeight: 800,
                  letterSpacing: 1,
                }}
              >
                AEROPORT VOYAGE .COM
              </span>
            </div>
          </div>

          {/* Variante double : les deux prix sous leur colonne respective */}
          {visuel.colonnes.length === 2 && (
            <div
              style={{
                position: "absolute",
                left: 28,
                right: 28,
                bottom: 190,
                display: "flex",
                gap: 18,
              }}
            >
              {visuel.colonnes.map((col, i) => (
                <div key={i} style={{ flex: 1 }}>
                  <BlocPrix prix={col.prix} compact />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
