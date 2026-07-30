import { Megaphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// Les campagnes courriel arrivent en phase 5. La page existe pour que la
// navigation ne mène pas dans le vide.

export default function CampagnesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Campagnes</h1>
        <p className="text-sm text-muted-foreground">
          Un envoi Mailchimp regroupe plusieurs offres et en désigne une vedette.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Megaphone className="size-6 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-medium">Bientôt disponible</p>
            <p className="text-sm text-muted-foreground">
              La composition des campagnes courriel arrive à la phase suivante.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
