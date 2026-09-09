import { useEffect, useState } from 'react';

/**
 * Bandeau pub OmniPost (flux RSS d'annonces) — même style que
 * festivalpacktravel.ca et luceai.ca : carrousel d'images plein format
 * (10:1), rotation automatique, badge "Ad".
 *
 * Fetch client-side pur (pas de proxy serveur — DecodeMind est un SPA
 * statique) : le flux autorise déjà les requêtes cross-origin (CORS *).
 * Chaque image est affichée en entier (jamais coupée) sur un fond flouté
 * qui remplit le cadre — un crop centré coupait les visages des photos
 * portrait dans un cadre aussi large.
 */

const FEED_URL = 'https://sxc3030-eng.github.io/omnipost-rss/rss.xml';
const ROTATE_MS = 5_000;

interface AdItem {
  title: string;
  link: string;
  image: string;
}

function parseFeed(xml: string): AdItem[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return [];
  const items: AdItem[] = [];
  doc.querySelectorAll('item').forEach((item) => {
    const title = item.querySelector('title')?.textContent?.trim() ?? '';
    const link = item.querySelector('link')?.textContent?.trim() ?? '';
    const enclosure = item.querySelector('enclosure')?.getAttribute('url') ?? '';
    const thumbnail = item.getElementsByTagNameNS('*', 'thumbnail')[0]?.getAttribute('url') ?? '';
    const image = enclosure || thumbnail;
    // Filtre les entrées sans vraie image (ex. lien vers une page plutôt
    // qu'un fichier photo) — évite un cadre vide/casse.
    if (!title || !link || !image || !/\.(jpe?g|png|gif|webp)(\?|$)/i.test(image)) return;
    items.push({ title, link, image });
  });
  return items;
}

export function AdCarousel() {
  const [items, setItems] = useState<AdItem[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(FEED_URL, { signal: AbortSignal.timeout(8_000) })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((xml) => {
        if (!cancelled) setItems(parseFeed(xml));
      })
      .catch(() => {
        /* silencieux : pas de pub plutôt qu'une erreur visible */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <div className="ads-banner" role="complementary" aria-label="Offres et annonces">
      <div className="ads-inner">
        {items.map((item, index) => (
          <a
            key={`${item.link}-${index}`}
            href={item.link}
            target="_blank"
            rel="noopener sponsored nofollow"
            className={`ad-item${index === active ? ' active' : ''}`}
            aria-hidden={index !== active}
            tabIndex={index === active ? 0 : -1}
          >
            <span className="ad-frame">
              {/* crossOrigin requis : le site tourne avec COEP require-corp (isolation
                  necessaire aux workers WASM Ruff/tree-sitter) -- une image cross-origin
                  sans mode CORS explicite est bloquee (ERR_BLOCKED_BY_RESPONSE...Coep),
                  meme si l'hote (GitHub Pages) autorise deja Access-Control-Allow-Origin:*. */}
              <img className="ad-bg" src={item.image} alt="" aria-hidden loading="lazy" crossOrigin="anonymous" />
              <img className="ad-fg" src={item.image} alt={item.title} loading="lazy" crossOrigin="anonymous" />
            </span>
            <span className="ad-label">Ad</span>
          </a>
        ))}
      </div>
    </div>
  );
}
