"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { ChevronLeft } from "lucide-react";

interface PipelineTab {
  id: string;
  label: string;
  status: "active" | "placeholder";
}

export default function PipelineTabs({ pipelines }: { pipelines: PipelineTab[] }) {
  const segment = useSelectedLayoutSegment();

  return (
    <nav className="flex items-center justify-between border-b border-gray-200 pb-2">
      <Link
        href="/"
        className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to pipeline picker
      </Link>
      <div className="flex items-center gap-1">
        {pipelines.map((p) => {
          const active = segment === p.id;
          return (
            <Link
              key={p.id}
              href={`/pipelines/${p.id}`}
              className={`px-4 py-2 text-sm font-semibold rounded-t-md border-b-2 transition-colors ${
                active
                  ? "border-brand-600 text-brand-700 bg-brand-50"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              <span>{p.label}</span>
              {p.status === "placeholder" && (
                <span className="ml-2 text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                  Placeholder
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
