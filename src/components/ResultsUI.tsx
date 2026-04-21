"use client";

import { Download, FileText } from "lucide-react";
import { useState } from "react";

const BRAND_PINK = "#E91E8C";

export default function ResultsUI({ report, pipelineId }: { report: any; pipelineId: string }) {
  const [downloading, setDownloading] = useState(false);

  const downloadJson = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(report, null, 2));
    const a = document.createElement("a");
    a.setAttribute("href", dataStr);
    a.setAttribute("download", "insight_report.json");
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/phase2/download-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report }),
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(report.title || "report").replace(/\s+/g, "_").toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      console.error("PDF download failed");
    } finally {
      setDownloading(false);
    }
  };

  const year = new Date().getFullYear();
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="mx-auto max-w-[850px] font-[Inter,sans-serif]"
      style={{ color: "#1A1A1A" }}
    >
      {/* Action buttons */}
      <div className="flex justify-end gap-3 mb-6 print:hidden">
        <button
          onClick={downloadPdf}
          disabled={downloading}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm shadow-sm transition-colors disabled:opacity-50"
        >
          <FileText className="w-4 h-4" />
          {downloading ? "Generating..." : "Download PDF"}
        </button>
        <button
          onClick={downloadJson}
          className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg font-medium text-sm shadow-sm transition-colors"
        >
          <Download className="w-4 h-4" />
          JSON
        </button>
      </div>

      {/* Report body */}
      <div className="bg-[#F5F5F5] rounded-xl overflow-hidden shadow-lg print:shadow-none print:rounded-none">
        {/* PAGE 1: Title + Executive Summary */}
        <div className="px-12 pt-10 pb-10">
          <div className="pr-28">
            <h1
              className="font-[Montserrat,sans-serif] text-4xl font-extrabold leading-tight mb-3"
              style={{ color: BRAND_PINK }}
            >
              {report.title || "Insight Report"}
            </h1>
            {report.subtitle && (
              <p className="text-[17px] leading-relaxed mb-5" style={{ color: "#555555" }}>
                {report.subtitle}
              </p>
            )}
            <p className="text-xs mb-4" style={{ color: "#888888" }}>
              Generated: {dateStr}
            </p>
            <div
              className="h-[3px] w-full mb-10"
              style={{ backgroundColor: BRAND_PINK }}
            />
          </div>

          {report.executive_summary && report.executive_summary.length > 0 && (
            <div>
              <SectionHeader>Executive Summary</SectionHeader>
              <div className="bg-white rounded-xl p-8">
                <ul className="space-y-4 list-none m-0 p-0">
                  {report.executive_summary.map((item: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span
                        className="flex-shrink-0 w-2 h-2 rounded-full mt-[7px]"
                        style={{ backgroundColor: BRAND_PINK }}
                      />
                      <span className="text-sm leading-relaxed" style={{ color: "#1A1A1A" }}>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* PAGE 2: Participant Demographics */}
        {report.participant_demographics && (
          <div className="px-12 pt-10 pb-10 border-t-2 border-gray-200/50">
            <SectionHeader>Participant Demographics</SectionHeader>

            {/* Summary stat cards - pink bg, white text */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <StatCard
                value={report.participant_demographics.total_participants}
                label="Participants"
              />
              <StatCard
                value={`${report.participant_demographics.age.min}\u2013${report.participant_demographics.age.max}`}
                label="Age Range"
              />
              <StatCard
                value={report.participant_demographics.ethnicity_breakdown.length}
                label="Ethnic Backgrounds"
              />
              <StatCard
                value={report.participant_demographics.geographic_scope.regions.length}
                label="Regions"
              />
            </div>

            {/* 3-column detail panels */}
            <div className="grid grid-cols-3 gap-3">
              {/* Age Distribution */}
              <div className="bg-white rounded-xl p-5">
                <PanelHeader>Age Distribution</PanelHeader>
                <div className="space-y-1.5">
                  {report.participant_demographics.age_brackets.map((b: any) => {
                    const maxCount = Math.max(
                      ...report.participant_demographics.age_brackets.map(
                        (x: any) => x.count
                      )
                    );
                    const pct = maxCount > 0 ? Math.round((b.count / maxCount) * 100) : 0;
                    return (
                      <div key={b.bracket} className="flex items-center gap-2">
                        <span
                          className="text-[11px] w-9 text-right tabular-nums"
                          style={{ color: "#555555" }}
                        >
                          {b.bracket}
                        </span>
                        <div className="flex-1 bg-gray-200 rounded-md h-3.5 overflow-hidden">
                          <div
                            className="h-full rounded-md"
                            style={{ width: `${pct}%`, backgroundColor: BRAND_PINK }}
                          />
                        </div>
                        <span
                          className="text-[11px] font-semibold w-5 text-right"
                          style={{ color: "#1A1A1A" }}
                        >
                          {b.count}
                        </span>
                      </div>
                    );
                  })}
                  <p className="text-[11px] mt-3" style={{ color: "#888888" }}>
                    Mean: {report.participant_demographics.age.mean} | Median:{" "}
                    {report.participant_demographics.age.median}
                  </p>
                </div>
              </div>

              {/* Ethnicity */}
              <div className="bg-white rounded-xl p-5">
                <PanelHeader>Ethnicity</PanelHeader>
                <div className="space-y-1">
                  {report.participant_demographics.ethnicity_breakdown.map(
                    (e: any) => (
                      <div
                        key={e.group}
                        className="flex items-center justify-between"
                      >
                        <span className="text-[13px]" style={{ color: "#1A1A1A" }}>
                          {e.group}
                        </span>
                        <span
                          className="text-[11px] font-medium"
                          style={{ color: "#555555" }}
                        >
                          {e.count} ({e.pct}%)
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Geographic Scope */}
              <div className="bg-white rounded-xl p-5">
                <PanelHeader>Geographic Scope</PanelHeader>
                <div className="flex gap-6 mb-3.5">
                  <div className="text-center">
                    <div
                      className="text-[22px] font-black"
                      style={{ color: "#1A1A1A" }}
                    >
                      {report.participant_demographics.geographic_scope.domestic_count}
                    </div>
                    <div className="text-[10px]" style={{ color: "#888888" }}>
                      US-Based
                    </div>
                  </div>
                  <div className="text-center">
                    <div
                      className="text-[22px] font-black"
                      style={{ color: "#1A1A1A" }}
                    >
                      {report.participant_demographics.geographic_scope.international_count}
                    </div>
                    <div className="text-[10px]" style={{ color: "#888888" }}>
                      International
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  {report.participant_demographics.geographic_scope.regions
                    .slice(0, 8)
                    .map((r: any) => (
                      <div
                        key={r.region}
                        className="flex items-center justify-between"
                      >
                        <span className="text-[13px]" style={{ color: "#1A1A1A" }}>
                          {r.region}
                        </span>
                        <span
                          className="text-[11px] font-semibold"
                          style={{ color: "#1A1A1A" }}
                        >
                          {r.count}
                        </span>
                      </div>
                    ))}
                  {report.participant_demographics.geographic_scope.regions.length >
                    8 && (
                    <p className="text-[11px] mt-1.5" style={{ color: "#888888" }}>
                      +{" "}
                      {report.participant_demographics.geographic_scope.regions
                        .length - 8}{" "}
                      more
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EXTERNAL VALIDATION SUMMARY */}
        {report.external_validation_summary && (
          <div className="px-12 pt-10 pb-10 border-t-2 border-gray-200/50">
            <SectionHeader>External Research Validation</SectionHeader>
            <div className="bg-white rounded-xl p-8 mb-6">
              <p className="text-sm leading-relaxed" style={{ color: "#1A1A1A" }}>
                {report.external_validation_summary.overview}
              </p>
            </div>
            <div className="grid grid-cols-5 gap-3">
              <ValidationStatCard
                value={report.external_validation_summary.supported_count}
                label="Supported"
                color="#16a34a"
              />
              <ValidationStatCard
                value={report.external_validation_summary.partially_supported_count}
                label="Partial"
                color="#ca8a04"
              />
              <ValidationStatCard
                value={report.external_validation_summary.not_supported_count}
                label="Not Supported"
                color="#dc2626"
              />
              <ValidationStatCard
                value={report.external_validation_summary.not_addressed_count}
                label="Not Addressed"
                color="#6b7280"
              />
              <ValidationStatCard
                value={report.external_validation_summary.novel_external_findings_count}
                label="Novel External"
                color={BRAND_PINK}
              />
            </div>
          </div>
        )}

        {/* KEY INSIGHTS */}
        {report.key_insights && report.key_insights.length > 0 && (
          <div className="px-12 pt-10 pb-10 border-t-2 border-gray-200/50">
            <SectionHeader>Key Insights</SectionHeader>
            <div className="space-y-9">
              {report.key_insights.map((insight: any, idx: number) => (
                <div key={idx}>
                  <p
                    className="text-[16px] font-semibold leading-relaxed mb-5"
                    style={{ color: "#1A1A1A", fontFamily: "Inter, sans-serif" }}
                  >
                    {insight.insight_statement}
                  </p>
                  <div className="grid grid-cols-2 gap-3.5">
                    {insight.quotes?.map((q: any, qIdx: number) => (
                      <div
                        key={qIdx}
                        className="rounded-xl p-6 flex flex-col justify-between"
                        style={{ backgroundColor: BRAND_PINK }}
                      >
                        <p className="text-[13px] italic leading-relaxed text-white mb-4">
                          &ldquo;{q.quote}&rdquo;
                        </p>
                        <div>
                          <p className="text-[11px] font-bold text-white uppercase m-0">
                            &mdash; {q.speaker_role}
                          </p>
                          <p
                            className="text-[10px] text-white uppercase mt-1 m-0"
                            style={{ letterSpacing: "0.5px" }}
                          >
                            Ep. {q.episode_id}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* METHODOLOGY */}
        {report.methodology && (
          <div className="px-12 pt-10 pb-10 border-t-2 border-gray-200/50">
            <SectionHeader>Methodology</SectionHeader>
            <div className="grid grid-cols-2 gap-3.5 mb-6">
              <div className="bg-white rounded-xl py-7 px-5 text-center">
                <div
                  className="font-[Montserrat,sans-serif] text-4xl font-black"
                  style={{ color: "#1A1A1A" }}
                >
                  {report.methodology.episodes_analyzed ?? "—"}
                </div>
                <div
                  className="font-[Montserrat,sans-serif] text-[9px] font-bold uppercase mt-2"
                  style={{ color: "#888888", letterSpacing: "2px" }}
                >
                  Episodes Analyzed
                </div>
              </div>
              <div className="bg-white rounded-xl py-7 px-5 text-center">
                <div
                  className="font-[Montserrat,sans-serif] text-4xl font-black"
                  style={{ color: "#1A1A1A" }}
                >
                  {report.methodology.moments_segmented ?? "—"}
                </div>
                <div
                  className="font-[Montserrat,sans-serif] text-[9px] font-bold uppercase mt-2"
                  style={{ color: "#888888", letterSpacing: "2px" }}
                >
                  Moments Segmented
                </div>
              </div>
            </div>
            {report.methodology.confidence_threshold && (
              <div className="bg-white rounded-xl py-5 px-7">
                <PanelHeader>Confidence Threshold</PanelHeader>
                <p
                  className="text-sm leading-relaxed m-0"
                  style={{ color: "#1A1A1A" }}
                >
                  {report.methodology.confidence_threshold}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div
          className="px-12 py-4 flex items-center justify-between border-t border-gray-200/60"
          style={{ backgroundColor: "#EEEEEE" }}
        >
          <span className="text-[10px]" style={{ color: "#888888" }}>
            Copyright &copy;{year} Under the Sisterhood, LLC All rights reserved.
          </span>
          <span
            className="font-[Montserrat,sans-serif] text-[10px] font-bold uppercase"
            style={{ color: "#888888", letterSpacing: "1px" }}
          >
            Under The Sisterhood
          </span>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-[Montserrat,sans-serif] text-xs font-bold uppercase mb-5 tracking-[3px]"
      style={{ color: BRAND_PINK }}
    >
      {children}
    </h2>
  );
}

function PanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="font-[Montserrat,sans-serif] text-[10px] font-bold uppercase mb-3.5 tracking-[2px]"
      style={{ color: "#555555" }}
    >
      {children}
    </h3>
  );
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div
      className="rounded-xl py-[18px] px-2.5 text-center"
      style={{ backgroundColor: BRAND_PINK }}
    >
      <div className="font-[Montserrat,sans-serif] text-[30px] font-black text-white">
        {value}
      </div>
      <div
        className="font-[Montserrat,sans-serif] text-[9px] font-bold text-white uppercase mt-1.5"
        style={{ letterSpacing: "2px" }}
      >
        {label}
      </div>
    </div>
  );
}

function ValidationStatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div
      className="rounded-xl py-[18px] px-2.5 text-center border-2"
      style={{ borderColor: color, backgroundColor: `${color}08` }}
    >
      <div
        className="font-[Montserrat,sans-serif] text-[30px] font-black"
        style={{ color }}
      >
        {value}
      </div>
      <div
        className="font-[Montserrat,sans-serif] text-[9px] font-bold uppercase mt-1.5"
        style={{ color, letterSpacing: "2px" }}
      >
        {label}
      </div>
    </div>
  );
}
