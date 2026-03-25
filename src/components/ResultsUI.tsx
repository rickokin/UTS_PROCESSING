"use client";

import { Download, Printer } from "lucide-react";

export default function ResultsUI({ report }: { report: any }) {
  const downloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "insight_report.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden print:shadow-none print:border-none print:m-0 print:p-0">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 print:bg-white print:border-b-2 print:border-brand-100 print:mb-8 print:p-0 print:pb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 print:text-4xl print:font-extrabold print:tracking-tight">{report.title || "Insight Report"}</h3>
          <p className="text-sm text-gray-500 print:mt-2 print:text-xl print:font-medium">{report.subtitle}</p>
          <p className="hidden print:block print:mt-4 print:text-sm print:text-gray-400 font-medium">Generated: {new Date().toLocaleDateString()}</p>
        </div>
        <div className="flex space-x-3 print:hidden">
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 bg-brand-50 border border-brand-200 hover:bg-brand-100 text-brand-700 px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF</span>
          </button>
          <button
            onClick={downloadJson}
            className="flex items-center space-x-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0 print:space-y-12">
        {report.executive_summary && report.executive_summary.length > 0 && (
          <section className="print:break-inside-avoid">
            <h4 className="text-md font-semibold text-gray-900 mb-3 uppercase tracking-wider text-xs print:text-brand-600 print:font-bold">Executive Summary</h4>
            <div className="print:bg-gray-50 print:rounded-xl print:p-6 print:border print:border-gray-100">
              <ul className="space-y-2 text-gray-700">
                {report.executive_summary.map((insight: string, idx: number) => (
                  <li key={idx} className="flex items-start">
                    <span className="flex-shrink-0 h-1.5 w-1.5 mt-2 rounded-full bg-brand-500 mr-3 hidden print:block"></span>
                    <span className="print:hidden mr-2">•</span>
                    <span className="leading-relaxed">{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {report.key_insights && report.key_insights.length > 0 && (
          <section>
            <h4 className="text-md font-semibold text-gray-900 mb-4 uppercase tracking-wider text-xs print:text-brand-600 print:mb-6">Key Insights</h4>
            <div className="space-y-6 print:space-y-10">
              {report.key_insights.map((insightBlock: any, idx: number) => (
                <div key={idx} className="bg-gray-50 p-5 rounded-lg border border-gray-100 print:bg-transparent print:border-none print:p-0 print:break-inside-avoid">
                  <h5 className="font-bold text-lg text-brand-700 print:text-xl print:text-gray-900 print:leading-snug print:mb-5">{insightBlock.insight_statement}</h5>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 print:gap-6">
                    {insightBlock.quotes?.map((q: any, qIdx: number) => (
                      <blockquote key={qIdx} className="border-l-4 border-brand-200 pl-4 italic text-gray-600 print:bg-white print:p-5 print:rounded-lg print:border-brand-400 print:shadow-sm print:border-y print:border-r print:border-gray-100 print:text-sm">
                        <p className="mb-3 print:leading-relaxed">"{q.quote}"</p>
                        <footer className="mt-1 text-xs text-gray-400 font-medium print:uppercase print:tracking-wide print:font-semibold">
                          <span className="text-brand-600 mr-1 hidden print:inline">—</span>
                          <span className="print:hidden">— </span>
                          {q.speaker_role} <span className="hidden print:inline mx-1.5 text-gray-300">•</span><span className="print:hidden"> (</span>Ep. {q.episode_id}<span className="print:hidden">)</span>
                        </footer>
                      </blockquote>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {report.methodology && (
          <section className="print:break-inside-avoid print:mb-8">
            <h4 className="text-md font-semibold text-gray-900 mb-3 uppercase tracking-wider text-xs print:text-brand-600 print:mb-4">Methodology</h4>
            <div className="bg-brand-50 text-brand-900 p-4 rounded-lg text-sm print:bg-slate-50 print:border print:border-slate-200 print:rounded-xl print:p-6 print:grid print:grid-cols-3 print:gap-4 print:text-center print:text-slate-700">
              <div className="print:flex print:flex-col print:items-center print:justify-center">
                <p className="hidden print:block text-3xl font-black">{report.methodology.episodes_analyzed}</p>
                <p className="print:text-xs print:font-semibold print:text-slate-500 print:uppercase print:tracking-wider print:mt-1"><strong className="print:hidden">Total Episodes Analyzed:</strong> <span className="hidden print:inline">Episodes</span> <span className="print:hidden">{report.methodology.episodes_analyzed}</span></p>
              </div>
              <div className="print:flex print:flex-col print:items-center print:justify-center print:border-x print:border-slate-200">
                <p className="hidden print:block text-3xl font-black">{report.methodology.moments_segmented}</p>
                <p className="print:text-xs print:font-semibold print:text-slate-500 print:uppercase print:tracking-wider print:mt-1"><strong className="print:hidden">Total Moments Segmented:</strong> <span className="hidden print:inline">Moments</span> <span className="print:hidden">{report.methodology.moments_segmented}</span></p>
              </div>
              <div className="print:flex print:flex-col print:items-center print:justify-center">
                <p className="hidden print:block text-xl font-black mt-1">{report.methodology.confidence_threshold}</p>
                <p className="print:text-xs print:font-semibold print:text-slate-500 print:uppercase print:tracking-wider print:mt-2"><strong className="print:hidden">Confidence Threshold:</strong> <span className="hidden print:inline">Confidence</span> <span className="print:hidden">{report.methodology.confidence_threshold}</span></p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
