// Lightweight video URL → embed renderer.
//
// Recognizes:
//   • YouTube — youtube.com/watch?v=…, youtu.be/…, youtube.com/embed/…
//   • Vimeo   — vimeo.com/<id>, player.vimeo.com/video/<id>
//   • Direct  — anything ending in .mp4 / .webm / .ogg / .mov
//
// Unknown URLs fall back to a plain <a> link rather than crashing the
// page, since owner-entered URLs are free text.
import { useEffect, useState } from 'react';

const ASPECT = '16 / 9';
const FRAME_STYLE = {
  width: '100%', aspectRatio: ASPECT, border: 0, borderRadius: 8,
  background: '#000', display: 'block',
};

export function parseVideoUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim();
  if (!u) return null;

  // YouTube
  let m = u.match(/(?:youtube\.com\/watch\?[^#]*[?&]v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/);
  if (m) {
    return { kind: 'youtube', src: `https://www.youtube.com/embed/${m[1]}` };
  }
  m = u.match(/^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,})/);
  if (m) {
    return { kind: 'youtube', src: `https://www.youtube.com/embed/${m[1]}` };
  }

  // Vimeo
  m = u.match(/vimeo\.com\/(?:video\/)?(\d{5,})/);
  if (m) {
    return { kind: 'vimeo', src: `https://player.vimeo.com/video/${m[1]}` };
  }

  // Direct video file
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(u)) {
    return { kind: 'file', src: u };
  }

  return { kind: 'unknown', src: u };
}

export default function VideoEmbed({ url, title }) {
  // Defer mounting the iframe until after the first paint so the rest of
  // the page renders without waiting on the third-party load. Trivial
  // perf win, also makes Esc-from-modal feel snappier.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame ? requestAnimationFrame(() => setReady(true)) : setTimeout(() => setReady(true), 0);
    return () => { if (window.cancelAnimationFrame) cancelAnimationFrame(id); else clearTimeout(id); };
  }, []);

  const parsed = parseVideoUrl(url);
  if (!parsed) return null;

  if (parsed.kind === 'youtube' || parsed.kind === 'vimeo') {
    return (
      <div style={{ marginBottom: 12 }}>
        {ready && (
          <iframe src={parsed.src} title={title || 'Video'}
                  loading="lazy" allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  style={FRAME_STYLE} />
        )}
      </div>
    );
  }
  if (parsed.kind === 'file') {
    return (
      <div style={{ marginBottom: 12 }}>
        <video src={parsed.src} controls preload="metadata"
               style={{ ...FRAME_STYLE, background: '#000' }}>
          {/* Direct fallback for browsers that can't play the format */}
          <a href={parsed.src}>{title || 'Video'}</a>
        </video>
      </div>
    );
  }
  // Unknown provider — render a plain link.
  return (
    <p style={{ marginBottom: 12 }}>
      <a href={parsed.src} target="_blank" rel="noopener noreferrer">
        {title || parsed.src}
      </a>
    </p>
  );
}
