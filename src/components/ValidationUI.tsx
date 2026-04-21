"use client";

import { ChevronDown, ChevronRight, ExternalLink, AlertTriangle, CheckCircle, HelpCircle, XCircle, FileText, Download } from "lucide-react";
import { useState } from "react";

const BRAND_PINK = "#E91E8C";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  supported: { label: "Supported", color: "#16a34a", bg: "#f0fdf4", icon: CheckCircle },
  partially_supported: { label: "Partially Supported", color: "#ca8a04", bg: "#fefce8", icon: AlertTriangle },
  not_supported: { label: "Not Supported", color: "#dc2626", bg: "#fef2f2", icon: XCircle },
  not_addressed: { label: "Not Addressed", color: "#6b7280", bg: "#f9fafb", icon: HelpCircle },
};

interface ValidationData {
  locks_version: string;
  validation_id: string;
  external_source_summary: string;
  insight_validations: {
    insight_id: string;
    insight_title: string;
    validation_status: string;
    external_evidence_summary: string;
    alignment_notes: string;
    relevant_external_excerpts: string[];
  }[];
  insights_not_in_external: {
    insight_id: string;
    insight_title: string;
    gap_note: string;
  }[];
  external_findings_not_in_extracted: {
    finding_title: string;
    finding_summary: string;
    relevance_to_study: string;
    suggested_insight_type: string;
  }[];
  overall_alignment_summary: string;
  validation_notes: string;
}

export default function ValidationUI({ validation, pipelineId }: { validation: ValidationData; pipelineId: string }) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const statusCounts = validation.insight_validations.reduce(
    (acc, iv) => {
      acc[iv.validation_status] = (acc[iv.validation_status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const downloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/phase2/download-validation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validation }),
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "validation_report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      console.error("Validation PDF download failed");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const downloadJson = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(validation, null, 2));
    const a = document.createElement("a");
    a.setAttribute("href", dataStr);
    a.setAttribute("download", "validation_results.json");
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <button
          onClick={downloadPdf}
          disabled={downloadingPdf}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-colors disabled:opacity-50"
        >
          <FileText className="w-4 h-4" />
          {downloadingPdf ? "Generating..." : "Download PDF"}
        </button>
        <button
          onClick={downloadJson}
          className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg font-medium text-sm shadow-sm transition-colors"
        >
          <Download className="w-4 h-4" />
          JSON
        </button>
      </div>

      {/* Overall Summary */}
      <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
        <SectionHeader>External Research Validation</SectionHeader>
        <p className="text-sm text-gray-700 leading-relaxed mb-4">
          {validation.overall_alignment_summary}
        </p>
        <div className="text-xs text-gray-500 mb-4">
          Source: <span className="font-medium text-gray-700">{validation.external_source_summary}</span>
        </div>

        {/* Status Distribution */}
        <div className="grid grid-cols-4 gap-3">
          {(["supported", "partially_supported", "not_supported", "not_addressed"] as const).map((status) => {
            const cfg = STATUS_CONFIG[status];
            const count = statusCounts[status] || 0;
            return (
              <div key={status} className="rounded-lg p-3 text-center" style={{ backgroundColor: cfg.bg }}>
                <div className="text-2xl font-bold" style={{ color: cfg.color }}>{count}</div>
                <div className="text-[11px] font-medium mt-1" style={{ color: cfg.color }}>{cfg.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-Insight Validation Cards */}
      <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
        <SectionHeader>Insight-by-Insight Validation</SectionHeader>
        <div className="space-y-3">
          {validation.insight_validations.map((iv) => (
            <InsightValidationCard key={iv.insight_id} item={iv} />
          ))}
        </div>
      </div>

      {/* Insights Not in External Research */}
      {validation.insights_not_in_external.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
          <SectionHeader>Insights Not Found in External Research</SectionHeader>
          <p className="text-xs text-gray-500 mb-4">
            These insights from the transcript analysis have no corresponding coverage in the external research document.
          </p>
          <div className="space-y-3">
            {validation.insights_not_in_external.map((item) => (
              <div key={item.insight_id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{item.insight_title}</p>
                    <p className="text-xs text-gray-500 mt-1">{item.gap_note}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* External Findings Not in Extracted Insights */}
      {validation.external_findings_not_in_extracted.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
          <SectionHeader>Novel Findings from External Research</SectionHeader>
          <p className="text-xs text-gray-500 mb-4">
            These substantive themes were found in the external research but are not captured by any of the extracted insights.
          </p>
          <div className="space-y-3">
            {validation.external_findings_not_in_extracted.map((item, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <ExternalLink className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: BRAND_PINK }} />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{item.finding_title}</p>
                    <p className="text-xs text-gray-600 mt-1">{item.finding_summary}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      <span className="font-medium">Relevance:</span> {item.relevance_to_study}
                    </p>
                    <span
                      className="inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${BRAND_PINK}15`, color: BRAND_PINK }}
                    >
                      {item.suggested_insight_type.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation Notes */}
      {validation.validation_notes && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <p className="text-xs text-gray-500 italic">{validation.validation_notes}</p>
        </div>
      )}
    </div>
  );
}

function InsightValidationCard({
  item,
}: {
  item: ValidationData["insight_validations"][number];
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[item.validation_status] || STATUS_CONFIG.not_addressed;
  const Icon = cfg.icon;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: cfg.color }} />
        <span className="text-sm font-medium text-gray-800 flex-1">
          {item.insight_title}
        </span>
        <span
          className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          {cfg.label}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              External Evidence
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              {item.external_evidence_summary}
            </p>
          </div>

          {item.alignment_notes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Alignment Notes
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                {item.alignment_notes}
              </p>
            </div>
          )}

          {item.relevant_external_excerpts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Excerpts from External Research
              </p>
              <div className="space-y-2">
                {item.relevant_external_excerpts.map((excerpt, idx) => (
                  <blockquote
                    key={idx}
                    className="text-xs text-gray-600 italic border-l-2 pl-3 py-1"
                    style={{ borderColor: BRAND_PINK }}
                  >
                    &ldquo;{excerpt}&rdquo;
                  </blockquote>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-[Montserrat,sans-serif] text-xs font-bold uppercase mb-4 tracking-[3px]"
      style={{ color: BRAND_PINK }}
    >
      {children}
    </h2>
  );
}
