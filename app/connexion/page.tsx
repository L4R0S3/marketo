"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ConnexionPage() {
  const router = useRouter();
  const [courriel, setCourriel] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: courriel,
      password: motDePasse,
    });

    if (error) {
      setErreur("Courriel ou mot de passe invalide.");
      setEnCours(false);
      return;
    }

    router.push("/offres");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Machine Marketing</CardTitle>
          <CardDescription>Aéroport Voyage — accès interne</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="courriel">Courriel</Label>
              <Input
                id="courriel"
                type="email"
                autoComplete="email"
                required
                value={courriel}
                onChange={(e) => setCourriel(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mot-de-passe">Mot de passe</Label>
              <Input
                id="mot-de-passe"
                type="password"
                autoComplete="current-password"
                required
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
              />
            </div>
            {erreur && <p className="text-sm text-red-600">{erreur}</p>}
            <Button type="submit" disabled={enCours}>
              {enCours ? "Connexion…" : "Se connecter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
