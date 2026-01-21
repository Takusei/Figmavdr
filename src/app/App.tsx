import { useState, useEffect } from "react";
import { FolderOpen, Search, Download, Loader2, AlertCircle, RefreshCw, CheckCircle, RefreshCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { TreeView, FileNode } from "@/app/components/TreeView";
import { FileList } from "@/app/components/FileList";
import { FileDetail } from "@/app/components/FileDetail";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import * as XLSX from "xlsx";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/app/components/ui/resizable";

interface ApiFileNode {
  file_path: string;
  file_name: string;
  file_size: number;
  last_modified_time: number;
  file_type: string;
  children: ApiFileNode[] | null;
}

export interface FileSummary {
  filePath: string;
  fileName: string;
  fileSize: number;
  lastModifiedTime: number;
  fileType: string;
  summary: string;
  duration: number;
}

interface SummarizeResponse {
  summaries: FileSummary[];
  duration: number;
}

function App() {
  const [folderPath, setFolderPath] = useState("");
  const [rootDirectory, setRootDirectory] = useState<FileNode | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [showFileDetail, setShowFileDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<FileSummary[]>([]);
  const [apiBaseUrl, setApiBaseUrl] = useState("http://localhost:8000");
  const [hasChanges, setHasChanges] = useState(false);
  const [isCheckingDiff, setIsCheckingDiff] = useState(false);
  const [diffChecked, setDiffChecked] = useState(false); // Track if diff has been checked
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Auto-check for changes when folder is loaded
  useEffect(() => {
    if (rootDirectory && !isLoading) {
      checkForChanges();
    }
  }, [rootDirectory?.path]); // Only re-run when the path changes, not the entire object

  // Check if folder structure has changed
  const checkForChanges = async () => {
    if (!folderPath.trim()) {
      return;
    }

    setIsCheckingDiff(true);

    try {
      const diffResponse = await fetch(`${apiBaseUrl}/api/v1/diff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folderPath: folderPath.trim(),
        }),
      });

      if (diffResponse.ok) {
        const diffData = await diffResponse.json();
        setHasChanges(diffData.changed === true);
        setDiffChecked(true); // Mark diff as checked
      } else {
        console.warn(`Diff API returned ${diffResponse.status}, skipping check`);
      }
    } catch (err) {
      console.error("Error checking for changes:", err);
    } finally {
      setIsCheckingDiff(false);
    }
  };

  // Convert API response to FileNode structure
  const convertApiNodeToFileNode = (apiNode: ApiFileNode): FileNode => {
    return {
      name: apiNode.file_name,
      path: apiNode.file_path,
      isDirectory: apiNode.file_type === "directory",
      size: apiNode.file_size,
      lastModified: apiNode.last_modified_time * 1000, // Convert to milliseconds
      children: apiNode.children
        ? apiNode.children.map(convertApiNodeToFileNode)
        : undefined,
    };
  };

  // Fetch folder structure from API
  const handleLoadFolder = async () => {
    if (!folderPath.trim()) {
      setError("Please enter a folder path");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch tree structure
      const treeResponse = await fetch(`${apiBaseUrl}/api/v1/tree`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folderPath: folderPath.trim(),
          regenerate: false,
        }),
      });

      if (!treeResponse.ok) {
        throw new Error(`Tree API error: ${treeResponse.status} ${treeResponse.statusText}`);
      }

      const treeData: ApiFileNode[] = await treeResponse.json();

      if (!treeData || treeData.length === 0) {
        throw new Error("No data returned from tree API");
      }

      // Fetch summaries
      const summaryResponse = await fetch(`${apiBaseUrl}/api/v1/summarize/folder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folderPath: folderPath.trim(),
          regenerate: false,
        }),
      });

      let summaryData: SummarizeResponse = { summaries: [], duration: 0 };
      
      if (summaryResponse.ok) {
        try {
          summaryData = await summaryResponse.json();
        } catch (err) {
          console.warn("Failed to parse summary response, using fallback:", err);
        }
      } else {
        console.warn(`Summary API returned ${summaryResponse.status}, continuing without summaries`);
      }

      // Create root node
      const rootNode: FileNode = {
        name: folderPath.split("/").pop() || folderPath,
        path: folderPath,
        isDirectory: true,
        children: treeData.map(convertApiNodeToFileNode),
      };

      setRootDirectory(rootNode);
      setSummaries(summaryData.summaries);
      setError(null);
    } catch (err) {
      console.error("Error loading folder:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load folder structure"
      );
      setRootDirectory(null);
      setSummaries([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!folderPath.trim() || !rootDirectory) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch tree structure with regenerate flag
      const treeResponse = await fetch(`${apiBaseUrl}/api/v1/tree`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folderPath: folderPath.trim(),
          regenerate: true,
        }),
      });

      if (!treeResponse.ok) {
        throw new Error(`Tree API error: ${treeResponse.status} ${treeResponse.statusText}`);
      }

      const treeData: ApiFileNode[] = await treeResponse.json();

      // Fetch summaries with regenerate and sync flags
      const summaryResponse = await fetch(`${apiBaseUrl}/api/v1/summarize/folder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folderPath: folderPath.trim(),
          regenerate: true,
          sync: true,
        }),
      });

      if (!summaryResponse.ok) {
        throw new Error(`Summary API error: ${summaryResponse.status} ${summaryResponse.statusText}`);
      }

      const summaryData: SummarizeResponse = await summaryResponse.json();

      // Create root node
      const rootNode: FileNode = {
        name: folderPath.split("/").pop() || folderPath,
        path: folderPath,
        isDirectory: true,
        children: treeData.map(convertApiNodeToFileNode),
      };

      setRootDirectory(rootNode);
      setSummaries(summaryData.summaries);
      setError(null);
      setHasChanges(false); // Reset changes flag after successful regeneration
      setDiffChecked(false); // Reset diff checked flag
    } catch (err) {
      console.error("Error regenerating folder:", err);
      setError(
        err instanceof Error ? err.message : "Failed to regenerate folder structure"
      );
    } finally {
      setIsLoading(false);
      // Re-check for changes after regeneration
      checkForChanges();
    }
  };

  const handleSync = async () => {
    if (!folderPath.trim() || !rootDirectory) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Fetch summaries with sync flag only
      const summaryResponse = await fetch(`${apiBaseUrl}/api/v1/summarize/folder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folderPath: folderPath.trim(),
          regenerate: false,
          sync: true,
        }),
      });

      if (!summaryResponse.ok) {
        throw new Error(`Summary API error: ${summaryResponse.status} ${summaryResponse.statusText}`);
      }

      const summaryData: SummarizeResponse = await summaryResponse.json();

      // Step 2: Fetch tree structure with regenerate flag
      const treeResponse = await fetch(`${apiBaseUrl}/api/v1/tree`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folderPath: folderPath.trim(),
          regenerate: true,
        }),
      });

      if (!treeResponse.ok) {
        throw new Error(`Tree API error: ${treeResponse.status} ${treeResponse.statusText}`);
      }

      const treeData: ApiFileNode[] = await treeResponse.json();

      // Create root node
      const rootNode: FileNode = {
        name: folderPath.split("/").pop() || folderPath,
        path: folderPath,
        isDirectory: true,
        children: treeData.map(convertApiNodeToFileNode),
      };

      setRootDirectory(rootNode);
      setSummaries(summaryData.summaries);
      setError(null);
      setHasChanges(false); // Reset changes flag after successful sync
      setDiffChecked(false); // Reset diff checked flag
    } catch (err) {
      console.error("Error syncing folder:", err);
      setError(
        err instanceof Error ? err.message : "Failed to sync folder structure"
      );
    } finally {
      setIsLoading(false);
      // Step 3: Re-check for changes after sync (calls diff API)
      checkForChanges();
    }
  };

  const handleFileSelect = (file: FileNode) => {
    setSelectedFile(file);
    setShowFileDetail(true);
  };

  const flattenFiles = (node: FileNode): FileNode[] => {
    let files: FileNode[] = [node];
    if (node.children) {
      node.children.forEach((child) => {
        files = files.concat(flattenFiles(child));
      });
    }
    return files;
  };

  const filteredFiles = rootDirectory
    ? flattenFiles(rootDirectory)
        .filter((file) => {
          // Only include files that have summaries from the API
          const hasSummary = summaries.some(s => s.filePath === file.path);
          const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
          return hasSummary && matchesSearch;
        })
    : [];

  const handleExportToExcel = () => {
    // Prepare data for Excel export
    const exportData = filteredFiles.map((file) => {
      const formatFileSize = (bytes?: number) => {
        if (!bytes) return "—";
        const units = ["B", "KB", "MB", "GB", "TB"];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
          size /= 1024;
          unitIndex++;
        }
        return `${size.toFixed(2)} ${units[unitIndex]}`;
      };

      const formatDate = (timestamp?: number) => {
        if (!timestamp) return "—";
        return new Date(timestamp).toLocaleString();
      };

      const getFileExtension = (filename: string) => {
        const parts = filename.split(".");
        return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "—";
      };

      // Get the actual summary from API data
      const apiSummary = summaries.find(s => s.filePath === file.path);

      return {
        Name: file.name,
        Type: file.isDirectory ? "Folder" : getFileExtension(file.name),
        Size: formatFileSize(file.size),
        "Last Modified": formatDate(file.lastModified),
        Summary: apiSummary?.summary || "No summary available",
        Path: file.path,
      };
    });

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    worksheet["!cols"] = [
      { wch: 30 }, // Name
      { wch: 10 }, // Type
      { wch: 12 }, // Size
      { wch: 20 }, // Last Modified
      { wch: 40 }, // Summary
      { wch: 50 }, // Path
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Files");

    // Generate file name with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const fileName = `VDR_Export_${timestamp}.xlsx`;

    // Save file
    XLSX.writeFile(workbook, fileName);
  };

  if (showFileDetail && selectedFile) {
    return (
      <FileDetail
        file={selectedFile}
        summaries={summaries}
        onClose={() => setShowFileDetail(false)}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Loading Dialog */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop with blur */}
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
          
          {/* Loading Dialog */}
          <div className="relative bg-white rounded-lg shadow-2xl p-8 flex flex-col items-center gap-4 min-w-[300px]">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">Loading...</h3>
              <p className="text-sm text-gray-600 mt-1">Fetching folder structure and summaries</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-900 whitespace-nowrap">Virtual Data Room</h1>
          <div className="flex items-center gap-2 flex-1 max-w-2xl">
            <Input
              type="text"
              placeholder="Enter folder path..."
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isLoading) {
                  handleLoadFolder();
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={handleLoadFolder}
              disabled={isLoading || !folderPath.trim()}
              size="sm"
              variant="default"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              {isLoading ? "Loading..." : "Load"}
            </Button>
            {rootDirectory && (
              <Button
                onClick={handleRegenerate}
                disabled={isLoading}
                size="sm"
                variant="outline"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
            )}
          </div>
        </div>
        {error && (
          <p className="text-red-500 mt-2 text-sm">{error}</p>
        )}
      </header>

      {!rootDirectory ? (
        /* Welcome Screen */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <FolderOpen className="w-24 h-24 mx-auto mb-6 text-gray-400" />
            <h2 className="text-2xl font-semibold mb-3">Welcome to Virtual Data Room</h2>
            <p className="text-gray-600 mb-6">
              Enter a folder path to browse and manage your files.
              The API allows you to access and view your local files directly in the browser.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Enter folder path..."
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                className="pl-10"
              />
              <Button
                onClick={handleLoadFolder}
                disabled={isLoading}
                size="lg"
                variant="outline"
              >
                <FolderOpen className="w-5 h-5 mr-2" />
                Get Started
              </Button>
            </div>
            {error && (
              <p className="text-red-500 mt-2 text-sm">{error}</p>
            )}
          </div>
        </div>
      ) : (
        /* Main Content */
        <div className="flex-1 overflow-hidden relative flex">
          {/* Left Sidebar - Tree View (Collapsible Drawer) */}
          <div
            className={`bg-white border-r flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
              isSidebarCollapsed ? "w-0" : "w-80"
            }`}
          >
            <div className="p-4 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-700 mb-2">Folder Structure</h2>
                  <p className="text-sm text-gray-500 truncate">{rootDirectory.path}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarCollapsed(true)}
                  className="ml-2 flex-shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <div className="p-2">
                <TreeView
                  nodes={[rootDirectory]}
                  onFileSelect={handleFileSelect}
                  selectedPath={selectedFile?.path}
                />
              </div>
            </div>
          </div>

          {/* Toggle Button (when collapsed) */}
          {isSidebarCollapsed && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsSidebarCollapsed(false)}
              className="absolute left-2 top-4 z-10 shadow-md"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}

          {/* Right Content - File List */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {/* Change Detection Status Banner */}
            {diffChecked && hasChanges && (
              <div className="bg-orange-50 border-b border-orange-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-orange-900">Folder Structure Changed</h3>
                    <p className="text-xs text-orange-700 mt-0.5">
                      The folder structure has been modified. Click "Sync" to synchronize the data.
                    </p>
                  </div>
                  <Button
                    onClick={handleSync}
                    disabled={isLoading}
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <RefreshCcw className="w-3 h-3 mr-1" />
                    Sync
                  </Button>
                </div>
              </div>
            )}
            {diffChecked && !hasChanges && (
              <div className="bg-green-50 border-b border-green-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-green-900">Folder Structure Up to Date</h3>
                    <p className="text-xs text-green-700 mt-0.5">
                      No changes detected. The data is synchronized with the current folder structure.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="p-4 border-b">
              <div className="flex items-center gap-4">
                <h2 className="font-semibold text-gray-700">All Files</h2>
                <div className="flex-1 max-w-md relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <span className="text-sm text-gray-500">
                  {filteredFiles.length} items
                </span>
                <Button
                  onClick={checkForChanges}
                  variant="outline"
                  disabled={isCheckingDiff}
                  size="sm"
                >
                  {isCheckingDiff ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Check Changes
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleExportToExcel}
                  variant="outline"
                  disabled={filteredFiles.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export to Excel
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <FileList
                files={filteredFiles}
                summaries={summaries}
                onFileSelect={handleFileSelect}
                selectedPath={selectedFile?.path}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;