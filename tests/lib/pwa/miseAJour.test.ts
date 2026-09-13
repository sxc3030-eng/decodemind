/**
 * La mise à jour du service worker ne doit jamais recharger la page pendant
 * qu'une analyse tourne.
 *
 * Le défaut réparé : le service worker restait « en attente » pour toujours,
 * et un visiteur déjà venu tombait sur une page blanche, sans message et sans
 * recours. On met donc à jour tout seul — mais un scanner qui efface son
 * propre résultat au moment où il aboutit serait pire que le défaut qu'on
 * répare.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  marquerAnalyse,
  uneAnalyseTourne,
  demanderRechargement,
} from '@/lib/pwa/miseAJour';

let rechargements = 0;

beforeEach(() => {
  rechargements = 0;
  // On ne recharge évidemment pas pour de vrai pendant un test.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: () => { rechargements += 1; } },
  });
  marquerAnalyse(false);
  rechargements = 0;
});

describe('mise à jour du service worker', () => {
  it('recharge tout de suite quand rien ne tourne', () => {
    demanderRechargement();
    expect(rechargements).toBe(1);
  });

  it('ne recharge PAS pendant une analyse', () => {
    marquerAnalyse(true);
    demanderRechargement();
    expect(rechargements).toBe(0);
  });

  it('recharge dès que l’analyse se termine', () => {
    marquerAnalyse(true);
    demanderRechargement();
    expect(rechargements).toBe(0);

    marquerAnalyse(false);
    expect(rechargements).toBe(1);
  });

  it('ne recharge pas à la fin si personne ne l’a demandé', () => {
    marquerAnalyse(true);
    marquerAnalyse(false);
    expect(rechargements).toBe(0);
  });

  it('ne recharge qu’une seule fois, même après plusieurs demandes', () => {
    marquerAnalyse(true);
    demanderRechargement();
    demanderRechargement();
    demanderRechargement();
    marquerAnalyse(false);
    expect(rechargements).toBe(1);
  });

  it('dit franchement si une analyse tourne', () => {
    expect(uneAnalyseTourne()).toBe(false);
    marquerAnalyse(true);
    expect(uneAnalyseTourne()).toBe(true);
    marquerAnalyse(false);
    expect(uneAnalyseTourne()).toBe(false);
  });

  it('n’explose pas là où il n’y a pas de service worker', async () => {
    const { installerMiseAJour } = await import('@/lib/pwa/miseAJour');
    const vrai = navigator.serviceWorker;
    // @ts-expect-error — on simule un navigateur sans service worker
    delete navigator.serviceWorker;
    expect(() => installerMiseAJour()()).not.toThrow();
    if (vrai) {
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: vrai,
      });
    }
  });
});

describe('les tailles de modèle sont connues du code', () => {
  it('chaque palier annonce un poids de téléchargement', async () => {
    const { MODELS } = await import('@/lib/llm/models');
    for (const palier of ['quick', 'better', 'best'] as const) {
      expect(MODELS[palier].approxDiskBytes).toBeGreaterThan(100 * 1024 * 1024);
    }
  });

  it('les poids réels sont ceux mesurés le 2026-09-13', async () => {
    const { MODELS } = await import('@/lib/llm/models');
    expect(MODELS.quick.approxDiskBytes).toBe(840 * 1024 * 1024);
    expect(MODELS.better.approxDiskBytes).toBe(1900 * 1024 * 1024);
    expect(MODELS.best.approxDiskBytes).toBe(4198 * 1024 * 1024);
  });

  it('le poids se lit en clair, pas en octets bruts', async () => {
    const { formatBytes } = await import('@/lib/measurement/instrument');
    const { MODELS } = await import('@/lib/llm/models');
    const lisible = formatBytes(MODELS.quick.approxDiskBytes);
    expect(lisible).toMatch(/\d/);
    expect(lisible).toMatch(/[MG]B|Mo|Go/i);
    expect(lisible).not.toMatch(/^\d{7,}$/);
  });
});
