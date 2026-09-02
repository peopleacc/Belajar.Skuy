"use client";

import { useEffect, useState, useMemo } from "react";
import {
  MAIN_CATEGORIES,
  PROMPT_ITEMS,
  type CategoryId,
  type PromptItem,
} from "@/lib/promptCategoriesData";

type TopicCategoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onPick: (promptText: string) => void;
};

export default function TopicCategoryModal({
  isOpen,
  onClose,
  onPick,
}: TopicCategoryModalProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<CategoryId>("sd");
  const [activeSubCategoryId, setActiveSubCategoryId] = useState<string>("sd-all");
  const [searchQuery, setSearchQuery] = useState("");

  // Dapatkan detail kategori aktif
  const currentCategory = useMemo(() => {
    return (
      MAIN_CATEGORIES.find((cat) => cat.id === activeCategoryId) ??
      MAIN_CATEGORIES[0]
    );
  }, [activeCategoryId]);

  // Saat ganti kategori utama, reset subkategori ke pilihan pertama (Semua)
  const handleCategoryChange = (catId: CategoryId) => {
    setActiveCategoryId(catId);
    const cat = MAIN_CATEGORIES.find((c) => c.id === catId);
    if (cat && cat.subCategories.length > 0) {
      setActiveSubCategoryId(cat.subCategories[0].id);
    }
  };

  // Filter prompt berdasarkan pencarian & kategori
  const filteredPrompts = useMemo(() => {
    let items = PROMPT_ITEMS;

    // Filter berdasarkan kata kunci pencarian jika ada
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      return items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.reason.toLowerCase().includes(q) ||
          item.promptText.toLowerCase().includes(q) ||
          (item.badge && item.badge.toLowerCase().includes(q))
      );
    }

    // Jika tidak sedang mencari, filter berdasarkan Kategori Utama
    items = items.filter((item) => item.categoryId === activeCategoryId);

    // Filter berdasarkan Sub-kategori jika bukan "all"
    if (
      activeSubCategoryId &&
      !activeSubCategoryId.endsWith("-all")
    ) {
      items = items.filter((item) => item.subCategoryId === activeSubCategoryId);
    }

    return items;
  }, [activeCategoryId, activeSubCategoryId, searchQuery]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="topic-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Container Modal */}
      <div className="relative z-10 flex h-[90vh] max-h-[780px] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl transition-all dark:bg-ink-800 dark:border dark:border-slate-700">
        
        {/* Header Modal */}
        <div className="border-b border-slate-100 p-4 sm:p-6 dark:border-slate-700/60">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                <i className="bi bi-compass-fill"></i>
                <span>Eksplorasi Katalog Rekomendasi Topik</span>
              </div>
              <h2
                id="topic-modal-title"
                className="mt-2 text-xl font-bold text-slate-800 sm:text-2xl dark:text-light"
              >
                Pilih Rekomendasi Topik Pembelajaran
              </h2>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
                Temukan ide prompt course berdasarkan jenjang sekolah (SD, SMP, SMA), kuliah, maupun koding.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700"
              aria-label="Tutup modal"
            >
              <i className="bi bi-x-lg text-lg"></i>
            </button>
          </div>

          {/* Live Search Bar */}
          <div className="relative mt-4">
            <i className="bi bi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari topik atau materi pelajaran (misal: Fotosintesis, Python, Kalkulus, SD Kelas 4)..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-10 text-xs text-slate-800 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:text-sm dark:border-slate-700 dark:bg-slate-900/40 dark:text-light dark:focus:bg-slate-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <i className="bi bi-x-circle-fill"></i>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs Kategori Utama (Hanya Tampil Jika Tidak Sedang Mencarikan Hasil Global) */}
        {!searchQuery && (
          <div className="border-b border-slate-100 bg-slate-50/50 px-4 pt-3 sm:px-6 dark:border-slate-700/60 dark:bg-slate-900/20">
            {/* Main Tabs */}
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-3">
              {MAIN_CATEGORIES.map((cat) => {
                const isActive = activeCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                      isActive
                        ? "bg-brand-500 text-white shadow-sm shadow-brand-500/30"
                        : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    <i className={`bi ${cat.icon}`}></i>
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Sub-category Filter Pills */}
            {currentCategory.subCategories.length > 0 && (
              <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-t border-slate-200/60 py-2.5 dark:border-slate-700/40">
                <span className="shrink-0 text-[11px] font-medium text-slate-400">Sub-klasifikasi:</span>
                {currentCategory.subCategories.map((sub) => {
                  const isSubActive = activeSubCategoryId === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setActiveSubCategoryId(sub.id)}
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                        isSubActive
                          ? "bg-slate-800 text-white dark:bg-light dark:text-slate-900"
                          : "bg-slate-200/60 text-slate-600 hover:bg-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-700"
                      }`}
                    >
                      {sub.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Content Body: Grid Items */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {searchQuery && (
            <div className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Menampilkan {filteredPrompts.length} hasil untuk pencarian &quot;
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {searchQuery}
              </span>
              &quot;
            </div>
          )}

          {filteredPrompts.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                <i className="bi bi-search text-xl"></i>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                Tidak ada topik yang sesuai
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Coba gunakan kata kunci lain atau pilih dari tab kategori utama di atas.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredPrompts.map((item: PromptItem) => (
                <div
                  key={item.id}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 transition-all hover:border-brand-300 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800/80 dark:hover:border-brand-500/50"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {item.badge ?? item.categoryId.toUpperCase()}
                      </span>
                    </div>
                    <h3 className="mt-2 text-xs font-bold text-slate-800 group-hover:text-brand-600 sm:text-sm dark:text-slate-100 dark:group-hover:text-brand-400">
                      {item.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {item.reason}
                    </p>
                  </div>

                  <div className="mt-4 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        onPick(item.promptText);
                        onClose();
                      }}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2 text-xs font-semibold text-slate-700 transition group-hover:bg-brand-500 group-hover:text-white dark:bg-slate-700 dark:text-slate-200 dark:group-hover:bg-brand-500 dark:group-hover:text-white"
                    >
                      <span>Gunakan Topik Ini</span>
                      <i className="bi bi-arrow-right"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 p-4 text-xs text-slate-500 dark:border-slate-700/60 dark:bg-slate-900/30 dark:text-slate-400">
          <span>
            💡 Menampilkan <strong className="text-slate-700 dark:text-slate-200">{filteredPrompts.length}</strong> topik pilihan.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
