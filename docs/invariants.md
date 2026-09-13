# DecodeMind — invariants

*Blindage du 2026-09-13, selon `E:\d sauvegarde\procedures\00-METHODE-BLINDAGE.md`.*

**Périmètre décidé** : on blinde **ce qui est en ligne aujourd'hui**, tel quel.
Le 2026-09-06, Simon a confirmé que decodemind.dev sert volontairement le
harnais de test — un MVP brut assumé — avec la consigne de ne pas le remplacer
sans demande explicite. Construire le produit n'est donc pas dans ce passage.

Les invariants sont écrits du point de vue de celui qui subit le programme :
un développeur qui dépose son code chez un outil en ligne et à qui on promet
que ce code ne sortira pas.

**Comment rejouer les mesures**

```
curl -sI https://decodemind.dev/                      # en-têtes servis
curl -s https://decodemind.dev/assets/index-*.js      # origines du paquet
# puis, dans le navigateur, sur la page ouverte :
#   read_network_requests   → ce qui part vraiment
#   navigate /confidentialite → la politique, service worker actif
```

**État au 2026-09-13** : **6 invariants verts, 2 rouges**. Les deux rouges sont
connus, mesurés, et volontairement non réparés — ils relèvent du produit, pas
de la sûreté.

---

## I-1 — Rien ne part vers un tiers au chargement, sauf le bandeau d'annonces · **VERT**

- **Mesuré au navigateur** : au chargement de decodemind.dev, **quatre requêtes
  seulement**, toutes vers `decodemind.dev` — la page, le paquet JavaScript, la
  feuille de style, l'enregistrement du service worker.
- **Le bandeau d'annonces est bien une sortie vers un tiers** : ses images
  viennent de `sxc3030-eng.github.io/omnipost-rss/images/…`. Elles n'apparaissent
  pas dans la capture réseau parce que le service worker les sert depuis son
  cache — d'où l'importance de regarder le DOM et pas seulement le réseau. Un
  visiteur neuf, lui, les télécharge, et GitHub voit son adresse IP.
- **C'est déclaré** : la politique publiée dit que le bandeau est chargé à
  chaque visite. La promesse et le comportement se rejoignent.
- **Les autres origines citées dans le paquet** — `huggingface.co` pour le
  modèle, `raw.githubusercontent.com` pour une bibliothèque WASM — ne sont
  jointes qu'après un clic explicite sur « Load model ».

---

## I-2 — Le code analysé ne quitte jamais le navigateur · **VERT**, avec une limite déclarée

C'est la promesse centrale du produit. Tout le reste peut être imparfait ;
celle-là ne peut pas céder.

- **Au niveau du code** : la revue du 2026-09-12 a cherché tous les `fetch`,
  `XMLHttpRequest`, `WebSocket`, `sendBeacon`, imports distants, polices et
  images tierces. Aucun ne reçoit le contenu analysé.
- **Au niveau du réseau, au repos** : quatre requêtes, toutes vers le site
  lui-même. Aucun mouchard.
- **Ce que je n'ai pas pu prouver** : je n'ai pas analysé un vrai dossier de
  code. Le faire demande l'API d'accès aux fichiers, donc un vrai dossier et un
  vrai clic. **La preuve définitive reste à faire** : ouvrir le site, analyser
  un dossier jetable, et regarder le réseau pendant l'analyse. C'est un geste
  de trente secondes pour Simon, et c'est la seule vérification qui ferme
  vraiment cet invariant.

---

## I-3 — La politique de confidentialité est atteignable · **VERT** — *corrige la revue*

- **Mesuré au navigateur, service worker actif** : `/confidentialite` affiche
  bien « Politique de confidentialité », 3 626 caractères, avec le responsable
  nommé et son adresse.
- **La revue du 2026-09-12 affirmait le contraire** : elle disait la politique
  inatteignable, `/privacy` affichant le banc d'essai à cause du service
  worker. **Ce n'est pas vrai aujourd'hui.** Soit la mise en production de la
  politique l'a corrigé depuis, soit le relecteur avait un service worker plus
  ancien. Dans les deux cas, la vérification directe l'emporte sur le rapport.
- Le serveur sert aussi les deux pages correctement : 7 261 octets pour
  `/confidentialite`, 6 756 pour `/privacy`.

---

## I-4 — La politique dit la vérité · **VERT** — *corrige la revue*

- **Le nom légal est à jour** : « Archipel AI », sans « Ventures », vérifié
  dans la page rendue.
- **Le responsable est joignable** : `archipel.clients@outlook.com`, dont le
  domaine a bien un serveur de courrier — contrairement à tous les domaines
  d'Archipel eux-mêmes.
- **Il n'y a aucun mouchard, et la politique a raison de le dire.** La revue
  affirmait que la page charge Cloudflare Web Analytics. **Vérifié : faux.**
  Le HTML servi ne contient ni `beacon.min.js` ni `cloudflareinsights`. La
  politique promettait « pas de statistiques de fréquentation, pas de
  mouchard » : elle est exacte.

---

## I-5 — Les en-têtes d'isolement sont servis · **VERT**

Sans eux, `SharedArrayBuffer` est indisponible et le moteur WASM ne peut pas
travailler en mémoire partagée.

- **Mesuré** : `cross-origin-embedder-policy: require-corp`,
  `cross-origin-opener-policy: same-origin`,
  `permissions-policy: interest-cohort=()`,
  `referrer-policy: strict-origin-when-cross-origin`.
- **Le piège qui va avec** : sous `require-corp`, **toute image d'origine
  tierce sans `crossOrigin="anonymous"` est bloquée sans le moindre message**.
  C'est le genre de panne qu'on met une heure à comprendre. À savoir avant de
  toucher au bandeau d'annonces.
- **Ce qui manque** : aucune `Content-Security-Policy` n'est servie. Relevé,
  non corrigé — c'est un ajout de sûreté qui demande d'inventorier ce que la
  page charge, donc un vrai chantier.

---

## I-6 — Aucun secret réel dans le dépôt public · **VERT**

- Le dépôt `sxc3030-eng/decodemind` est **public**.
- **Mesuré** : quatre fichiers contiennent des chaînes en forme de clé
  (`sk-…`, `ghp_…`). **Tous les quatre sont dans `tests/fixtures/`** : ce sont
  de faux secrets servant d'entrée au scanner, ce qui est exactement leur
  raison d'être. Aucun secret réel.
- `docs/POST_LAUNCH_CHECKLIST.md` cite un chemin de serveur (`/srv/omnipost/`).
  C'est mince, mais ça n'a rien à faire dans un dépôt public : à retirer au
  prochain passage.

---

## I-7 — Les moteurs d'analyse se chargent · **ROUGE**, non réparé volontairement

- **Mesuré le 2026-09-13** : le paquet servi (`index-Cpqgq4ZS.js`, 6,8 Mo)
  contient encore `.worker-DZte3Qq9.ts` et deux `data:video/mp2t`. Les moteurs
  sont chargés depuis du **TypeScript non compilé**, alors que les fichiers
  compilés existent sur le serveur. Les trois boutons d'analyse échouent.
- **Non réparé sur décision** : le site sert volontairement le harnais, et
  réparer les moteurs revient à livrer le produit — ce que personne n'a
  demandé. Consigné ici pour que ce ne soit pas redécouvert une troisième fois.
- **Recommandation quand Simon voudra y aller** : corriger la configuration de
  construction pour que les travailleurs pointent vers les `.js` compilés. Les
  fichiers sont déjà là ; c'est un problème de chemin, pas de code.

---

## I-8 — Un visiteur déjà venu n'est pas piégé sur une version morte · **ROUGE**

- **Mesuré** : les paquets de l'ancienne version cités par la revue —
  `/assets/index-BEOgGYsV.js`, `/assets/index-xHyG8ULi.css` — répondent **200
  avec du HTML**. Cloudflare Pages renvoie sa page d'accueil pour toute adresse
  inconnue, à cause du repli d'application monopage.
- **Ce que ça veut dire** : un navigateur qui a gardé l'ancien service worker
  demande un fichier JavaScript, reçoit du HTML, et se retrouve devant une page
  blanche — sans message, sans moyen de comprendre.
- **Un 200 ne prouve donc rien sur ce site.** Pour vérifier qu'une version est
  bien déployée, comparer l'empreinte du paquet `/assets/index-*.js`, jamais le
  code de réponse.
- **Non réparé** : la correction est un mécanisme de mise à jour du service
  worker, qui touche au comportement du produit. À faire avec le reste.

---

## Ce qui n'a pas été vérifié

- **Aucune analyse d'un vrai dossier de code** : c'est la limite de I-2, et la
  seule façon de la lever est un essai manuel de trente secondes.
- **Aucun téléchargement du modèle d'IA** : 840 Mo à 4,1 Go selon le palier,
  et rien ne prouve d'ici que l'annonce de la taille précède le téléchargement.
- **Rien n'a été écrit sur le disque d'un utilisateur** : le comportement de
  « Apply fix » et de ses copies de sauvegarde reste non vérifié.
- **Deux pièges d'infrastructure à ne pas oublier** : la branche de production
  du projet Cloudflare Pages a déjà été `v1` plutôt que `master`, et le projet
  s'est déjà déconnecté de GitHub sans erreur visible. Un déploiement qui
  « ne prend pas » se vérifie par l'empreinte du paquet, pas par un 200.
