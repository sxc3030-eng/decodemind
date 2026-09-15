import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { AdCarousel } from '@/components/AdCarousel';

// Mesuré en production le 2026-09-14 (Master, Chromium réel sur decodemind.dev) : 50 images de
// pub dans la page, 0 affichée (naturalWidth toujours 0). L'hypothèse de départ était COEP/CORS
// (le site tourne en require-corp pour son scanner WASM) ; VÉRIFIÉ FAUX en production : une image
// identique chargée à la main (new Image(), crossOrigin="anonymous") réussit du premier coup.
// La vraie cause, isolée en forçant `loading` de 'lazy' à 'eager' sur un <img> déjà dans la page
// (chargement instantané dès le changement) : `loading="lazy"` sur des dizaines d'images empilées
// à la même position (position:absolute; inset:0, une seule à opacity:1) — la même règle que sur
// souveraincode.ca et archipelonline.com ce soir, jamais loading="lazy" sur des images empilées en
// opacité zéro, sinon le navigateur ne les charge jamais. crossOrigin="anonymous" reste posé (bon
// réflexe sous COEP, voir sa propre trace ci-dessous), ce n'était juste pas la cause.
//
// Note de méthode : `screen.getByRole('link')` ignore les éléments aria-hidden="true" (le lot des
// annonces inactives du carrousel) — inutilisable ici. Les tests interrogent le DOM directement.
const FLUX = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel>
<item><title>SouverainCode</title><link>https://souveraincode.ca/</link>
  <enclosure url="https://sxc3030-eng.github.io/omnipost-rss/images/svc.png" type="image/png"/></item>
<item><title>profAI</title><link>https://profai.ca/</link>
  <enclosure url="https://sxc3030-eng.github.io/omnipost-rss/images/profai.png" type="image/png"/></item>
</channel></rss>`;

afterEach(() => vi.restoreAllMocks());

describe('AdCarousel', () => {
  it('ne pose jamais loading="lazy" sur les images du carrousel (elles resteraient à naturalWidth 0)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(FLUX) }));
    const { container } = render(<AdCarousel />);
    await waitFor(() => expect(container.querySelectorAll('.ad-item')).toHaveLength(2));
    const images = Array.from(container.querySelectorAll<HTMLImageElement>('.ad-item img'));
    expect(images.length).toBe(4); // 2 annonces × (ad-bg + ad-fg)
    for (const img of images) {
      expect(img.getAttribute('loading'), `${img.className} : loading="lazy" empêcherait le chargement`).not.toBe('lazy');
    }
  });

  it('garde crossOrigin="anonymous" (bonne pratique sous COEP require-corp, même si ce n était pas la cause du défaut)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(FLUX) }));
    const { container } = render(<AdCarousel />);
    await waitFor(() => expect(container.querySelectorAll('.ad-item')).toHaveLength(2));
    const images = Array.from(container.querySelectorAll<HTMLImageElement>('.ad-item img'));
    for (const img of images) expect(img.getAttribute('crossorigin')).toBe('anonymous');
  });

  it('un flux vide ou en échec : aucun bandeau, jamais un cadre vide', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('réseau')));
    render(<AdCarousel />);
    await waitFor(() => expect(document.querySelector('.ads-banner')).not.toBeInTheDocument());
  });
});
