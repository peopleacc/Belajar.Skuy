// Util murni (tanpa React) untuk menormalkan content_body bab menjadi struktur materi
// bertingkat + menghitung jumlah langkah stepper. Dipakai bersama oleh komponen client
// (LearnRoom) dan server component (halaman course) agar perhitungan progres konsisten.

export type ExampleProblem = { problem: string; solution: string };

export type SectionNode = {
  title: string;
  explanation: string;
  formulas?: string[] | null;
  code_snippet?: string | null;
  example_problem?: ExampleProblem | null;
  subsections?: SectionNode[] | null;
};

export type OverviewBlock = {
  explanation: string;
  formulas?: string[] | null;
  code_snippet?: string | null;
  example_problem?: ExampleProblem | null;
};

// Fitur H — referensi (jurnal/web) yang disintesis jadi pembahasan bab.
export type Reference = {
  type: "jurnal" | "web";
  title: string;
  authors?: string | null;
  year?: number | null;
  url: string;
};

// Bentuk mentah body dari DB (bisa baru/rekursif, atau format lama).
type RawBody = {
  status?: string;
  // baru (rekursif)
  overview?: string;
  formulas?: string[] | null;
  code_snippet?: string | null;
  example_problem?: ExampleProblem | null;
  sections?: unknown[] | null;
  summary?: string;
  references?: Reference[] | null;
  // format Fitur E lama (flat, section_title)
  explanation?: string;
  example_case?: string;
} | null;

export type AdaptedContent = {
  overview: OverviewBlock;
  nodes: SectionNode[];
  summary: string;
  references: Reference[];
};

function asNode(raw: any): SectionNode {
  return {
    title: raw?.title ?? raw?.section_title ?? "Bagian",
    explanation: raw?.explanation ?? "",
    formulas: raw?.formulas ?? null,
    code_snippet: raw?.code_snippet ?? null,
    example_problem: raw?.example_problem ?? null,
    subsections: Array.isArray(raw?.subsections) ? raw.subsections.map(asNode) : [],
  };
}

/** Normalkan body (baru/lama) jadi { overview, nodes, summary, references }. */
export function adaptContent(body: RawBody): AdaptedContent {
  if (!body) {
    return { overview: { explanation: "Materi belum tersedia." }, nodes: [], summary: "", references: [] };
  }

  const references = Array.isArray(body.references) ? body.references : [];

  // Bentuk baru (rekursif): ada "overview"
  if (typeof body.overview === "string") {
    return {
      overview: {
        explanation: body.overview,
        formulas: body.formulas ?? null,
        code_snippet: body.code_snippet ?? null,
        example_problem: body.example_problem ?? null,
      },
      nodes: Array.isArray(body.sections) ? body.sections.map(asNode) : [],
      summary: body.summary ?? "",
      references,
    };
  }

  // Bentuk Fitur E (flat sections dgn section_title)
  if (Array.isArray(body.sections) && body.sections.length > 0) {
    return {
      overview: { explanation: "" },
      nodes: body.sections.map(asNode),
      summary: body.summary ?? "",
      references,
    };
  }

  // Bentuk paling lama { explanation, example_case, code_snippet }
  return {
    overview: {
      explanation: body.explanation ?? "Materi belum tersedia.",
      code_snippet: body.code_snippet ?? null,
    },
    nodes: [],
    summary: body.summary ?? "",
    references,
  };
}

function overviewHasContent(o: OverviewBlock): boolean {
  return Boolean(
    (o.explanation && o.explanation.trim().length > 0) ||
      (o.formulas && o.formulas.length > 0) ||
      o.example_problem
  );
}

/** Deskriptor langkah materi: 'overview' atau node subbab tingkat atas ke-index. */
export type MateriStep = { type: "overview" } | { type: "node"; index: number };

/** Bangun daftar langkah materi (overview + tiap subbab tingkat atas). Minimal 1 langkah. */
export function buildMateriSteps(adapted: AdaptedContent): MateriStep[] {
  const steps: MateriStep[] = [];
  if (overviewHasContent(adapted.overview)) steps.push({ type: "overview" });
  adapted.nodes.forEach((_, i) => steps.push({ type: "node", index: i }));
  if (steps.length === 0) steps.push({ type: "overview" });
  return steps;
}

/** Jumlah langkah materi untuk sebuah body (dipakai menghitung total_steps progres). */
export function materiStepCount(body: RawBody): number {
  return buildMateriSteps(adaptContent(body)).length;
}

// Catatan: getNodeTitleAtPath (Fitur P) DIHAPUS di planning-update-6 Fitur X — tidak ada lagi
// alamat `path` ke subbab karena generate ulang selalu di level BAB.
