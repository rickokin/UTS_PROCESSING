import Link from "next/link";
import { listPipelines } from "@/lib/pipelines/registry";
import SharedConfigPanel from "@/components/SharedConfigPanel";
import { ArrowRight, CircleDashed, Sparkles } from "lucide-react";

export default function Home() {
  const pipelines = listPipelines();

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
            Lived Experience Insights Engine
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            Documenting and amplifying women&rsquo;s lived experiences
          </p>
        </header>

        <SharedConfigPanel />

        <section>
          <h2 className="text-xl font-bold mb-4">Choose an Extraction Pipeline</h2>
          <p className="text-sm text-gray-500 mb-6">
            Each pipeline is independent — pick a tab to run it end-to-end on the transcripts in your
            configured upload directory. Outputs are written into a pipeline-specific subdirectory of
            your JSON output directory so results never collide.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pipelines.map((p) => {
              const isPlaceholder = p.status === "placeholder";
              return (
                <Link
                  key={p.id}
                  href={`/pipelines/${p.id}`}
                  className={`group relative rounded-xl border-2 p-6 transition-all bg-white ${
                    isPlaceholder
                      ? "border-amber-200 hover:border-amber-400"
                      : "border-gray-200 hover:border-brand-500 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      {isPlaceholder ? (
                        <CircleDashed className="w-5 h-5 text-amber-500" />
                      ) : (
                        <Sparkles className="w-5 h-5 text-brand-600" />
                      )}
                      <h3 className="text-lg font-bold">{p.label}</h3>
                    </div>
                    {isPlaceholder ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        Placeholder
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-4">{p.shortDescription}</p>
                  <div className="text-xs text-gray-500 mb-5">
                    {p.steps.length} step{p.steps.length === 1 ? "" : "s"} &middot;
                    {" "}
                    {p.capabilities.usesExternalResearch ? "uses external research" : "no external research"}
                    {" "}&middot;{" "}
                    {p.capabilities.usesDemographics ? "uses demographics" : "no demographics"}
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 group-hover:text-brand-800">
                    Open pipeline
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
