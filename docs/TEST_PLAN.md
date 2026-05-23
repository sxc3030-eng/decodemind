# DecodeMind — Plan de test perso

> Tu as beaucoup de projets sur D:\. Plutôt que tout scanner d'un coup, suis ce plan : **3 projets critiques** (l'essentiel) + **5 projets secondaires** (pour repérer les bugs DecodeMind) + **1 stress test**. Total : 9 scans, ~15 min chacun = 2-3 heures réparties sur autant de jours que tu veux.

## Avant chaque scan — checklist 30 secondes

- [ ] Le projet est en git, **`git status` est clean** (sinon DecodeMind peut écrire des fix sur du code non commité que tu n'as pas validé)
- [ ] OU : tu as fait un backup manuel du dossier
- [ ] DevTools Console ouverte (F12) pour attraper les erreurs silencieuses
- [ ] Tu as **`npm run dev`** qui tourne, ou tu as ouvert `start.bat`

---

## Tier 1 — Tes projets actifs (priorité absolue)

Ce sont tes vrais projets en production. Si DecodeMind trouve une vraie vuln ou plante chez eux, **c'est l'info la plus précieuse**.

### Test 1.1 — NetGuardPro

`D:\NetGuardPro\` (le principal, pas les variantes -iOS/-Linux/-Store etc.)

**À enregistrer après le scan** :
- [ ] Nombre total de findings : `____`
- [ ] Sécurité 🔒 : `____` (le plus important — tu as fait un audit 5 phases dessus, donc on attend peu de findings nouveaux)
- [ ] Bugs 🐛 : `____`
- [ ] Logique 🧠 : `____`
- [ ] Qualité ✨ : `____`
- [ ] Noise score : `____%`
- [ ] Durée du scan : `____`s
- [ ] **Plus important : DecodeMind a-t-il trouvé une vuln que ton audit avait ratée ?** Oui / Non / Lesquelles
- [ ] **Faux positifs notables (rule X sur fichier Y)** :

### Test 1.2 — GeniA

`D:\GeniA\` (pas les backups -20260403 etc.)

**À enregistrer** :
- Mêmes colonnes que Test 1.1
- [ ] **As-tu pu appliquer au moins 2 fix sans rien casser ?** Oui / Non
- [ ] **Vérification post-fix** : `npm test` dans GeniA passe encore ? Oui / Non / Pas applicable

### Test 1.3 — 1 projet de ton choix qui tourne en prod

(par exemple omnipost, Optimus, ou un dossier de mamy)

**À enregistrer** : idem que 1.1

---

## Tier 2 — Stress test de DecodeMind (cherche les bugs DecodeMind, pas les bugs du code)

Le but ici n'est pas de réparer ces projets, c'est de **vérifier que DecodeMind ne plante pas / pas trop de faux positifs / gère bien différents stacks**.

### Test 2.1 — Projet purement Python

`D:\ComfyUI-Intel\` ou `D:\stable-diffusion-webui\` (ML / Python lourd, beaucoup de imports)

**À enregistrer** :
- [ ] DecodeMind a-t-il fini sans crasher ? Oui / Non
- [ ] Combien de fichiers ignorés (auto-generated + vendored) ? Le warning doit l'indiquer.
- [ ] **Faux positifs détectés** : Quelles règles tirent à blanc le plus souvent ?

### Test 2.2 — Projet purement JavaScript/TypeScript (Node ou React)

`D:\genia-grid\` ou `D:\genia-node\`

**À enregistrer** :
- [ ] Toujours des `'require' is not defined` ? (Notre fix CommonJS auto-detect doit les avoir tués)
- [ ] ESLint trouve-t-il du sens, ou trop de bruit ?

### Test 2.3 — Projet "à risque" (du code Claude / GPT brut sans review)

Un dossier où tu sais que tu as collé du code généré par une IA sans le relire.

**À enregistrer** :
- [ ] DecodeMind a-t-il trouvé des hallucinations (`llm-fake-*`) ? Lesquelles ?
- [ ] Des findings tirés par les rules custom (ws-auth, crypto, injection, xss) ?

### Test 2.4 — Petit projet (< 50 fichiers)

`D:\klara\` ou `D:\la-grotte\`

**À enregistrer** :
- [ ] Temps de scan total : `____`s (devrait être < 5s)
- [ ] Tout marche bien ?

### Test 2.5 — Projet HTML/CSS-heavy

`D:\netguard-pro-pages\` ou `D:\netguard-pro-showcase\`

**À enregistrer** :
- [ ] Prettier détecte-t-il les pbs de format ?
- [ ] Y a-t-il des XSS findings sur les .html ? (Si tu utilises `innerHTML` quelque part)

---

## Tier 3 — Le stress test ultime

### Test 3.1 — Le plus gros projet que tu as

`D:\Optimus\` ou `D:\NetGuardPro\` complet (pas qu'un sous-dossier)

**À enregistrer** :
- [ ] Le warning "Folder has X files, scanning first 500" est-il apparu ?
- [ ] Tout a-t-il fini en moins de 5 min ? Oui / Non
- [ ] DevTools Memory : usage RAM au pic ? (Pas critique mais info utile)
- [ ] **Y a-t-il un timeout / crash quelque part ?**

---

## Pendant et après — comment réagir

| Ce que tu vois | Quoi faire |
|---|---|
| Scan finit sans rien d'intéressant | Note "rien à signaler" et passe au suivant |
| Vraie vuln détectée | **Note la ligne + fix la manuellement ou avec Apply.** C'est la vraie valeur du tool. |
| ErrorBoundary apparaît (carte rouge) | Copier la stack trace dans `docs/TEST_BUGS.md` (créer si besoin) |
| Faux positif | Note `<rule>` + `<fichier>` + pourquoi tu penses que c'est faux dans `docs/TEST_BUGS.md` |
| Scan prend > 5 min ou freeze | Tu peux fermer l'onglet — ça ne casse rien (rien n'a été écrit sur disque tant que tu n'as pas cliqué Apply) |

## Format du log (à coller dans TEST_BUGS.md ou directement dans cette section)

Pour chaque test, juste 4 lignes :

```
### Test X.Y — <nom projet>
Scan : N findings (Sec/Bugs/Log/Qual : a/b/c/d) en Ts, noise N%
Vraies trouvailles : <quelles règles ont trouvé des vrais bugs>
Faux positifs : <quelles règles tirent à blanc>
Crashes / weirdness : <rien | description>
```

---

## Quand tu as fini les 9 tests

Tu auras une vue claire de :
- **DecodeMind est-il fiable sur tes projets ?** (Tier 1)
- **Quelles règles produisent du bruit ?** (Tier 2 — tu sauras quoi désactiver / ajouter au `.decodemind-ignore`)
- **DecodeMind tient-il la charge ?** (Tier 3)

C'est seulement APRÈS ces 9 tests qu'on parle d'acheter le domaine. Avant ça, tu te ferais ridiculiser si quelqu'un essayait sur leur projet et que DecodeMind plantait.

## Si tu trouves un bug DecodeMind

Crée un fichier `docs/TEST_BUGS.md` avec :
```
## <date> — <nom du bug>
Projet scanné : <chemin>
Description : <ce qui se passe>
Erreur console : <stack si applicable>
Reproductible ? Oui / Non / Aléatoire
```

Quand tu en as 3-5, donne-les moi et je dispatch un agent qui les corrige tous en une passe.

---

## Mode "j'ai pas le courage de tout faire"

Si tu fais **juste les 3 tests Tier 1**, c'est déjà 80% de la valeur. Le reste peut attendre.

Si tu fais **juste Test 1.1 (NetGuardPro)**, c'est 50% de la valeur, parce que c'est ton produit le plus mature et le plus auditable.

**Minimum viable** : Test 1.1 + Test 1.2. ~30 minutes. Tu sauras si DecodeMind tient debout sur du vrai code à toi.
