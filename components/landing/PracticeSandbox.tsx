"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Lang } from "@/lib/i18n";

interface PracticeSandboxProps {
  lang: Lang;
}

type PracticeMode = "presentasi" | "wawancara";

const QUESTIONS = {
  presentasi: [
    {
      q: { id: "“Jelaskan idemu dalam satu menit.”", en: "“Share your idea in one minute.”" },
      desc: { id: "Mulai dari pesan utamanya secara ringkas.", en: "Start directly with your main message." },
      points: [
        { id: "Buka dengan satu ide utama yang memikat", en: "Open with one compelling central idea" },
        { id: "Berikan contoh konkret yang dekat dengan audiens", en: "Provide a concrete, relatable real-world example" },
        { id: "Tutup dengan kesimpulan tindakan (call to action)", en: "Close with a memorable takeaway or action step" },
      ],
    },
    {
      q: { id: "“Kenapa topik ini penting untuk audiensmu?”", en: "“Why does this topic matter to your audience?”" },
      desc: { id: "Hubungkan materi dengan kebutuhan orang yang mendengarkan.", en: "Connect your subject to what your audience truly needs." },
      points: [
        { id: "Kenali masalah yang sedang dihadapi audiens", en: "Highlight the specific pain point they experience" },
        { id: "Tunjukkan manfaat langsung solusi yang kamu tawarkan", en: "Demonstrate the immediate value of your solution" },
        { id: "Ajak mereka merenungkan dampaknya bagi masa depan", en: "Invite them to envision the long-term impact" },
      ],
    },
  ],
  wawancara: [
    {
      q: { id: "“Ceritakan bagaimana kamu menghadapi situasi sulit.”", en: "“How do you handle a tough challenge?”" },
      desc: { id: "Gunakan metode STAR (Situation, Task, Action, Result).", en: "Use the STAR framework (Situation, Task, Action, Result)." },
      points: [
        { id: "Jelaskan konteks masalah tanpa menyalahkan orang lain", en: "Describe the challenge factually and objectively" },
        { id: "Fokuskan pada inisiatif dan tindakan nyata yang kamu ambil", en: "Detail the specific initiative you took to resolve it" },
        { id: "Sebutkan hasil terukur dan pembelajaran yang kamu dapat", en: "Highlight measurable outcomes and key lessons learned" },
      ],
    },
    {
      q: { id: "“Apa keahlian yang sedang ingin kamu kembangkan?”", en: "“What skill are you actively improving right now?”" },
      desc: { id: "Jawaban yang baik menunjukkan kerendahan hati dan kemauan belajar.", en: "A thoughtful answer demonstrates self-awareness and active growth." },
      points: [
        { id: "Pilih keahlian yang relevan dengan tujuan kariermu", en: "Choose a skill relevant to your primary field" },
        { id: "Jelaskan alasan mengapa keahlian tersebut penting", en: "Explain your rationale and learning motivation" },
        { id: "Sebutkan langkah nyata yang sedang kamu jalankan hari ini", en: "Name the concrete training steps you are currently taking" },
      ],
    },
  ],
};

/**
 * PracticeSandbox - Panggung Latihan 1 Menit (Planning 8 - Task 8B-LP)
 * - Section ID: #practice, bernuansa Navy Dominant (#283157) kontras tinggi.
 * - Dilengkapi timer hitung mundur 01:00 interaktif (Play, Pause, Reset).
 * - Pemilih mode: Presentasi vs Wawancara dengan prompt pertanyaan dan checklist rubrik.
 * - Strict Zero Emojis (Aturan F): Memakai Bootstrap Icons.
 */
export default function PracticeSandbox({ lang }: PracticeSandboxProps) {
  const isId = lang === "id";
  const [mode, setMode] = useState<PracticeMode>("presentasi");
  const [qIndex, setQIndex] = useState(0);
  const [remaining, setRemaining] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [statusMsg, setStatusMsg] = useState(
    isId ? "Waktumu satu menit." : "You have one minute."
  );
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const activeQuestions = QUESTIONS[mode];
  const currentItem = activeQuestions[qIndex % activeQuestions.length];

  // Timer loop
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            clearInterval(timerRef.current as NodeJS.Timeout);
            setStatusMsg(
              isId
                ? "Satu menit selesai! Coba lagi atau lanjut ke pertanyaan berikutnya."
                : "One minute done! Try again or proceed to next question."
            );
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, isId]);

  const toggleTimer = () => {
    if (isRunning) {
      setIsRunning(false);
      setStatusMsg(isId ? "Latihan dijeda. Lanjutkan saat kamu siap." : "Practice paused.");
    } else {
      if (remaining === 0) setRemaining(60);
      setIsRunning(true);
      setStatusMsg(isId ? "Mulai! Sampaikan idemu dengan santai." : "Go! Express your idea.");
    }
  };

  const resetTimer = () => {
    setIsRunning(false);
    setRemaining(60);
    setStatusMsg(isId ? "Waktumu satu menit." : "You have one minute.");
  };

  const nextQuestion = () => {
    resetTimer();
    setQIndex((prev) => prev + 1);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <section
      id="practice"
      className="scroll-mt-24 bg-[#283157] px-4 py-20 text-white sm:px-6 md:px-10 on-dark-section simulation-section"
      data-header-dark="true"
    >
      <div className="mx-auto max-w-7xl">
        {/* Intro */}
        <div className="mb-12 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#d7daea]">
              {isId ? "Simulasi Cepat" : "Quick Sandbox"}
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
              {isId ? "Latihan dulu. Makin siap." : "Try it out. Show up ready."}
            </h2>
          </div>
          <p className="max-w-md text-base text-[#d7daea]">
            {isId
              ? "Satu menit. Satu ide. Latih kemampuan komunikasimu secara praktis."
              : "One minute. One idea. Practice your speaking cadence directly."}
          </p>
        </div>

        {/* Sandbox Grid: Video/Ilustrasi Kiri + Sheet Kanan */}
        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
          {/* Kolom Kiri: Panggung Visual & Timer Bar */}
          <div className="lg:col-span-6 flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#1d2546] shadow-2xl">
            <div className="relative flex min-h-[300px] flex-1 items-center justify-center p-6">
              <span className="absolute left-5 top-5 rounded-lg bg-white px-3 py-1 text-xs font-bold text-[#283157] shadow-sm">
                <i className="bi bi-broadcast mr-1.5 text-rose-500"></i>
                {isId ? "Giliranmu bicara" : "Your turn to speak"}
              </span>

              <div className="animate-book-float-slow flex items-center justify-center">
                <Image
                  src="/images/presentation-illustration.webp"
                  alt="Ilustrasi panggung presentasi 3D"
                  width={1456}
                  height={1088}
                  className="h-auto max-h-[300px] w-auto object-contain drop-shadow-2xl"
                />
              </div>
            </div>

            {/* Controls Bar di Bawah Visual */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 bg-[#151c38] p-5">
              <div>
                <strong className="block text-sm font-bold text-white">
                  {isId ? "Ruang Latihan 1 Menit" : "1-Minute Practice Room"}
                </strong>
                <span className="text-xs text-[#d7daea]">
                  {statusMsg}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <output className="font-mono text-xl font-bold tracking-wider text-emerald-400">
                  {formatTime(remaining)}
                </output>

                <button
                  type="button"
                  onClick={toggleTimer}
                  aria-label={isRunning ? "Jeda timer" : "Mulai timer"}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#283157] transition hover:bg-slate-200 active:scale-95"
                >
                  <i className={`bi ${isRunning ? "bi-pause-fill" : "bi-play-fill"} text-lg`}></i>
                </button>

                <button
                  type="button"
                  onClick={resetTimer}
                  aria-label="Reset timer"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
                >
                  <i className="bi bi-arrow-counterclockwise text-sm"></i>
                </button>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Interactive Question Sheet */}
          <div className="lg:col-span-6 flex flex-col justify-between rounded-3xl border border-border/80 bg-[#f2f3f7] p-6 sm:p-8 text-[#272b3f] shadow-2xl">
            <div className="space-y-6">
              {/* Segmented Mode Selector */}
              <div className="inline-flex rounded-xl bg-[#e1e4ef] p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMode("presentasi");
                    resetTimer();
                  }}
                  className={`rounded-lg px-4 py-2 text-xs sm:text-sm font-bold transition ${
                    mode === "presentasi"
                      ? "bg-white text-[#283157] shadow-sm"
                      : "text-slate-600 hover:text-[#283157]"
                  }`}
                >
                  <i className="bi bi-easel2-fill mr-1.5"></i>
                  {isId ? "Presentasi" : "Presentation"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("wawancara");
                    resetTimer();
                  }}
                  className={`rounded-lg px-4 py-2 text-xs sm:text-sm font-bold transition ${
                    mode === "wawancara"
                      ? "bg-white text-[#283157] shadow-sm"
                      : "text-slate-600 hover:text-[#283157]"
                  }`}
                >
                  <i className="bi bi-chat-quote-fill mr-1.5"></i>
                  {isId ? "Wawancara" : "Interview"}
                </button>
              </div>

              {/* Pertanyaan Utama */}
              <div>
                <blockquote className="text-xl sm:text-2xl font-bold tracking-tight text-[#283157]">
                  {currentItem.q[lang]}
                </blockquote>
                <p className="mt-2 text-xs sm:text-sm text-[#5b6275]">
                  {currentItem.desc[lang]}
                </p>
              </div>

              {/* Poin Rubrik Panduan Bicara */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {isId ? "Poin kunci panduan bicara:" : "Key speaking guidelines:"}
                </span>
                <ul className="space-y-2 text-xs sm:text-sm font-medium text-slate-700">
                  {currentItem.points.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <i className="bi bi-arrow-up-right text-brand-500 shrink-0 mt-0.5"></i>
                      <span>{pt[lang]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Aksi Bawah */}
            <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={toggleTimer}
                className="inline-flex items-center gap-2 rounded-xl bg-[#283157] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-md transition hover:bg-[#1d2546] active:scale-95"
              >
                <i className={`bi ${isRunning ? "bi-pause-fill" : "bi-play-fill"}`}></i>
                <span>{isRunning ? (isId ? "Jeda Latihan" : "Pause") : (isId ? "Mulai Latihan" : "Start Practising")}</span>
              </button>

              <button
                type="button"
                onClick={nextQuestion}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#283157] transition hover:bg-slate-200"
              >
                <span>{isId ? "Ganti Pertanyaan" : "Next Question"}</span>
                <i className="bi bi-chevron-right text-xs"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Caption */}
        <div className="mt-12 flex flex-col justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center text-sm text-[#d7daea]">
          <p>
            {isId
              ? "Ingin penilaian lengkap dengan deteksi AI ekspresi wajah dan intonasi?"
              : "Want full AI scoring with facial expression kinematics and tone metrics?"}
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 font-bold text-white hover:underline underline-offset-4"
          >
            <span>{isId ? "Coba Ruang Simulasi AI Lengkap" : "Try Full AI Simulation Room"}</span>
            <i className="bi bi-arrow-up-right text-xs"></i>
          </Link>
        </div>
      </div>
    </section>
  );
}

