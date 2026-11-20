"use client";

import { useState } from "react";

interface CameraRubricModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal Petunjuk Penilaian Kamera & Simulasi (Task 3C-SR).
 * Disederhanakan untuk kemudahan pemahaman pengguna non-IT.
 * Memuat 5 aspek inti yang dinilai selama sesi simulasi.
 */
export function CameraRubricModal({ isOpen, onClose }: CameraRubricModalProps) {
  if (!isOpen) return null;

  const CRITERIA = [
    {
      id: "eye",
      icon: "bi-eye-fill",
      color: "bg-blue-50 text-blue-600 border-blue-200",
      badgeColor: "bg-blue-100 text-blue-700",
      title: "1. Fokus & Arah Pandangan Mata",
      highlight: "Tatap kamera secara wajar dan tenang",
      desc: "Lihatlah ke arah kamera layaknya sedang berbicara langsung dengan orang lain. Hindari mata melirik ke atas atau ke samping terus-menerus, dan jangan terlihat seperti membaca teks naskah contekan.",
      tip: "Bayangkan lensa kamera adalah mata teman bicaramu.",
    },
    {
      id: "diksi",
      icon: "bi-chat-quote-fill",
      color: "bg-emerald-50 text-emerald-600 border-emerald-200",
      badgeColor: "bg-emerald-100 text-emerald-700",
      title: "2. Pilihan Kata & Diksi yang Bagus",
      highlight: "Gunakan bahasa yang sopan, rapi, dan jelas",
      desc: "Pilih kata-kata yang mudah dipahami, sopan, dan terdengar percaya diri. Usahakan untuk mengurangi jeda gumaman atau kata pengisi seperti 'ehem', 'anu', 'hmm', atau 'apa ya'.",
      tip: "Tarik napas sejenak jika butuh berpikir daripada mengucapkan kata pengisi.",
    },
    {
      id: "hand",
      icon: "bi-hand-index-thumb-fill",
      color: "bg-purple-50 text-purple-600 border-purple-200",
      badgeColor: "bg-purple-100 text-purple-700",
      title: "3. Gerakan Tangan & Bahasa Tubuh",
      highlight: "Gunakan gestur tangan terbuka secara alami",
      desc: "Gerakkan tangan santai di depan dada saat menegaskan poin penting agar terlihat komunikatif. Hindari melipat tangan di dada (bersedekap), kaku tanpa gerak, atau menyembunyikan tangan di bawah meja.",
      tip: "Bahasa tubuh terbuka memberi kesan ramah dan menguasai topik.",
    },
    {
      id: "content",
      icon: "bi-lightbulb-fill",
      color: "bg-amber-50 text-amber-600 border-amber-200",
      badgeColor: "bg-amber-100 text-amber-700",
      title: "4. Isi Penjelasan yang Mudah Dicerna",
      highlight: "Sampaikan ide secara runtut dan tidak berbelit",
      desc: "Jawab dan jelaskan pertanyaan secara teratur dari inti masalah hingga solusinya. Jangan berputar-putar tanpa arah; sampaikan alasan yang masuk akal dan relevan dengan topik.",
      tip: "Gunakan struktur: Inti jawaban → Alasan singkat → Contoh nyata.",
    },
    {
      id: "tempo",
      icon: "bi-speedometer2",
      color: "bg-indigo-50 text-indigo-600 border-indigo-200",
      badgeColor: "bg-indigo-100 text-indigo-700",
      title: "5. Kecepatan & Tempo Berbicara",
      highlight: "Bicara dengan tempo stabil, tidak terburu-buru",
      desc: "Atur kecepatan bicara agar pendengar dapat menangkap setiap kalimat dengan jelas. Jangan berbicara terlalu cepat seperti sedang dikejar waktu, dan jangan terlalu lambat hingga membosankan.",
      tip: "Beri jeda koma dan titik yang wajar di setiap akhir kalimat.",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200">
        
        {/* Header Modal */}
        <div className="flex items-start justify-between p-5 md:p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 text-xl border border-brand-100 shadow-sm">
              <i className="bi bi-card-checklist"></i>
            </span>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                5 Hal Utama yang Dinilai Saat Simulasi
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Petunjuk praktis dan mudah dipahami agar penampilan latihan Anda maksimal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Tutup"
          >
            <i className="bi bi-x-lg text-sm"></i>
          </button>
        </div>

        {/* Isi 5 Petunjuk Sederhana */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-3.5">
          {CRITERIA.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-start gap-3.5">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg ${item.color}`}>
                  <i className={`bi ${item.icon}`}></i>
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${item.badgeColor}`}>
                      {item.highlight}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {item.desc}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                    <i className="bi bi-stars text-amber-500"></i>
                    <span><strong>Tips Praktis:</strong> {item.tip}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Jaminan Privasi Ramah Pengguna Awam */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 text-base">
                <i className="bi bi-shield-check"></i>
              </span>
              <div>
                <h5 className="text-xs font-bold text-emerald-900">
                  Jaminan Privasi Anda 100% Aman
                </h5>
                <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                  Kamera hanya diproses langsung di peramban (browser) perangkat Anda. 
                  <strong> Video tidak pernah direkam, disimpan, atau dikirim ke internet/server</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/60">
          <span className="text-xs text-slate-400">
            Latihan santai &amp; percaya diri adalah kuncinya!
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-brand-500 px-6 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-600 transition"
          >
            Siap, Saya Mengerti
          </button>
        </div>

      </div>
    </div>
  );
}

interface CameraRubricButtonProps {
  variant?: "primary" | "outline" | "pill" | "subtle";
  label?: string;
  className?: string;
}

/**
 * Tombol Trigger yang otomatis mengontrol pembukaan CameraRubricModal.
 */
export function CameraRubricButton({
  variant = "outline",
  label = "Petunjuk Penilaian Kamera",
  className = "",
}: CameraRubricButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  let style = "rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50";
  if (variant === "primary") {
    style = "rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-600";
  } else if (variant === "pill") {
    style = "rounded-full border border-brand-200 bg-brand-50/80 px-3.5 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-100 shadow-xs";
  } else if (variant === "subtle") {
    style = "text-[11px] font-semibold text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1";
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`${style} ${className} flex items-center gap-1.5`}
      >
        <i className="bi bi-info-circle-fill text-brand-500"></i>
        <span>{label}</span>
      </button>

      <CameraRubricModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

export default CameraRubricModal;
