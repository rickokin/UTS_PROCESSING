"use client";

import { useState, useEffect, useRef } from "react";
import UploadUI, { FileState } from "@/components/UploadUI";
import ResultsUI from "@/components/ResultsUI";
import ValidationUI from "@/components/ValidationUI";
import { Loader2, UploadCloud, CheckCircle, FileSearch } from "lucide-react";

export default function Home() {
  const [phase1Files, setPhase1Files] = useState<FileState[]>([]);
  const [isClustering, setIsClustering] = useState(false);
  const [clusterProgress, setClusterProgress] = useState<{ stage: string; momentCount?: number } | null>(null);
  const [isAssembling, setIsAssembling] = useState(false);
  const [promotedClusters, setPromotedClusters] = useState<any[] | null>(null);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [outputDir, setOutputDir] = useState<string>("./output"); // default directory
  const [uploadDir, setUploadDir] = useState<string>("./uploads"); // default directory for transcripts

  const [hasMoments, setHasMoments] = useState(false);
  const [hasPromoted, setHasPromoted] = useState(false);
  const [isScanningDir, setIsScanningDir] = useState(false);

  const [demographicsStatus, setDemographicsStatus] = useState<
    { state: "idle" } | { state: "uploading" } | { state: "done"; filename: string; rowCount: number } | { state: "error"; message: string }
  >({ state: "idle" });
  const demographicsInputRef = useRef<HTMLInputElement>(null);

  const [researchStatus, setResearchStatus] = useState<
    { state: "idle" } | { state: "uploading" } | { state: "done"; filename: string; charCount: number } | { state: "error"; message: string }
  >({ state: "idle" });
  const researchInputRef = useRef<HTMLInputElement>(null);
  const [hasExternalResearch, setHasExternalResearch] = useState(false);
  const [hasValidation, setHasValidation] = useState(false);
  const [validationResults, setValidationResults] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const scanOutputDir = async () => {
      setIsScanningDir(true);
      setHasMoments(false);
      setHasPromoted(false);
      setHasExternalResearch(false);
      setHasValidation(false);
      setPromotedClusters(null);
      setValidationResults(null);
      setReport(null);

      try {
        const [momentsRes, promotedRes, validationRes] = await Promise.all([
          fetch("/api/phase2/read-moments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ outputDir }),
          }),
          fetch("/api/phase2/read-promoted", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ outputDir }),
          }),
          fetch("/api/phase2/read-validation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ outputDir }),
          })
        ]);

        if (promotedRes.ok) {
          const { insights } = await promotedRes.json();
          if (insights && insights.length > 0) {
            setHasPromoted(true);
          }
        }

        if (momentsRes.ok) {
          const { moments } = await momentsRes.json();
          if (moments && moments.length > 0) {
            setHasMoments(true);
          }
        }

        if (validationRes.ok) {
          const data = await validationRes.json();
          if (data.validation) {
            setHasValidation(true);
          }
          if (data.hasExternalResearch) {
            setHasExternalResearch(true);
          }
        }
      } catch (e) {
        console.error("Failed to scan output directory", e);
      } finally {
        setIsScanningDir(false);
      }
    };

    const timer = setTimeout(() => {
      if (outputDir) {
        scanOutputDir();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [outputDir]);

  const handleDemographicsUpload = async (file: File) => {
    setDemographicsStatus({ state: "uploading" });
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("outputDir", outputDir);

      const res = await fetch("/api/upload-demographics", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setDemographicsStatus({ state: "done", filename: file.name, rowCount: data.rowCount });
    } catch (err: any) {
      setDemographicsStatus({ state: "error", message: err.message });
    }
  };

  const handleResearchUpload = async (file: File) => {
    setResearchStatus({ state: "uploading" });
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("outputDir", outputDir);

      const res = await fetch("/api/upload-research", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setResearchStatus({ state: "done", filename: file.name, charCount: data.charCount });
      setHasExternalResearch(true);
    } catch (err: any) {
      setResearchStatus({ state: "error", message: err.message });
    }
  };

  const runValidation = async () => {
    setIsValidating(true);
    setError(null);
    try {
      const validateRes = await fetch("/api/phase2/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insights: promotedClusters, outputDir }),
      });
      if (!validateRes.ok) throw new Error("Failed to validate");
      const validateData = await validateRes.json();
      if (validateData.error) throw new Error(validateData.error);
      setValidationResults(validateData.validation);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsValidating(false);
    }
  };

  const loadExistingValidation = async () => {
    setIsValidating(true);
    setError(null);
    try {
      const res = await fetch("/api/phase2/read-validation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputDir }),
      });
      if (!res.ok) throw new Error("Failed to read validation");
      const data = await res.json();
      if (data.validation) {
        setValidationResults(data.validation);
      } else {
        throw new Error("No validation data found");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsValidating(false);
    }
  };

  const handlePhase1Complete = (files: FileState[]) => {
    setPhase1Files(files);
  };

  const clusterAndPromote = async () => {
    setIsClustering(true);
    setClusterProgress({ stage: "Reading moments from disk..." });
    setError(null);
    try {
      // 1. Read moments from disk
      const readRes = await fetch("/api/phase2/read-moments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputDir }),
      });
      if (!readRes.ok) throw new Error("Failed to read moments from disk");
      const { moments } = await readRes.json();

      if (!moments || moments.length === 0) {
        throw new Error("No tagged moments found in output directory. Make sure Phase 1 completed successfully.");
      }

      setClusterProgress({ stage: "Clustering moments...", momentCount: moments.length });

      // 2. Cluster
      const clusterRes = await fetch("/api/phase2/cluster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moments }),
      });
      if (!clusterRes.ok) throw new Error("Failed to cluster");
      const clusterData = await clusterRes.json();
      if (clusterData.error) throw new Error(clusterData.error);
      const clusters = clusterData.clusters;

      // Save clusters to disk explicitly as intermediate file
      await fetch("/api/save-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "clusters",
          data: clusters,
          outputDir
        })
      });

      setClusterProgress({ stage: "Promoting clusters to insights...", momentCount: moments.length });

      // 3. Promote
      const promoteRes = await fetch("/api/phase2/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clusters, moments }),
      });
      if (!promoteRes.ok) throw new Error("Failed to promote");
      const promoteData = await promoteRes.json();
      if (promoteData.error) throw new Error(promoteData.error);
      const insights = promoteData.insights;

      setClusterProgress({ stage: "Saving promoted clusters...", momentCount: moments.length });

      // Save promoted clusters to disk
      await fetch("/api/save-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "promoted",
          stage: "clusters",
          data: insights,
          outputDir
        })
      });

      // Also save as insights.json to store the intermediate insights file
      await fetch("/api/save-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "insights",
          data: insights,
          outputDir
        })
      });

      setPromotedClusters(insights);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsClustering(false);
      setClusterProgress(null);
    }
  };

  const loadPromotedClusters = async () => {
    setIsClustering(true);
    setClusterProgress({ stage: "Loading promoted clusters..." });
    setError(null);
    try {
      const res = await fetch("/api/phase2/read-promoted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputDir }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to read promoted clusters");
      }
      const { insights } = await res.json();
      setPromotedClusters(insights);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsClustering(false);
      setClusterProgress(null);
    }
  };

  const generateReport = async () => {
    setIsAssembling(true);
    setError(null);
    try {
      // Assemble
      const assembleRes = await fetch("/api/phase2/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insights: promotedClusters, outputDir }),
      });
      if (!assembleRes.ok) throw new Error("Failed to assemble");
      const assembleData = await assembleRes.json();
      if (assembleData.error) throw new Error(assembleData.error);
      const report = assembleData.report;

      // Save report to disk
      await fetch("/api/save-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "report",
          data: report,
          outputDir
        })
      });

      setReport(report);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAssembling(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
            Lived Experience Insights Engine
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            Documenting and amplifying women’s lived experiences
          </p>
        </header>

        {!report ? (
          <>
            <section className="mb-8 p-6 bg-white rounded-xl shadow border border-gray-200">
              <h2 className="text-xl font-bold mb-4">Configuration</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium text-gray-700">Transcript Directory</label>
                  <input 
                    type="text" 
                    value={uploadDir}
                    onChange={(e) => setUploadDir(e.target.value)}
                    className="border border-gray-300 rounded-md p-2 text-sm text-gray-900"
                    placeholder="./uploads"
                  />
                  <p className="text-xs text-gray-500">
                    The directory where your .docx transcripts are located.
                  </p>
                </div>
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium text-gray-700">JSON Output Directory</label>
                  <input 
                    type="text" 
                    value={outputDir}
                    onChange={(e) => setOutputDir(e.target.value)}
                    className="border border-gray-300 rounded-md p-2 text-sm text-gray-900"
                    placeholder="./output"
                  />
                  <p className="text-xs text-gray-500">
                    JSON results will be saved directly to this path.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <label className="text-sm font-medium text-gray-700">Participant Demographics (CSV)</label>
                <div className="mt-2 flex items-center gap-4">
                  <input
                    ref={demographicsInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleDemographicsUpload(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => demographicsInputRef.current?.click()}
                    disabled={demographicsStatus.state === "uploading"}
                    className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                  >
                    {demographicsStatus.state === "uploading" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UploadCloud className="w-4 h-4" />
                    )}
                    {demographicsStatus.state === "uploading" ? "Uploading..." : "Upload CSV"}
                  </button>
                  {demographicsStatus.state === "done" && (
                    <span className="flex items-center gap-1.5 text-sm text-green-700">
                      <CheckCircle className="w-4 h-4" />
                      {demographicsStatus.filename} — {demographicsStatus.rowCount} participants saved to {outputDir}/demographics.json
                    </span>
                  )}
                  {demographicsStatus.state === "error" && (
                    <span className="text-sm text-red-600">{demographicsStatus.message}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Upload a CSV with participant demographics to enrich the report with diversity context. If omitted, the report will be generated without demographic data.
                </p>
              </div>

              <div className="mt-6">
                <label className="text-sm font-medium text-gray-700">External Research Document (PDF, DOCX, or TXT)</label>
                <div className="mt-2 flex items-center gap-4">
                  <input
                    ref={researchInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleResearchUpload(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => researchInputRef.current?.click()}
                    disabled={researchStatus.state === "uploading"}
                    className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                  >
                    {researchStatus.state === "uploading" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileSearch className="w-4 h-4" />
                    )}
                    {researchStatus.state === "uploading" ? "Processing..." : "Upload Research Document"}
                  </button>
                  {researchStatus.state === "done" && (
                    <span className="flex items-center gap-1.5 text-sm text-green-700">
                      <CheckCircle className="w-4 h-4" />
                      {researchStatus.filename} — {researchStatus.charCount.toLocaleString()} characters extracted
                    </span>
                  )}
                  {researchStatus.state === "error" && (
                    <span className="text-sm text-red-600">{researchStatus.message}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Upload external research to validate extracted insights against published findings. If omitted, the validation step will be skipped.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">Phase 1: Scan & Process Transcripts</h2>
              <UploadUI onFilesProcessed={handlePhase1Complete} outputDir={outputDir} uploadDir={uploadDir} />
            </section>

            {(!promotedClusters && (phase1Files.length === 0 || phase1Files.every((f) => f.status === "completed"))) && (
              <section className="bg-white p-8 rounded-xl shadow border border-gray-200 flex flex-col items-center mt-8">
                <h2 className="text-xl font-bold mb-4">Phase 2a: Cluster & Promote</h2>
                <p className="text-gray-500 mb-6 text-center max-w-lg">
                  {isScanningDir ? (
                    <span className="flex items-center justify-center text-brand-600">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Scanning output directory...
                    </span>
                  ) : phase1Files.length > 0 ? (
                    "All files have been successfully segmented and tagged. The system will now clear memory, read the tagged moments from disk, cluster them, and promote them to insights for your review."
                  ) : (
                    hasMoments 
                      ? "Found tagged moment files in your JSON Output Directory. You can now cluster and promote them."
                      : hasPromoted
                        ? "Found existing promoted clusters in your JSON Output Directory. You can load them directly."
                        : "No tagged moment files found in your JSON Output Directory. Please complete Phase 1 first."
                  )}
                </p>
                {error && <p className="text-red-500 mb-4">{error}</p>}
                <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full justify-center">
                  <button
                    onClick={clusterAndPromote}
                    disabled={!isMounted || isClustering || isScanningDir || (!hasMoments && phase1Files.length === 0)}
                    suppressHydrationWarning
                    className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-lg font-medium shadow-sm disabled:opacity-50 flex flex-col items-center justify-center min-w-[320px]"
                  >
                    <span className="flex items-center">
                      {isClustering && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
                      {isClustering ? "Processing..." : "Cluster & Promote from Output Directory"}
                    </span>
                    {isClustering && clusterProgress && (
                      <span className="text-xs text-brand-200 mt-1 font-normal text-center block">
                        {clusterProgress.stage}
                        {clusterProgress.momentCount !== undefined && ` (${clusterProgress.momentCount} moments)`}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={loadPromotedClusters}
                    disabled={!isMounted || isClustering || isScanningDir || !hasPromoted}
                    suppressHydrationWarning
                    className="bg-white hover:bg-gray-50 text-brand-600 border border-brand-600 px-6 py-3 rounded-lg font-medium shadow-sm disabled:opacity-50 flex items-center justify-center"
                  >
                    Load Existing Promoted Clusters
                  </button>
                </div>
              </section>
            )}

            {promotedClusters && !validationResults && (
              <section className="bg-white p-8 rounded-xl shadow border border-gray-200 flex flex-col items-center">
                <h2 className="text-xl font-bold mb-4">Phase 2b: Validate Against External Research</h2>
                <p className="text-gray-500 mb-6 text-center max-w-lg">
                  {hasExternalResearch || researchStatus.state === "done"
                    ? "External research document is ready. You can now validate your insights against it, or skip to report assembly."
                    : "No external research document uploaded. You can upload one in the Configuration section above, or skip validation and proceed to report assembly."}
                </p>
                {error && <p className="text-red-500 mb-4">{error}</p>}
                <div className="flex flex-col sm:flex-row gap-4 mt-4">
                  <button
                    onClick={runValidation}
                    disabled={!isMounted || isValidating || (!hasExternalResearch && researchStatus.state !== "done")}
                    suppressHydrationWarning
                    className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-lg font-medium shadow-sm disabled:opacity-50 flex items-center justify-center min-w-[240px]"
                  >
                    {isValidating && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
                    {isValidating ? "Validating..." : "Validate Insights"}
                  </button>
                  {hasValidation && (
                    <button
                      onClick={loadExistingValidation}
                      disabled={!isMounted || isValidating}
                      suppressHydrationWarning
                      className="bg-white hover:bg-gray-50 text-brand-600 border border-brand-600 px-6 py-3 rounded-lg font-medium shadow-sm disabled:opacity-50 flex items-center justify-center"
                    >
                      Load Existing Validation
                    </button>
                  )}
                  <button
                    onClick={() => setValidationResults("skipped")}
                    disabled={!isMounted || isValidating}
                    suppressHydrationWarning
                    className="bg-white hover:bg-gray-50 text-gray-600 border border-gray-300 px-6 py-3 rounded-lg font-medium shadow-sm disabled:opacity-50 flex items-center justify-center"
                  >
                    Skip Validation
                  </button>
                </div>
              </section>
            )}

            {promotedClusters && validationResults && validationResults !== "skipped" && (
              <section className="mt-8">
                <h2 className="text-xl font-bold mb-4">Phase 2b: Validation Results</h2>
                <ValidationUI validation={validationResults} />
                <div className="flex justify-center mt-6">
                  <button
                    onClick={generateReport}
                    disabled={!isMounted || isAssembling}
                    suppressHydrationWarning
                    className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-lg font-medium shadow-sm disabled:opacity-50 flex items-center justify-center"
                  >
                    {isAssembling && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
                    {isAssembling ? "Assembling Report..." : "Proceed to Generate Report"}
                  </button>
                </div>
              </section>
            )}

            {promotedClusters && validationResults === "skipped" && (
              <section className="bg-white p-8 rounded-xl shadow border border-gray-200 flex flex-col items-center">
                <h2 className="text-xl font-bold mb-4">Phase 2c: Review & Assemble</h2>
                <p className="text-gray-500 mb-6 text-center max-w-lg">
                  Successfully clustered and promoted! Results saved to <strong>{outputDir}/promoted_clusters.json</strong> and <strong>{outputDir}/insights.json</strong>. Validation was skipped. Click below to generate the final report.
                </p>
                {error && <p className="text-red-500 mb-4">{error}</p>}
                <div className="flex flex-col sm:flex-row gap-4 mt-4">
                  <button
                    onClick={generateReport}
                    disabled={!isMounted || isAssembling}
                    suppressHydrationWarning
                    className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-lg font-medium shadow-sm disabled:opacity-50 flex items-center justify-center"
                  >
                    {isAssembling && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
                    {isAssembling ? "Assembling Report..." : "Generate Insight Report"}
                  </button>
                </div>
              </section>
            )}
          </>
        ) : (
          <section>
            <h2 className="text-xl font-bold mb-4 text-center">Final Insight Report</h2>
            <p className="text-gray-500 mb-6 text-center max-w-lg mx-auto">
              Successfully generated report! JSON Results saved to <strong>{outputDir}/report.json</strong>.
            </p>
            <ResultsUI report={report} />
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => {
                  setReport(null);
                  setPromotedClusters(null);
                  setValidationResults(null);
                  setPhase1Files([]);
                }}
                className="text-brand-600 hover:text-brand-800 font-medium"
              >
                Start Over
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
