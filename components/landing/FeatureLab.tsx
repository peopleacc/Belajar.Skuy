"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Dict, Lang } from "@/lib/i18n";

type FeatureKey = "materi" | "kuis" | "suara" | "presentasi" | "wawancara";
type TopicKey = "communication" | "react" | "ecosystem";

interface FeatureLabProps {
  lang: Lang;
  t: Dict;
}

const TOPICS = {
  communication: {
    name: { id: "Komunikasi Efektif", en: "Effective Communication" },
    title: { id: "Kenali audiensmu", en: "Know your audience" },
    body: {
      id: "Kenali pendengarmu. Sesuaikan kata dan contoh dengan kebutuhan mereka.",
      en: "Know your audience. Match your words and examples to their needs.",
    },
    concept: {
      id: "Pesan yang jelas punya tujuan.",
      en: "A clear message has a purpose.",
    },
    example: {
      id: "Satu tujuan. Satu pesan utama.",
      en: "One goal. One main message.",
    },
    question: {
      id: "Apa yang membuat pesan mudah dipahami?",
      en: "What makes a message easier to understand?",
    },
    options: [
      { id: "Gunakan istilah teknis sebanyak mungkin.", en: "Use as much jargon as possible." },
      { id: "Sesuaikan pesan dengan pemahaman audiens.", en: "Adapt the message to your audience." },
      { id: "Sampaikan semua topik sekaligus tanpa jeda.", en: "Explain everything at once without pause." },
    ],
    correct: 1,
    explanation: {
      id: "Saat pesan disesuaikan dengan latar belakang audiens, mereka lebih cepat menangkap inti gagasan.",
      en: "When a message fits the audience’s background, they grasp the main point much faster.",
    },
  },
  react: {
    name: { id: "Dasar Komponen Web", en: "Web Component Basics" },
    title: { id: "Komponen itu seperti balok Lego", en: "Components are building blocks" },
    body: {
      id: "Komponen adalah bagian tampilan terisolasi yang bisa dipakai berulang kali.",
      en: "Components are isolated UI pieces that can be reused anywhere.",
    },
    concept: {
      id: "Satu komponen, satu tanggung jawab.",
      en: "One component, one clear responsibility.",
    },
    example: {
      id: "Contoh: tombol Simpan, Lanjut, dan Kirim.",
      en: "Example: Save, Continue, and Submit buttons.",
    },
    question: {
      id: "Mengapa arsitektur komponen sangat bermanfaat?",
      en: "Why is component architecture useful?",
    },
    options: [
      { id: "Supaya seluruh kode tertumpuk di satu file.", en: "To keep all code in a single file." },
      { id: "Supaya antarmuka dapat digunakan kembali.", en: "To make UI parts reusable and modular." },
      { id: "Supaya aplikasi tidak memerlukan data dinamis.", en: "To avoid using any dynamic data." },
    ],
    correct: 1,
    explanation: {
      id: "Komponen modular membuat tampilan web mudah diuji, diperbarui, dan dipelihara dalam jangka panjang.",
      en: "Modular components make web interfaces easier to test, update, and maintain.",
    },
  },
  ecosystem: {
    name: { id: "Aliran Energi Ekosistem", en: "Ecosystem Energy Flow" },
    title: { id: "Energi bergerak melalui rantai makanan", en: "Energy flows through the food chain" },
    body: {
      id: "Matahari memberi energi ke produsen, konsumen memanfaatkannya, dan pengurai mengembalikan hara.",
      en: "Energy flows from sunlight to producers, through consumers, and decomposers recycle nutrients.",
    },
    concept: {
      id: "Produsen -> Konsumen -> Pengurai",
      en: "Producers -> Consumers -> Decomposers",
    },
    example: {
      id: "Rumput -> Belalang -> Burung Pipit.",
      en: "Grass -> Grasshopper -> Sparrow.",
    },
    question: {
      id: "Apa peran mendasar produsen dalam ekosistem?",
      en: "What is the primary role of a producer?",
    },
    options: [
      { id: "Menghasilkan energi sendiri lewat fotosintesis.", en: "To produce energy via photosynthesis." },
      { id: "Memangsa konsumen tingkat pertama.", en: "To hunt primary consumers." },
      { id: "Menguraikan bahan anorganik mati.", en: "To break down inorganic matter." },
    ],
    correct: 0,
    explanation: {
      id: "Produsen (seperti tumbuhan hijau) mengubah cahaya menjadi energi makanan bagi seluruh tingkat rantai.",
      en: "Producers (like green plants) convert light into food energy for the entire chain.",
    },
  },
};

/**
 * FeatureLab - Laboratorium Fitur Interaktif (Planning 8 - Task 8B-LP)
 * Mengadopsi tab switcher dan live playground dari Redesign/index.html.
 */
export default function FeatureLab({ lang, t }: FeatureLabProps) {
  const isId = lang === "id";
  const [activeFeature, setActiveFeature] = useState<FeatureKey>("materi");
  const [activeTopic, setActiveTopic] = useState<TopicKey>("communication");
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [voiceText, setVoiceText] = useState(
    isId
      ? "Selamat pagi. Belajar dimulai dari rasa ingin tahu sederhana yang kita asah setiap hari."
      : "Good morning. Learning begins with simple curiosity that we nurture each day."
  );
  const [voiceStatus, setVoiceStatus] = useState<string>("");

  const currentTopic = TOPICS[activeTopic];

  const handleListenExample = () => {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) {
      setVoiceStatus(
        isId
          ? "Browser ini belum mendukung sintesis suara otomatis. Coba baca kalimat ini dengan lantang."
          : "Speech playback is unavailable. Try reading aloud."
      );
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(voiceText);
    utterance.lang = isId ? "id-ID" : "en-US";
    utterance.rate = 0.9;
    setVoiceStatus(isId ? "Sedang membacakan audio..." : "Reading aloud...");
    utterance.onend = () => {
      setVoiceStatus(isId ? "Sekarang giliranmu berlatih bicara." : "Now it's your turn to speak.");
    };
    utterance.onerror = () => {
      setVoiceStatus(isId ? "Pemutaran suara gagal." : "Playback error.");
    };
    window.speechSynthesis.speak(utterance);
  };

  const tabs: { key: FeatureKey; label: string; sub: string; icon: string }[] = [
    { key: "materi", label: isId ? "Materi" : "Lessons", sub: isId ? "Kurikulum AI" : "AI Curriculum", icon: "bi-journal-text" },
    { key: "kuis", label: isId ? "Kuis" : "Quizzes", sub: isId ? "Uji Pemahaman" : "Smart Practice", icon: "bi-check2-circle" },
    { key: "suara", label: isId ? "Suara" : "Voice", sub: isId ? "Lafal & Intonasi" : "Pronunciation", icon: "bi-mic-fill" },
    { key: "presentasi", label: isId ? "Presentasi" : "Presentations", sub: isId ? "Slide & Kamera" : "Slides & Camera", icon: "bi-file-earmark-slides-fill" },
    { key: "wawancara", label: isId ? "Wawancara" : "Interviews", sub: isId ? "Tanya Jawab AI" : "AI Q&A Practice", icon: "bi-person-video" },
  ];

  return (
    <section id="features" className="scroll-mt-24 border-y border-border/80 bg-surface-2 px-4 py-20 sm:px-6 md:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Section Intro */}
        <div className="mb-14 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">
              {isId ? "Laboratorium Belajar" : "Learning Lab"}
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900">
              {isId ? "Mau belajar apa?" : "What's next?"}
            </h2>
          </div>
          <p className="max-w-md text-base text-slate-600">
            {isId
              ? "Pilih satu fitur di bawah dan coba langsung tanpa perlu registrasi."
              : "Pick any capability below and try it out instantly without signing up."}
          </p>
        </div>

        {/* Feature Layout Grid: Navigasi Kiri + Console Kanan */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Sisi Kiri: Vertical Tab Buttons */}
          <div className="lg:col-span-4 flex flex-col gap-2.5" role="tablist" aria-label="Pilih fitur belajar">
            {tabs.map((tab) => {
              const active = activeFeature === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setActiveFeature(tab.key);
                    setSelectedAnswer(null);
                  }}
                  className={`group flex items-center justify-between rounded-2xl p-4 text-left transition-all duration-200 ${
                    active
                      ? "border border-border bg-white shadow-md"
                      : "border border-transparent bg-transparent hover:bg-white/60"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg transition ${
                        active
                          ? "bg-brand-500 text-white"
                          : "bg-surface-2 text-slate-500 group-hover:text-brand-500"
                      }`}
                    >
                      <i className={`bi ${tab.icon}`}></i>
                    </span>
                    <div>
                      <strong className={`block text-base font-bold ${active ? "text-slate-900" : "text-slate-700"}`}>
                        {tab.label}
                      </strong>
                      <span className="text-xs text-slate-500">
                        {tab.sub}
                      </span>
                    </div>
                  </div>
                  <i
                    className={`bi bi-chevron-right text-xs transition-transform ${
                      active ? "translate-x-0 text-brand-500" : "-translate-x-1 text-slate-400 opacity-0 group-hover:opacity-100"
                    }`}
                  ></i>
                </button>
              );
            })}
          </div>

          {/* Sisi Kanan: Live Playground Preview Card */}
          <div className="lg:col-span-8">
            <div className="overflow-hidden rounded-3xl border border-border/90 bg-white shadow-card transition-colors duration-200">
              {/* Header Bar Console */}
              <div className="flex h-14 items-center justify-between border-b border-border/80 px-6 text-xs font-semibold text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  <span className="font-bold text-slate-800">belajar.skuy</span>
                  <span className="text-slate-400">•</span>
                  <span>{isId ? "Konsol Interaktif" : "Interactive Console"}</span>
                </div>
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-brand-600">
                  Live Preview
                </span>
              </div>

              {/* Konten Play Area Berdasarkan Tab */}
              <div className="p-6 sm:p-8">
                {activeFeature === "materi" && (
                  <div className="space-y-6">
                    {/* Topic Switcher Dropdown */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <label htmlFor="topic-select" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {isId ? "Pilih contoh materi:" : "Select topic sample:"}
                      </label>
                      <select
                        id="topic-select"
                        value={activeTopic}
                        onChange={(e) => {
                          setActiveTopic(e.target.value as TopicKey);
                          setSelectedAnswer(null);
                        }}
                        className="rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="communication">{TOPICS.communication.name[lang]}</option>
                        <option value="react">{TOPICS.react.name[lang]}</option>
                        <option value="ecosystem">{TOPICS.ecosystem.name[lang]}</option>
                      </select>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-surface-2/60 p-5">
                      <h3 className="text-xl font-bold text-slate-900">
                        {currentTopic.title[lang]}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {currentTopic.body[lang]}
                      </p>
                    </div>

                    {/* Konsep Kunci */}
                    <div className="rounded-2xl border-l-4 border-brand-500 bg-brand-50/50 p-4">
                      <strong className="block text-sm font-bold text-brand-900">
                        {currentTopic.concept[lang]}
                      </strong>
                      <p className="mt-1 text-xs text-brand-700">
                        {currentTopic.example[lang]}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-slate-500">
                        {isId ? "Sudah paham intinya?" : "Got the core idea?"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveFeature("kuis")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-600"
                      >
                        <span>{isId ? "Uji dengan Kuis" : "Test with Quiz"}</span>
                        <i className="bi bi-arrow-right"></i>
                      </button>
                    </div>
                  </div>
                )}

                {activeFeature === "kuis" && (
                  <div className="space-y-5">
                    <div>
                      <span className="text-xs font-semibold text-brand-500">
                        {currentTopic.name[lang]}
                      </span>
                      <h3 className="mt-1 text-lg sm:text-xl font-bold text-slate-900">
                        {currentTopic.question[lang]}
                      </h3>
                    </div>

                    <div className="space-y-2.5">
                      {currentTopic.options.map((opt, i) => {
                        const letter = String.fromCharCode(65 + i);
                        const isChosen = selectedAnswer === i;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setSelectedAnswer(i)}
                            className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
                              isChosen
                                ? "border-brand-500 bg-brand-50/70"
                                : "border-border/80 bg-surface-2 hover:border-slate-400"
                            }`}
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                                isChosen
                                  ? "bg-brand-500 text-white"
                                  : "bg-border/60 text-slate-600"
                              }`}
                            >
                              {letter}
                            </span>
                            <span className="text-sm font-medium text-slate-800">
                              {opt[lang]}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Feedback Explanation */}
                    {selectedAnswer !== null && (
                      <div
                        className={`rounded-2xl p-4 text-xs sm:text-sm ${
                          selectedAnswer === currentTopic.correct
                            ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                            : "bg-amber-50 text-amber-900 border border-amber-200"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold mb-1">
                          <i
                            className={`bi ${
                              selectedAnswer === currentTopic.correct ? "bi-check-circle-fill text-emerald-600" : "bi-exclamation-circle-fill text-amber-600"
                            }`}
                          ></i>
                          <span>
                            {selectedAnswer === currentTopic.correct
                              ? isId ? "Tepat Sekali!" : "Spot on!"
                              : isId ? "Belum tepat." : "Not quite."}
                          </span>
                        </div>
                        <p className="leading-relaxed">{currentTopic.explanation[lang]}</p>
                      </div>
                    )}
                  </div>
                )}

                {activeFeature === "suara" && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                        {isId ? "Dengarkan contoh, lalu ulangi dengan gayamu." : "Listen first, then give it a try."}
                      </h3>
                      <p className="mt-1 text-xs sm:text-sm text-slate-500">
                        {isId
                          ? "Ketik kalimat yang ingin kamu latih dan dengarkan lafal audio otomatis:"
                          : "Type the sentence you wish to practice and listen to audio feedback:"}
                      </p>
                    </div>

                    <textarea
                      rows={3}
                      value={voiceText}
                      onChange={(e) => setVoiceText(e.target.value)}
                      className="w-full rounded-2xl border border-border bg-surface-2 p-4 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />

                    <div className="flex flex-wrap items-center gap-4">
                      <button
                        type="button"
                        onClick={handleListenExample}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md transition hover:bg-brand-600"
                      >
                        <i className="bi bi-volume-up-fill text-base"></i>
                        <span>{isId ? "Dengarkan Contoh" : "Listen to Sample"}</span>
                      </button>

                      {voiceStatus && (
                        <span className="text-xs font-semibold text-slate-600">
                          {voiceStatus}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {(activeFeature === "presentasi" || activeFeature === "wawancara") && (
                  <div className="space-y-6">
                    <div className="relative aspect-video max-h-[220px] w-full overflow-hidden rounded-2xl bg-slate-900/10 flex items-center justify-center">
                      <Image
                        src="/images/presentation-illustration.webp"
                        alt="Simulasi AI"
                        width={600}
                        height={350}
                        className="max-h-[200px] w-auto object-contain"
                      />
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-slate-900">
                        {activeFeature === "presentasi"
                          ? isId ? "Sampaikan satu ide dengan percaya diri." : "Share one idea with confidence."
                          : isId ? "Siapkan cerita pengalaman terbaikmu." : "Make your experience count in interviews."}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {activeFeature === "presentasi"
                          ? isId
                            ? "Berlatih memaparkan slide dengan deteksi ekspresi wajah, intonasi suara, dan teleprompter otomatis."
                            : "Practice presenting slides with real-time facial kinematics, audio cadence HUD, and auto-scrolling notes."
                          : isId
                            ? "Jawab pertanyaan situasional dari AI recruiter dan dapatkan evaluasi rubrik profesional instan."
                            : "Answer situational interview prompts from an AI recruiter with comprehensive rubric scoring."}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/60 pt-4">
                      <span className="text-xs text-slate-500">
                        {isId ? "Mulai dari simulasi 1 menit di bawah:" : "Start with a 1-minute practice below:"}
                      </span>
                      <a
                        href="#practice"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-600"
                      >
                        <span>{isId ? "Buka Sandbox Latihan" : "Open Practice Sandbox"}</span>
                        <i className="bi bi-arrow-down"></i>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

