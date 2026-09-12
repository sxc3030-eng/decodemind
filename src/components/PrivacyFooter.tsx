/**
 * Lien vers la politique de confidentialité, en pied de page.
 *
 * La Loi 25 demande que la politique soit accessible « en termes simples et
 * clairs » depuis le site : une page qui existe mais que rien ne pointe ne
 * remplit pas cette exigence. Le lien reste discret — l'outil, lui, ne
 * recueille rien, et la page le dit.
 *
 * La langue suit celle du navigateur : français par défaut au Québec, anglais
 * pour le reste. Ce sont deux fichiers statiques de `public/`, pas des routes
 * de l'application.
 */
export function PrivacyFooter() {
  const enFrancais =
    typeof navigator !== 'undefined' &&
    (navigator.language || '').toLowerCase().startsWith('fr');
  const lien = enFrancais ? '/confidentialite.html' : '/privacy.html';
  const libelle = enFrancais ? 'Confidentialité' : 'Privacy';
  const promesse = enFrancais
    ? 'Votre code ne quitte pas ce navigateur.'
    : 'Your code never leaves this browser.';

  return (
    <footer className="mt-10 border-t border-slate-200 px-4 py-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
      <span>{promesse}</span>{' '}
      <a
        className="underline underline-offset-2 hover:text-blue-600 dark:hover:text-blue-400"
        href={lien}
      >
        {libelle}
      </a>
    </footer>
  );
}
