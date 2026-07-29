import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link href="/offres" className="font-semibold">
          Machine Marketing
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">{user.email}</span>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Déconnexion
            </Button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
