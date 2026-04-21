import PipelineTabs from "@/components/PipelineTabs";
import { listPipelines } from "@/lib/pipelines/registry";

export default function PipelinesLayout({ children }: { children: React.ReactNode }) {
  const pipelines = listPipelines().map((p) => ({
    id: p.id,
    label: p.label,
    status: p.status,
  }));

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <PipelineTabs pipelines={pipelines} />
        {children}
      </div>
    </main>
  );
}
