import { useState } from "react";
import { FolderOpen, Search, Download, Loader2 } from "lucide-react";
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

      // Fetch summaries with regenerate flag
      const summaryResponse = await fetch(`${apiBaseUrl}/api/v1/summarize/folder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folderPath: folderPath.trim(),
          regenerate: true,
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
    } catch (err) {
      console.error("Error regenerating folder:", err);
      setError(
        err instanceof Error ? err.message : "Failed to regenerate folder structure"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (file: FileNode) => {
    setSelectedFile(file);
    setShowFileDetail(true);
  };

  const filteredFiles = rootDirectory
    ? flattenFiles(rootDirectory).filter((file) =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
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

      const generateSummary = (file: FileNode) => {
        if (file.isDirectory) {
          return `Folder containing ${file.children?.length || 0} items`;
        }

        const ext = file.name.split(".").pop()?.toLowerCase();
        const sizeStr = formatFileSize(file.size);

        if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext || "")) {
          return `Image file (${ext?.toUpperCase()}), ${sizeStr}`;
        } else if (["txt", "md"].includes(ext || "")) {
          return `Text document, ${sizeStr}`;
        } else if (["js", "jsx", "ts", "tsx"].includes(ext || "")) {
          return `JavaScript/TypeScript file, ${sizeStr}`;
        } else if (["json", "xml", "csv"].includes(ext || "")) {
          return `Data file (${ext?.toUpperCase()}), ${sizeStr}`;
        } else if (["pdf"].includes(ext || "")) {
          return `PDF document, ${sizeStr}`;
        } else if (["doc", "docx"].includes(ext || "")) {
          return `Word document, ${sizeStr}`;
        } else if (["xls", "xlsx"].includes(ext || "")) {
          return `Excel spreadsheet, ${sizeStr}`;
        } else {
          return `${ext?.toUpperCase() || "Unknown"} file, ${sizeStr}`;
        }
      };

      return {
        Name: file.name,
        Type: file.isDirectory ? "Folder" : getFileExtension(file.name),
        Size: formatFileSize(file.size),
        "Last Modified": formatDate(file.lastModified),
        Summary: generateSummary(file),
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

  const flattenFiles = (node: FileNode): FileNode[] => {
    let files: FileNode[] = [node];
    if (node.children) {
      node.children.forEach((child) => {
        files = files.concat(flattenFiles(child));
      });
    }
    return files;
  };

  if (showFileDetail && selectedFile) {
    return (
      <FileDetail
        file={selectedFile}
        onClose={() => setShowFileDetail(false)}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Virtual Data Room</h1>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleLoadFolder}
              disabled={isLoading}
              size="sm"
              variant="outline"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              {isLoading ? "Loading..." : "Load Folder"}
            </Button>
            <Button
              onClick={handleRegenerate}
              disabled={isLoading || !rootDirectory}
              size="sm"
              variant="outline"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              {isLoading ? "Loading..." : "Regenerate"}
            </Button>
          </div>
        </div>
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
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal">
            {/* Left Sidebar - Tree View */}
            <ResizablePanel defaultSize={25} minSize={15} maxSize={50}>
              <div className="h-full bg-white flex flex-col">
                <div className="p-4 border-b">
                  <h2 className="font-semibold text-gray-700 mb-2">Folder Structure</h2>
                  <p className="text-sm text-gray-500 truncate">{rootDirectory.path}</p>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    <TreeView
                      nodes={[rootDirectory]}
                      onFileSelect={handleFileSelect}
                      selectedPath={selectedFile?.path}
                    />
                  </div>
                </ScrollArea>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right Content - File List */}
            <ResizablePanel defaultSize={75}>
              <div className="h-full flex flex-col bg-white">
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
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}
    </div>
  );
}

export default App;