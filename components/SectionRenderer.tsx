"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { ExampleProblem, SectionNode, OverviewBlock } from "@/lib/content";

// Fitur F — render teks materi/soal dengan 3 kondisi otomatis:
// 1. Ada rumus LaTeX ($...$ / $$...$$) → dirender rapi via KaTeX.
// 2. Ada code_snippet → tampil sebagai code block.
// 3. Tidak ada keduanya → teks biasa (markdown ringan).
// Deteksi otomatis: tidak ada field "tipe". Tiap jenis konten punya container terpisah
// (penjelasan, rumus, kode, contoh soal) supaya kotaknya jelas berbeda.

export type { ExampleProblem, SectionNode } from "@/lib/content";

/**
 * Normalisasi teks LaTeX yang tersimpan dengan double backslash (mis. \\text, \\frac, \\sum)
 * akibat serialisasi JSON/escape ganda agar terbaca sebagai perintah LaTeX yang sah oleh KaTeX.
 * Pola [a-zA-Z]{2,}|{ memastikan perintah LaTeX dinormalkan tanpa merusak pemisah baris matriks
 * (\\ yang diikuti spasi, angka, atau variabel 1 huruf).
 */
function cleanLatex(text: string): string {
  if (typeof text !== "string") return text;
  return text.replace(/\\+([a-zA-Z]{2,}|{)/g, "\\$1");
}

/**
 * Render teks (explanation, question_text, options, dll) dengan Markdown + rumus KaTeX.
 * inline=true: paragraf dirender sebagai <span> supaya aman di dalam tombol/baris.
 */
export function MathText({
  children,
  className,
  inline = false,
}: {
  children: string;
  className?: string;
  inline?: boolean;
}) {
  const content = typeof children === "string" ? cleanLatex(children) : children;
  const md = (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={inline ? { p: ({ children }) => <>{children}</> } : undefined}
    >
      {content}
    </ReactMarkdown>
  );

  if (inline) {
    return <span className={className}>{md}</span>;
  }
  return (
    <div className={`prose-slate max-w-none text-sm leading-relaxed text-slate-700 ${className ?? ""}`}>
      {md}
    </div>
  );
}

/** Code block gelap untuk code_snippet. */
export function CodeBlock({ code }: { code: string }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-ink-900 shadow-card">
      <div className="border-b border-white/10 px-5 py-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-mint">⌨ Contoh Kode</span>
      </div>
      <pre className="overflow-x-auto p-5 text-xs leading-relaxed text-light">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Container rumus terkait (kotak indigo, dibedakan dari penjelasan & contoh soal). */
function FormulaContainer({ formulas }: { formulas: string[] }) {
  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-indigo-600">∑ Rumus Terkait</p>
      <div className="space-y-2">
        {formulas.map((f, i) => {
          let formula = (f ?? "").trim();
          // Jika rumus belum dibungkus delimiter KaTeX ($...$ atau $$...$$), bungkus dengan $$...$$
          if (formula && !formula.startsWith("$")) {
            formula = `$$${formula}$$`;
          }
          return (
            <div key={i} className="overflow-x-auto rounded-lg bg-white/80 px-4 py-2.5 text-center">
              <MathText>{formula}</MathText>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Kartu "Contoh Soal" (worked example): soal + pembahasan (kotak amber). */
function ExampleProblemCard({ example }: { example: ExampleProblem }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-600">📝 Contoh Soal</p>
      <MathText className="font-medium text-slate-800">{example.problem}</MathText>
      <div className="mt-3 border-t border-amber-200 pt-3">
        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-600">Pembahasan</p>
        <MathText className="text-slate-700">{example.solution}</MathText>
      </div>
    </div>
  );
}

/** Isi satu blok materi (penjelasan + rumus + kode + contoh soal), tanpa judul. */
function NodeBody({
  explanation,
  formulas,
  code_snippet,
  example_problem,
}: {
  explanation?: string;
  formulas?: string[] | null;
  code_snippet?: string | null;
  example_problem?: ExampleProblem | null;
}) {
  const hasCode = typeof code_snippet === "string" && code_snippet.trim().length > 0;
  const hasFormulas = Array.isArray(formulas) && formulas.length > 0;
  const ex = example_problem;
  return (
    <div className="space-y-4">
      {explanation && explanation.trim().length > 0 && <MathText>{explanation}</MathText>}
      {hasFormulas && <FormulaContainer formulas={formulas as string[]} />}
      {hasCode && <CodeBlock code={code_snippet as string} />}
      {ex && ex.problem && ex.solution && <ExampleProblemCard example={ex} />}
    </div>
  );
}

/** Blok pengantar bab (overview) — tanpa judul node. */
export function OverviewRenderer({ overview }: { overview: OverviewBlock }) {
  return <NodeBody {...overview} />;
}

/** Render satu node materi + seluruh subbab-nya secara REKURSIF (bertingkat).
 *  (Prop `path`/`onRegenerate` milik Fitur P dihapus di planning-update-6 Fitur X — generate
 *  ulang sekarang di level BAB, bukan per-subbab, jadi renderer ini murni presentasional lagi.) */
export default function SectionRenderer({
  node,
  depth = 0,
  hideTitle = false,
}: {
  node: SectionNode;
  depth?: number;
  hideTitle?: boolean; // sembunyikan judul level-atas kalau sudah ditampilkan di header
}) {
  const subs = Array.isArray(node.subsections) ? node.subsections : [];
  const headClass =
    depth === 0 ? "text-lg font-bold" : depth === 1 ? "text-base font-bold" : "text-sm font-bold";

  return (
    <div className={depth > 0 ? "border-l-2 border-slate-100 pl-4" : ""}>
      <div className="space-y-4">
        {!(hideTitle && depth === 0) && (
          <p className={`${headClass} text-slate-800`}>{node.title}</p>
        )}
        <NodeBody
          explanation={node.explanation}
          formulas={node.formulas}
          code_snippet={node.code_snippet}
          example_problem={node.example_problem}
        />
      </div>
      {subs.length > 0 && (
        <div className="mt-6 space-y-6">
          {subs.map((s, i) => (
            <SectionRenderer key={i} node={s} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
