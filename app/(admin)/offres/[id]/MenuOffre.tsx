"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { supprimerOffre } from "@/app/(admin)/offres/actions";
import { repasserEnBrouillon } from "./actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Actions rares et dangereuses, repliées : elles ne prennent pas de place en
// pleine page et la suppression passe par une confirmation explicite.

export function MenuOffre({ offreId, statut }: { offreId: string; statut: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [confirmation, setConfirmation] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Actions de l'offre">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={statut !== "validee" || enCours}
            onSelect={() =>
              demarrer(async () => {
                await repasserEnBrouillon(offreId);
                router.refresh();
              })
            }
          >
            Repasser en brouillon
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={statut !== "brouillon"}
            onSelect={(e) => {
              e.preventDefault();
              setConfirmation(true);
            }}
          >
            Supprimer le brouillon
          </DropdownMenuItem>
          {statut !== "brouillon" && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              Seul un brouillon peut être supprimé.
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmation} onOpenChange={setConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce brouillon ?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;offre, son document source et ses photos sont supprimés définitivement.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => formRef.current?.requestSubmit()}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* L'action serveur redirige vers la liste ; le formulaire reste caché. */}
      <form ref={formRef} action={supprimerOffre} className="hidden">
        <input type="hidden" name="offreId" value={offreId} />
      </form>
    </>
  );
}
