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

**État au 2026-09-13, fin de journée** : **9 invariants, tous verts.** Les deux
rouges du matin sont réparés et prouvés sur le site en ligne.

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

## I-7 — Les moteurs d'analyse se chargent · **VERT** (réparé le 2026-09-13)

- **Mesuré le 2026-09-13** : le paquet servi (`index-Cpqgq4ZS.js`, 6,8 Mo)
  contient encore `.worker-DZte3Qq9.ts` et deux `data:video/mp2t`. Les moteurs
  sont chargés depuis du **TypeScript non compilé**, alors que les fichiers
  compilés existent sur le serveur. Les trois boutons d'analyse échouent.
- **La cause exacte** : trois appels passaient `new URL('…worker.ts',
  import.meta.url)` **en paramètre** à une fonction. Vite ne réécrit cette
  forme que lorsqu'elle est l'argument **direct** de `new Worker(...)`.
  Détachée, elle partait comme ressource brute, servie en `video/mp2t` — le
  type MIME des flux vidéo, que l'extension `.ts` déclenche.
- **Corrigé** : la fonction reçoit une **fabrique**. Les fabriques existaient
  déjà dans `folderScan.ts`, avec un commentaire qui mettait en garde contre
  ce piège précis : l'indirection l'avait contourné.
- **Prouvé en ligne le 2026-09-13**, version `dd431ec` : Ruff en **124 ms avec
  2 constats**, ESLint en **37 ms avec 1 constat**, Prettier en **56 ms**.
  Aucune erreur. Zéro `data:video/mp2t` dans le paquet, contre 2 avant.

---

## I-8 — Un visiteur déjà venu n'est pas piégé sur une version morte · **VERT** (réparé le 2026-09-13)

- **Mesuré** : les paquets de l'ancienne version cités par la revue —
  `/assets/index-BEOgGYsV.js`, `/assets/index-xHyG8ULi.css` — répondent **200
  avec du HTML**. Cloudflare Pages renvoie sa page d'accueil pour toute adresse
  inconnue, à cause du repli d'application monopage.
- **Ce que ça veut dire** : un navigateur qui a gardé l'ancien service worker
  demande un fichier JavaScript, reçoit du HTML, et se retrouve devant une page
  blanche — sans message, sans moyen de comprendre.
- **Corrigé en deux endroits.** Côté navigateur : `registerType: 'autoUpdate'`,
  `cleanupOutdatedCaches`, `clientsClaim`, `skipWaiting`, et une liste
  d'exclusion pour que `/assets/` ne soit jamais servi par la coquille.
  **Vérifié en ligne** : plus aucun service worker en attente, la mise à jour
  prend la main seule.
- **Et côté serveur, ce que je croyais impossible.** J'avais écrit que le repli
  de Cloudflare Pages ne se corrigeait pas depuis le dépôt : **c'était faux**.
  Pages sert une vraie 404 dès qu'il trouve un `404.html` à la racine de la
  sortie. Ajouté, déployé, mesuré.
- **Jamais de rechargement pendant une analyse** : `src/lib/pwa/miseAJour.ts`.
  Un scanner qui efface son propre résultat au moment où il aboutit serait pire
  que le défaut réparé. Dix assertions.

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
  s'est déjà déconnecté de GitHub sans erreur visible.

---

## I-9 — Une adresse inconnue répond 404 · **VERT** (réparé le 2026-09-13)

- **Mesuré après correction** : `/nexistepas`, `/nexistepas.js`,
  `/assets/nexistepas`, `/img/nexistepas.png`, `/sous/dossier/inconnu` — tous
  **404**. Les pages réelles, `/`, `/confidentialite`, `/privacy`, répondent
  toujours 200, avec ou sans extension.
- **La règle « un 200 ne prouve rien sur ce site » est levée.**
- **Mais un piège de mesure la remplace, et il m'a eu.** `_headers` marque
  `/assets/*` comme `immutable, max-age=31536000`. Une sonde lancée **avant**
  la correction voit sa réponse — la coquille HTML en 200 — mise en cache au
  bord **pour un an**. Après correction, ce chemin précis répondait encore 200
  alors que tout le reste répondait 404. J'ai cru à une correction incomplète.
  **Un chemin jamais demandé, ou la même adresse avec un paramètre quelconque,
  répond bien 404.** Sonder un site sous cache immuable empoisonne sa propre
  mesure : toujours ajouter un paramètre unique.
