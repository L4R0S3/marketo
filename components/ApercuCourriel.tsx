"use client";

// Aperçu du HTML courriel, isolé dans une iframe : le CSS d'un courriel n'a rien
// à faire dans la page d'administration, et réciproquement. srcDoc évite d'avoir
// à servir le HTML depuis une route.

export function ApercuCourriel({
  html,
  hauteur = 640,
}: {
  html: string;
  hauteur?: number;
}) {
  return (
    <iframe
      srcDoc={html}
      title="Aperçu du courriel"
      sandbox=""
      className="w-full rounded-md border bg-white"
      style={{ height: hauteur }}
    />
  );
}
