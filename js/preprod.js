/**
 * Fonctions en préproduction : visibles seulement sur l'ordinateur de test
 * (adresse locale 127.0.0.1 ou localhost) avec ?preprod=1 dans l'adresse.
 * Sur le site en ligne, elles restent cachées, même avec ?preprod=1.
 */
const local = typeof location !== "undefined" && ["127.0.0.1", "localhost"].includes(location.hostname);
export const PREPROD = local && new URLSearchParams(location.search).get("preprod") === "1";
