/**
 * Mise à jour du service worker, sans piéger personne.
 *
 * Le défaut réparé le 2026-09-13 : le service worker était réglé sur
 * `registerType: 'prompt'` et aucune interface n'existait pour poser la
 * question. Le nouveau restait donc « en attente » indéfiniment. Un visiteur
 * déjà venu continuait de demander les anciens noms de fichiers ;
 * Cloudflare Pages répond la coquille de l'application — du HTML, code 200 —
 * pour toute adresse inconnue. Le navigateur recevait du HTML là où il
 * attendait du JavaScript : page blanche, sans message, **et sans recours**
 * puisqu'on ne peut pas cliquer sur une invitation à recharger.
 *
 * On met donc à jour tout seul. Mais pas n'importe quand : recharger la page
 * pendant qu'une analyse tourne ferait perdre à quelqu'un le travail qu'il
 * attendait. Un scanner qui efface son propre résultat au moment où il
 * aboutit est pire que le défaut qu'on répare.
 */

let analyseEnCours = false;
let rechargementEnAttente = false;

/**
 * À appeler au début et à la fin d'une analyse.
 *
 * Tant qu'une analyse tourne, aucune mise à jour ne recharge la page. Si une
 * mise à jour s'est présentée pendant ce temps, elle s'applique dès la fin.
 */
export function marquerAnalyse(enCours: boolean): void {
  analyseEnCours = enCours;
  if (!enCours && rechargementEnAttente) {
    rechargementEnAttente = false;
    recharger();
  }
}

export function uneAnalyseTourne(): boolean {
  return analyseEnCours;
}

function recharger(): void {
  // `location.reload()` suffit : le nouveau service worker a déjà pris la
  // main, la page revient sur la version fraîche.
  window.location.reload();
}

/**
 * Demande le rechargement. Il part tout de suite si rien ne tourne, et
 * attend sagement la fin de l'analyse sinon.
 */
export function demanderRechargement(): void {
  if (analyseEnCours) {
    rechargementEnAttente = true;
    return;
  }
  recharger();
}

/**
 * Branche la mise à jour automatique du service worker.
 *
 * Retourne une fonction d'arrêt, utile aux tests.
 */
export function installerMiseAJour(): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {};
  }

  let arrete = false;

  const surChangement = () => {
    if (arrete) return;
    demanderRechargement();
  };

  navigator.serviceWorker.addEventListener('controllerchange', surChangement);

  return () => {
    arrete = true;
    navigator.serviceWorker.removeEventListener('controllerchange', surChangement);
  };
}
