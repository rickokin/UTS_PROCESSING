import { notFound } from "next/navigation";
import { getPipeline, listPipelines } from "@/lib/pipelines/registry";
import PipelineFlow from "@/components/pipelines/PipelineFlow";

export function generateStaticParams() {
  return listPipelines().map((p) => ({ pipelineId: p.id }));
}

export default async function PipelinePage({
  params,
}: {
  params: Promise<{ pipelineId: string }>;
}) {
  const { pipelineId } = await params;
  const pipeline = getPipeline(pipelineId);
  if (!pipeline) notFound();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">{pipeline.label}</h1>
        <p className="mt-2 text-sm text-gray-500 max-w-3xl">{pipeline.shortDescription}</p>
      </header>
      <PipelineFlow pipeline={pipeline} />
    </div>
  );
}
