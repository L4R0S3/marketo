import { parseGras } from "./parseGras";
import { GEOMETRIE } from "./themes";
import type { PostVisuelT } from "./schema";

// Gabarit du post social 1080 × 1350, rendu par Satori (next/og).
//
// TROIS COUCHES, dans cet ordre :
//   1. la photo hero, en absolu, object-fit cover sur tout le format
//   2. le FRAME PNG du thème, en absolu, par-dessus la photo
//   3. le texte
//
// Le frame porte déjà le cadre, le dégradé, le voile et le bloc signature : rien
// de tout cela n'est reconstruit ici. Ce composant ne fait plus que placer du
// texte dans les zones libres, dont les limites viennent de GEOMETRIE (mesurées
// sur le canal alpha des PNG) :
//   • le titre se pose sur le bandeau opaque du haut (0 → 211) ;
//   • le reste vit dans la fenêtre transparente, donc sur la photo ;
//   • en bas, le prix reste à gauche de la signature (x < 560).
//
// Contraintes Satori (CLAUDE.md §7) : flexbox uniquement, `display: flex`
// explicite sur chaque conteneur, pas de grid, pas de float.

export const LARGEUR = GEOMETRIE.largeur;
export const HAUTEUR = GEOMETRIE.hauteur;

const BLANC = "#ffffff";
const ENCRE = "#141414";
const MARGE = 56; // marge du texte, à l'intérieur du cadre du frame

// Satori ne mesure pas le texte avant le rendu : une chaîne trop longue passerait
// à la ligne alors que le gabarit exige UNE ligne (titre, bandeau). On dimensionne
// donc d'après la longueur, avec l'avance moyenne mesurée sur les rendus réels —
// 0,44 em pour Anton, 0,56 em pour Raleway 700 en majuscules.
function tailleQuiTient(texte: string, largeur: number, avance: number, max: number) {
  const n = Math.max(texte.length, 1);
  return Math.max(18, Math.min(max, Math.floor(largeur / (avance * n))));
}

// Une ligne de bloc : pastille blanche épousant la largeur du texte. Les segments
// en gras sont posés côte à côte — chaque ligne est écrite pour tenir sur une
// ligne, il n'y a donc jamais de retour automatique à gérer.
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
          fontSize: compact ? 82 : 140,
          lineHeight: 1,
          color: BLANC,
          textShadow: "0 6px 18px rgba(0,0,0,.6)",
          transform: "skewX(-12deg)",
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

function Colonne({
  colonne,
  double,
}: {
  colonne: PostVisuelT["colonnes"][number];
  double: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: "flex-start" }}>
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

export function Gabarit({ visuel, frame }: { visuel: PostVisuelT; frame: string }) {
  const double = visuel.colonnes.length === 2;
  const position =
    visuel.photo.focale === "haut" ? "top" : visuel.photo.focale === "bas" ? "bottom" : "center";

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: LARGEUR,
        height: HAUTEUR,
        backgroundColor: "#2b3440",
      }}
    >
      {/* Couche 1 — la photo. Ces <img> ne sont pas du DOM : Satori les lit pour
          composer une image, next/image n'a rien à y faire. */}
      {visuel.photo.url && (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img
          src={visuel.photo.url}
          width={LARGEUR}
          height={HAUTEUR}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: LARGEUR,
            height: HAUTEUR,
            objectFit: "cover",
            objectPosition: position,
          }}
        />
      )}

      {/* Couche 2 — le frame : cadre, dégradé, voile et signature */}
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img
        src={frame}
        width={LARGEUR}
        height={HAUTEUR}
        style={{ position: "absolute", top: 0, left: 0, width: LARGEUR, height: HAUTEUR }}
      />

      {/* Couche 3 — le texte */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          display: "flex",
          flexDirection: "column",
          width: LARGEUR,
          height: HAUTEUR,
        }}
      >
        {/* Titre, sur le bandeau opaque du frame */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: GEOMETRIE.bandeauHaut,
            paddingLeft: MARGE,
            paddingRight: MARGE,
          }}
        >
          <span
            style={{
              fontFamily: "Anton",
              fontSize: tailleQuiTient(visuel.titre, LARGEUR - 2 * MARGE - 20, 0.44, 92),
              lineHeight: 1.05,
              color: BLANC,
              textShadow: "0 6px 18px rgba(0,0,0,.45)",
              transform: "skewX(-12deg)",
            }}
          >
            {visuel.titre}
          </span>
        </div>

        {/* Bandeau et blocs, dans la fenêtre transparente */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            paddingLeft: MARGE,
            paddingRight: MARGE,
            paddingTop: 18,
          }}
        >
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
            <span style={{ fontFamily: "Anton", fontSize: 38, color: ENCRE, marginRight: 14 }}>
              →
            </span>
            <span
              style={{
                fontFamily: "Raleway",
                fontWeight: 700,
                fontSize: tailleQuiTient(visuel.bandeau, 830, 0.56, 34),
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

        {/* Bas : prix à gauche de la signature, badge au-dessus d'elle */}
        <div
          style={{
            position: "absolute",
            left: MARGE,
            bottom: 46,
            display: "flex",
            flexDirection: "column",
            width: GEOMETRIE.signatureX - MARGE - 20,
          }}
        >
          {double ? (
            <div style={{ display: "flex", flexDirection: "row", gap: 28 }}>
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

        {visuel.badge && (
          <div
            style={{
              position: "absolute",
              right: MARGE,
              bottom: 150,
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              background: "#f3ecdd",
              borderRadius: 20,
              padding: "12px 22px",
            }}
          >
            <span style={{ fontFamily: "Anton", fontSize: 34, color: ENCRE, marginRight: 12 }}>
              {visuel.badge.icone.toUpperCase()}
            </span>
            <span style={{ fontFamily: "Raleway", fontWeight: 700, fontSize: 24, color: ENCRE }}>
              {visuel.badge.texte}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
