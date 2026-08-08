"use client";

import { useEffect, useState } from "react";

type Video = { id: string; title: string; thumbnail: string | null; duration: string | null };

// "VIDEO PENDUKUNG": ambil video YouTube pertama (scraping via /api/video) sesuai judul
// subbab yang sedang dibuka. Embed pakai iframe; fallback ke link pencarian kalau tak ada.
export default function VideoSupport({ query }: { query: string }) {
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setPlay(false);
    setVideo(null);
    if (!query || query.trim().length < 2) {
      setLoading(false);
      return;
    }
    fetch(`/api/video?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setVideo(d.video ?? null);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [query]);

  return (
    <div className="rounded-sm bg-white p-4 shadow-card">
      <p className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <span>▶ Video Pendukung</span>
        {video?.duration && <span className="text-brand-500">{video.duration}</span>}
      </p>

      {loading ? (
        <div className="aspect-video w-full animate-pulse rounded-2xl bg-slate-100" />
      ) : video ? (
        <>
          <div className="aspect-video w-full overflow-hidden rounded-2xl bg-ink-900">
            {play ? (
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${video.id}?autoplay=1`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <button
                onClick={() => setPlay(true)}
                className="group relative h-full w-full"
                aria-label={`Putar video: ${video.title}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={video.thumbnail ?? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                  alt={video.title}
                  className="h-full w-full object-cover"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/10">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-brand-600 shadow-lg">
                    ▶
                  </span>
                </span>
              </button>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-xs font-medium text-slate-600">{video.title}</p>
        </>
      ) : (
        <a
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl bg-slate-50 text-center text-xs text-slate-400 transition hover:bg-slate-100"
        >
          <span className="text-2xl">🔍</span>
          <span className="mt-1 px-3">Video tak ditemukan otomatis — cari manual di YouTube</span>
        </a>
      )}
    </div>
  );
}
