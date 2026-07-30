import { parseGras } from "./parseGras";
import { THEMES } from "./themes";
import type { PostVisuelT } from "./schema";

// Gabarit du post social 1080 × 1350, rendu par Satori (next/og).
//
// Contraintes Satori (CLAUDE.md §7) : flexbox UNIQUEMENT, `display: flex` explicite
// sur chaque conteneur, pas de grid, pas de float, pas de box-decoration-break.
// Les dégradés linéaires passent. Les images doivent être des URL absolues.
//
// Deux familles : Anton (titre, montants) et Raleway 400/700 (tout le reste, la
// graisse 700 portant le gras partiel **segment**).
//
// Chaque LIGNE d'un bloc est sa propre pastille blanche : c'est ce qui reproduit
// le box-decoration-break: clone de l'original, que Satori ne supporte pas.

export const LARGEUR = 1080;
export const HAUTEUR = 1350;

const BLANC = "#ffffff";
const ENCRE = "#141414";

// Satori ne mesure pas le texte avant le rendu : une chaîne trop longue passe à la
// ligne alors que le gabarit exige UNE ligne (titre, bandeau). On dimensionne donc
// la police d'après la longueur, avec la largeur d'avance moyenne mesurée sur les
// rendus réels — 0,44 em pour Anton, 0,56 em pour Raleway 700 en majuscules.
function tailleQuiTient(texte: string, largeur: number, avance: number, max: number) {
  const n = Math.max(texte.length, 1);
  return Math.max(18, Math.min(max, Math.floor(largeur / (avance * n))));
}

// Une ligne de bloc : pastille blanche épousant la largeur du texte. Les segments
// en gras sont posés côte à côte en flex-row — chaque ligne est écrite pour tenir
// sur une ligne, il n'y a donc jamais de retour automatique à gérer.
function LignePastille({ texte, taille }: { texte: string; taille: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignSelf: "flex-start",
        alignItems: "baseline",
        background: BLANC,
        borderRadius: 12,
        padding: "8px 18px",
        marginBottom: 8,
        maxWidth: "100%",
      }}
    >
      {parseGras(texte).map((s, i) => (
        <span
          key={i}
          style={{
            fontFamily: "Raleway",
            fontWeight: s.gras ? 700 : 400,
            fontSize: taille,
            color: ENCRE,
            whiteSpace: "pre",
          }}
        >
          {s.texte}
        </span>
      ))}
    </div>
  );
}

function BlocPrix({
  prix,
  compact,
  supplement,
}: {
  prix: NonNullable<PostVisuelT["prix_secondaire"]>;
  compact?: boolean;
  // Un supplément s'écrit « +$504 » ; un prix d'offre ne porte jamais le plus.
  supplement?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span
        style={{
          fontFamily: "Raleway",
          fontSize: compact ? 26 : 30,
          color: BLANC,
          textShadow: "0 3px 10px rgba(0,0,0,.65)",
        }}
      >
        {prix.surtitre}
      </span>
      <span
        style={{
          fontFamily: "Anton",
          fontSize: compact ? 86 : 158,
          lineHeight: 1,
          color: BLANC,
          textShadow: "0 6px 18px rgba(0,0,0,.6)",
        }}
      >
        {supplement ? "+" : ""}${prix.montant}
      </span>
      {prix.mentions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
          {prix.mentions.map((m, i) => (
            <span
              key={i}
              style={{
                fontFamily: "Raleway",
                fontSize: 24,
                color: BLANC,
                textShadow: "0 3px 10px rgba(0,0,0,.65)",
              }}
            >
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Colonne({ colonne, double }: { colonne: PostVisuelT["colonnes"][number]; double: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        alignItems: double ? "flex-start" : "flex-start",
      }}
    >
      {colonne.entete && <LignePastille texte={`**${colonne.entete}**`} taille={double ? 28 : 30} />}
      {colonne.blocs.map((b, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", marginBottom: 10 }}>
          {b.lignes.map((l, j) => (
            <LignePastille key={j} texte={l} taille={double ? 27 : 30} />
          ))}
        </div>
      ))}
    </div>
  );
}

// Signature : ne pas la reconstruire finement en CSS (CLAUDE.md §7 recommande un
// SVG exporté par thème). En attendant ces fichiers, un bloc typographique sobre.
function Signature() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        background: "rgba(20,20,20,.82)",
        borderRadius: 18,
        padding: "16px 26px",
      }}
    >
      <span style={{ fontFamily: "Anton", fontSize: 38, color: BLANC, letterSpacing: 1 }}>
        AEROPORTVOYAGE.COM
      </span>
      <span style={{ fontFamily: "Raleway", fontSize: 21, color: "#e8e8e8" }}>
        info@aeroportvoyage.com | 514-289-8686
      </span>
    </div>
  );
}

export function Gabarit({ visuel }: { visuel: PostVisuelT }) {
  const theme = THEMES[visuel.theme];
  const double = visuel.colonnes.length === 2;
  const position =
    visuel.photo.focale === "haut" ? "top" : visuel.photo.focale === "bas" ? "bottom" : "center";

  return (
    <div
      style={{
        width: LARGEUR,
        height: HAUTEUR,
        display: "flex",
        padding: 14,
        background: `linear-gradient(90deg, ${theme.gauche}, ${theme.droite})`,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flex: 1,
          padding: 36,
          backgroundColor: "#2b3440",
          ...(visuel.photo.url
            ? {
                backgroundImage: `url(${visuel.photo.url})`,
                backgroundSize: "cover",
                backgroundPosition: position,
              }
            : {}),
        }}
      >
        {/* Voile : sans lui, un titre blanc sur photo claire devient illisible.
            Opaque à 60 % en haut, transparent au tiers de la hauteur. Posé avant
            le contenu, donc dessous — Satori empile dans l'ordre du DOM. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 620,
            display: "flex",
            background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)",
          }}
        />

        {/* Haut : titre, bandeau, blocs */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Anton n'a pas d'italique et Satori n'en synthétise pas : l'inclinaison
              du gabarit d'origine est obtenue par une déformation. */}
          <span
            style={{
              fontFamily: "Anton",
              fontSize: tailleQuiTient(visuel.titre, 980, 0.44, 96),
              lineHeight: 1.05,
              color: BLANC,
              textShadow: "0 8px 22px rgba(0,0,0,.55)",
              marginBottom: 16,
              transform: "skewX(-12deg)",
            }}
          >
            {visuel.titre}
          </span>

          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-start",
              background: BLANC,
              borderRadius: 12,
              padding: "12px 22px",
              marginBottom: 22,
            }}
          >
            <span
              style={{
                fontFamily: "Anton",
                fontSize: 38,
                color: theme.droite,
                marginRight: 14,
              }}
            >
              →
            </span>
            <span
              style={{
                fontFamily: "Raleway",
                fontWeight: 700,
                fontSize: tailleQuiTient(visuel.bandeau, 870, 0.56, 34),
                color: ENCRE,
              }}
            >
              {visuel.bandeau.toUpperCase()}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "row", gap: 20 }}>
            {visuel.colonnes.map((c, i) => (
              <Colonne key={i} colonne={c} double={double} />
            ))}
          </div>
        </div>

        {/* Bas : prix, badge, signature */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
          }}
        >
          {/* Prix en colonne : les prix de formules sur une rangée, le supplément
              dessous. En rangée unique, la variante double débordait à droite. */}
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            {double ? (
              <div style={{ display: "flex", flexDirection: "row", gap: 32 }}>
                {visuel.colonnes.map((c, i) => (
                  <BlocPrix key={i} prix={c.prix} compact />
                ))}
              </div>
            ) : (
              <BlocPrix prix={visuel.colonnes[0].prix} />
            )}
            {visuel.prix_secondaire && (
              <div style={{ display: "flex", marginTop: 14 }}>
                <BlocPrix prix={visuel.prix_secondaire} compact supplement />
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              flexShrink: 0,
              marginLeft: 24,
            }}
          >
            {visuel.badge && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  background: "#f3ecdd",
                  borderRadius: 20,
                  padding: "12px 22px",
                  marginBottom: 14,
                }}
              >
                <span
                  style={{
                    fontFamily: "Anton",
                    fontSize: 34,
                    color: theme.droite,
                    marginRight: 12,
                  }}
                >
                  {visuel.badge.icone.toUpperCase()}
                </span>
                <span style={{ fontFamily: "Raleway", fontWeight: 700, fontSize: 24, color: ENCRE }}>
                  {visuel.badge.texte}
                </span>
              </div>
            )}
            <Signature />
          </div>
        </div>
      </div>
    </div>
  );
}
