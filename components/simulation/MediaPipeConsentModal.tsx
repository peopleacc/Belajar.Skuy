"use client";

interface MediaPipeConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDeclineAudioOnly: () => void;
  onClose: () => void;
}

/**
 * Modal Persetujuan Unduhan Library AI Visual MediaPipe (Task 2C-CG).
 * Memberikan transparansi kepada pengguna sebelum model ~15 MB diunduh ke browser,
 * serta menyediakan opsi fallback ramah performa "Mode Audio Saja".
 */
export default function MediaPipeConsentModal({
  isOpen,
  onAccept,
  onDeclineAudioOnly,
  onClose,
}: MediaPipeConsentModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 md:p-8 shadow-2xl border border-slate-200">
        
        {/* Header Icon & Title */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 border border-brand-100 shadow-sm">
            <i className="bi bi-cpu-fill text-2xl"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900">
              Persetujuan Pemuatan AI Visual MediaPipe
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Transparansi privasi dan penggunaan data perangkat Anda
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition -mr-1 -mt-1 p-1 rounded-lg"
            aria-label="Tutup"
          >
            <i className="bi bi-x-lg text-base"></i>
          </button>
        </div>

        {/* Content Explanation */}
        <div className="mt-5 space-y-3 text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200/80">
          <div className="flex items-start gap-2.5">
            <i className="bi bi-shield-check text-emerald-600 text-sm shrink-0 mt-0.5"></i>
            <div>
              <strong className="text-slate-800">100% Privasi di Perangkat Anda:</strong>
              <p className="text-slate-500 mt-0.5">
                Model AI MediaPipe berjalan lokal di browser. Rekaman video kamera <strong>tidak pernah</strong> dikirim atau disimpan di server kami.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <i className="bi bi-cloud-arrow-down text-brand-600 text-sm shrink-0 mt-0.5"></i>
            <div>
              <strong className="text-slate-800">Pengunduhan Aset Model (~15 MB):</strong>
              <p className="text-slate-500 mt-0.5">
                Perangkat Anda akan mengunduh paket model vision satu kali dan menyimpannya di cache browser untuk menganalisis kontak mata dan gestur tangan.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <i className="bi bi-speedometer2 text-amber-600 text-sm shrink-0 mt-0.5"></i>
            <div>
              <strong className="text-slate-800">Opsi Hemat Bandwidth & Baterai:</strong>
              <p className="text-slate-500 mt-0.5">
                Jika memiliki koneksi lambat atau perangkat dengan spesifikasi terbatas, Anda dapat memilih <em>Mode Audio Saja</em> tanpa memuat AI visual.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onDeclineAudioOnly}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 flex items-center justify-center gap-2"
          >
            <i className="bi bi-mic-fill text-slate-500"></i>
            <span>Lanjut Mode Audio Saja</span>
          </button>

          <button
            type="button"
            onClick={onAccept}
            className="rounded-xl bg-brand-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-95 flex items-center justify-center gap-2"
          >
            <i className="bi bi-camera-video-fill"></i>
            <span>Setuju &amp; Muat Kamera</span>
          </button>
        </div>

      </div>
    </div>
  );
}

