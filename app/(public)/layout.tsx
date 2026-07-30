import Link from "next/link";
import { Phone } from "lucide-react";
import { AGENCE, COURRIEL, MARQUE, TELEPHONE } from "@/lib/marque";

// Enveloppe des pages publiques. Rien de l'admin ici : le visiteur arrive d'un
// post ou d'un courriel, il ne se connecte pas.

export default function LayoutPublic({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            AÉROPORT<span className="font-normal"> VOYAGE</span>
          </Link>
          <a
            href={`tel:${TELEPHONE}`}
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: MARQUE }}
          >
            <Phone className="size-4" />
            {TELEPHONE}
          </a>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t bg-muted/30">
        <div className="mx-auto flex max-w-3xl flex-col gap-1 px-4 py-8 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{AGENCE}</p>
          <p>
            <a href={`tel:${TELEPHONE}`} className="hover:underline">
              {TELEPHONE}
            </a>{" "}
            ·{" "}
            <a href={`mailto:${COURRIEL}`} className="hover:underline">
              {COURRIEL}
            </a>
          </p>
          <p className="text-xs">
            Les prix affichés sont par personne, en dollars canadiens, et peuvent changer
            sans préavis. Aucune réservation ne se fait sur ce site.
          </p>
        </div>
      </footer>
    </div>
  );
}
