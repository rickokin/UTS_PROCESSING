"use client";

import { useState, useEffect, useRef } from "react";
import { FolderSearch, FileText, CheckCircle, Loader2 } from "lucide-react";

export type FileState = {
  id: string;
  filename: string;
  filePath: string;
  status: "idle" | "parsing" | "segmenting" | "completed" | "error";
  error?: string;
  extractedText?: string;
  moments?: any[];
  progress?: number;
};

export default function UploadUI({
  onFilesProcessed,
  outputDir,
  uploadDir,
}: {
  onFilesProcessed: (files: FileState[]) => void;
  outputDir: string;
  uploadDir: string;
}) {
  const [files, setFiles] = useState<FileState[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  
  const cancelRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scanDirectory = async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      const res = await fetch("/api/list-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadDir }),
      });
      if (!res.ok) throw new Error("Failed to scan directory");
      const data = await res.json();
      
      if (data.files && data.files.length > 0) {
        const newFiles = data.files.map((f: any) => ({
          id: Math.random().toString(36).substring(7),
          filename: f.name,
          filePath: f.path,
          status: "idle",
        }));
        setFiles(newFiles);
        setSelectedFiles(new Set(newFiles.map((f: any) => f.id)));
      } else {
        setFiles([]);
        setSelectedFiles(new Set());
        setScanError(`No .docx files found in ${uploadDir}`);
      }
    } catch (err: any) {
      setScanError(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (uploadDir) {
        scanDirectory();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [uploadDir]);

  const handleCancel = () => {
    setIsCancelling(true);
    cancelRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const startProcessing = async () => {
    setIsProcessing(true);
    setIsCancelling(false);
    cancelRef.current = false;
    abortControllerRef.current = new AbortController();
    
    const filesToProcess = files.filter((f) => 
      (f.status === "idle" || f.status === "error") && selectedFiles.has(f.id)
    );

    if (filesToProcess.length === 0) {
      setIsProcessing(false);
      return;
    }

    const processResults: FileState[] = [];

    for (const fileState of filesToProcess) {
      if (cancelRef.current) break;

      try {
        // 1. Parse DOCX
        setFiles((prev) => prev.map((f) => (f.id === fileState.id ? { ...f, status: "parsing" } : f)));
        
        const parseRes = await fetch("/api/parse-docx", { 
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filePath: fileState.filePath }),
          signal: abortControllerRef.current?.signal
        });
        if (!parseRes.ok) throw new Error("Failed to parse document");
        const { text } = await parseRes.json();

        // 2. Extract & Tag
        setFiles((prev) => prev.map((f) => (f.id === fileState.id ? { ...f, status: "segmenting", progress: 0, extractedText: text } : f)));
        const segmentRes = await fetch("/api/phase1/segment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, episodeId: fileState.filename }),
          signal: abortControllerRef.current?.signal
        });
        if (!segmentRes.ok) throw new Error("Failed to extract & tag");
        if (!segmentRes.body) throw new Error("No response body");

        const reader = segmentRes.body.getReader();
        const decoder = new TextDecoder();
        let moments: any[] = [];
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Process any remaining data in buffer
            if (buffer.trim()) {
              let data;
              try {
                data = JSON.parse(buffer);
              } catch (e) {
                // Ignore final parse error
              }
              if (data) {
                if (data.type === "complete") moments = data.moments;
                else if (data.type === "error") throw new Error(data.error);
              }
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            
            let data;
            try {
              data = JSON.parse(line);
            } catch (e) {
              console.error("Failed to parse ndjson line:", line, e);
              continue;
            }

            if (data.type === "progress") {
              setFiles((prev) =>
                prev.map((f) => (f.id === fileState.id ? { ...f, progress: data.progress } : f))
              );
            } else if (data.type === "complete") {
              moments = data.moments;
            } else if (data.type === "error") {
              throw new Error(data.error);
            }
          }
        }

        // Save Tagged Moments directly
        await fetch("/api/save-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: fileState.filename,
            stage: "moments_tagged",
            data: moments,
            outputDir
          }),
          signal: abortControllerRef.current?.signal
        });

        const completedFile = { ...fileState, status: "completed" as const };
        setFiles((prev) => prev.map((f) => (f.id === fileState.id ? completedFile : f)));
        processResults.push(completedFile);
      } catch (error: any) {
        if (error.name === 'AbortError' || cancelRef.current) {
          setFiles((prev) => prev.map((f) => (f.id === fileState.id ? { ...f, status: "idle", progress: undefined, extractedText: undefined } : f)));
          break; // Stop processing further files
        } else {
          setFiles((prev) => prev.map((f) => (f.id === fileState.id ? { ...f, status: "error", error: error.message } : f)));
          processResults.push({ ...fileState, status: "error" as const, error: error.message });
        }
      }
    }
    
    const finalFiles = files.map((f) => {
      const processed = processResults.find(r => r.id === f.id);
      if (processed) return processed;
      return f;
    });
    
    if (!cancelRef.current && finalFiles.every(f => f.status === "completed" || f.status === "error") && finalFiles.length > 0) {
      if (finalFiles.every(f => f.status === "completed")) {
        onFilesProcessed(finalFiles as FileState[]);
      }
    }

    setIsProcessing(false);
    setIsCancelling(false);
  };

  const getProgress = (file: FileState) => {
    if (file.status === "segmenting" && file.progress !== undefined) {
      return Math.round(50 + (file.progress * 0.49));
    }
    const progressMap = {
      idle: 0,
      parsing: 50,
      segmenting: 50,
      completed: 100,
      error: 0,
    };
    return progressMap[file.status] || 0;
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col items-center justify-center space-y-4">
        <button
          onClick={scanDirectory}
          disabled={isScanning || isProcessing}
          className="flex items-center space-x-2 bg-brand-50 border border-brand-200 text-brand-700 hover:bg-brand-100 hover:border-brand-300 px-6 py-4 rounded-xl font-medium transition disabled:opacity-50 w-full justify-center"
        >
          {isScanning ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <FolderSearch className="w-6 h-6" />
          )}
          <span className="text-lg">Scan Directory for Transcripts</span>
        </button>
        {scanError && <p className="text-red-500 text-sm">{scanError}</p>}
      </div>

      {files.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={selectedFiles.size === files.length && files.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedFiles(new Set(files.map((f) => f.id)));
                  } else {
                    setSelectedFiles(new Set());
                  }
                }}
                disabled={isProcessing}
                className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 disabled:opacity-50 cursor-pointer"
                id="select-all"
              />
              <label htmlFor="select-all" className="text-sm font-medium text-gray-700 cursor-pointer">
                Select All
              </label>
            </div>
            <span className="text-sm text-gray-500">{files.length} transcripts found</span>
          </div>
          <ul className="divide-y divide-gray-200">
            {files.map((file) => (
              <li key={file.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(file.id)}
                    onChange={() => {
                      const newSelected = new Set(selectedFiles);
                      if (newSelected.has(file.id)) newSelected.delete(file.id);
                      else newSelected.add(file.id);
                      setSelectedFiles(newSelected);
                    }}
                    disabled={isProcessing || file.status === "parsing" || file.status === "segmenting" || file.status === "completed"}
                    className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 disabled:opacity-50 cursor-pointer"
                  />
                  <FileText className="w-6 h-6 text-brand-500 flex-shrink-0" />
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900 truncate max-w-[200px] sm:max-w-xs">
                      {file.filename}
                    </span>
                    {file.status !== "idle" && file.status !== "error" && (
                      <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                        {getProgress(file)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {file.status === "idle" && <span className="text-xs text-gray-500">Ready</span>}
                  {["parsing", "segmenting"].includes(file.status) && (
                    <span className="flex items-center text-xs text-brand-600">
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      {file.status.charAt(0).toUpperCase() + file.status.slice(1)}...
                    </span>
                  )}
                  {file.status === "completed" && (
                    <span className="flex items-center text-xs text-green-600">
                      <CheckCircle className="w-4 h-4 mr-1" /> Done
                    </span>
                  )}
                  {file.status === "error" && (
                    <span className="text-xs text-red-600 truncate max-w-[150px]" title={file.error}>
                      Error: {file.error}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
            {isProcessing && (
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-md font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCancelling ? "Cancelling..." : "Cancel"}
              </button>
            )}
            <button
              onClick={startProcessing}
              disabled={isProcessing || files.every((f) => f.status === "completed") || selectedFiles.size === 0}
              className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-md font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "Processing..." : "Process Transcripts"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
