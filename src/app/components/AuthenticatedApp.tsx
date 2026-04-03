import { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { FolderOpen, Search, Download, Loader2, AlertCircle, RefreshCw, CheckCircle, RefreshCcw, ChevronLeft, ChevronRight, MessageSquare, Filter, LogOut, User } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { TreeView, FileNode } from "@/app/components/TreeView";
import { FileList } from "@/app/components/FileList";
import { FileDetail } from "@/app/components/FileDetail";
import { SemanticSearchResults, SemanticSearchResponse } from "@/app/components/SemanticSearchResults";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import ExcelJS from "exceljs";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/app/components/ui/resizable";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { apiConfig } from "@/authConfig";

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

export function AuthenticatedApp() {
  const { instance, accounts } = useMsal();
  const [accessToken, setAccessToken] = useState<string | null>(null);
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
  const [diffChecked, setDiffChecked] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarSize, setSidebarSize] = useState(25);

  // Semantic search state
  const [searchMode, setSearchMode] = useState<"filename" | "semantic">("filename");
  const [semanticSearchResult, setSemanticSearchResult] = useState<SemanticSearchResponse | null>(null);
  const [isSemanticSearching, setIsSemanticSearching] = useState(false);

  // Regenerate confirmation dialog state
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);

  // Get access token on mount and when accounts change
  useEffect(() => {
    const getToken = async () => {
      if (accounts[0]) {
        try {
          const response = await instance.acquireTokenSilent({
            ...apiConfig,
            account: accounts[0],
          });
          setAccessToken(response.accessToken);
        } catch (error) {
          if (error instanceof InteractionRequiredAuthError) {
            // Fallback to interactive method if silent fails
            try {
              const response = await instance.acquireTokenPopup({
                ...apiConfig,
                account: accounts[0],
              });
              setAccessToken(response.accessToken);
            } catch (err) {
              console.error("Failed to acquire token:", err);
            }
          }
        }
      }
    };

    getToken();
  }, [accounts, instance]);

  // Helper function to make authenticated API calls
  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    const headers = {
      "Content-Type": "application/json",
      ...(accessToken && { "Authorization": `Bearer ${accessToken}` }),
      ...options.headers,
    };

    return fetch(url, {
      ...options,
      headers,
    });
  };

  // Auto-check for changes when folder is loaded
  useEffect(() => {
    if (rootDirectory && !isLoading) {
      checkForChanges();
    }
  }, [rootDirectory?.path]);

  // Check if folder structure has changed
  const checkForChanges = async () => {
    if (!folderPath.trim()) {
      return;
    }

    setIsCheckingDiff(true);

    try {
      const diffResponse = await makeAuthenticatedRequest(`${apiBaseUrl}/api/v1/diff`, {
        method: "POST",
        body: JSON.stringify({
          folderPath: folderPath.trim(),
        }),
      });

      if (diffResponse.ok) {
        const diffData = await diffResponse.json();
        setHasChanges(diffData.changed === true);
        setDiffChecked(true);
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
      lastModified: apiNode.last_modified_time * 1000,
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
      const treeResponse = await makeAuthenticatedRequest(`${apiBaseUrl}/api/v1/tree`, {
        method: "POST",
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

      // Call combined summary and index API with regenerate=false and sync=true
      const summaryAndIndexResponse = await makeAuthenticatedRequest(`${apiBaseUrl}/api/v1/summary-and-index/folder`, {
        method: "POST",
        body: JSON.stringify({
          folderPath: folderPath.trim(),
          regenerate: false,
          sync: true,
        }),
      });

      let summaryData: SummarizeResponse = { summaries: [], duration: 0 };

      if (summaryAndIndexResponse.ok) {
        try {
          summaryData = await summaryAndIndexResponse.json();
        } catch (err) {
          console.warn("Failed to parse summary response, using fallback:", err);
        }
      } else {
        console.warn(`Summary and Index API returned ${summaryAndIndexResponse.status}, continuing without summaries`);
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
      // Step 1: Call combined summary and index API with regenerate=true and sync=false
      const summaryAndIndexResponse = await makeAuthenticatedRequest(`${apiBaseUrl}/api/v1/summary-and-index/folder`, {
        method: "POST",
        body: JSON.stringify({
          folderPath: folderPath.trim(),
          regenerate: true,
          sync: false,
        }),
      });

      if (!summaryAndIndexResponse.ok) {
        throw new Error(`Summary and Index API error: ${summaryAndIndexResponse.status} ${summaryAndIndexResponse.statusText}`);
      }

      const summaryData: SummarizeResponse = await summaryAndIndexResponse.json();

      // Step 2: Fetch tree structure with regenerate flag (last)
      const treeResponse = await makeAuthenticatedRequest(`${apiBaseUrl}/api/v1/tree`, {
        method: "POST",
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
      setHasChanges(false);
      setDiffChecked(false);
    } catch (err) {
      console.error("Error regenerating folder:", err);
      setError(
        err instanceof Error ? err.message : "Failed to regenerate folder structure"
      );
    } finally {
      setIsLoading(false);
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
      // Step 1: Call combined summary and index API with regenerate=false and sync=true
      const summaryAndIndexResponse = await makeAuthenticatedRequest(`${apiBaseUrl}/api/v1/summary-and-index/folder`, {
        method: "POST",
        body: JSON.stringify({
          folderPath: folderPath.trim(),
          regenerate: false,
          sync: true,
        }),
      });

      if (!summaryAndIndexResponse.ok) {
        throw new Error(`Summary and Index API error: ${summaryAndIndexResponse.status} ${summaryAndIndexResponse.statusText}`);
      }

      const summaryData: SummarizeResponse = await summaryAndIndexResponse.json();

      // Step 2: Fetch tree structure with regenerate flag
      const treeResponse = await makeAuthenticatedRequest(`${apiBaseUrl}/api/v1/tree`, {
        method: "POST",
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
      setHasChanges(false);
      setDiffChecked(false);
    } catch (err) {
      console.error("Error syncing folder:", err);
      setError(
        err instanceof Error ? err.message : "Failed to sync folder structure"
      );
    } finally {
      setIsLoading(false);
      checkForChanges();
    }
  };

  // Handle semantic search
  const handleSemanticSearch = async () => {
    if (!searchQuery.trim() || !folderPath.trim()) {
      return;
    }

    setIsSemanticSearching(true);
    setError(null);

    try {
      const response = await makeAuthenticatedRequest(`${apiBaseUrl}/api/v1/rag/query`, {
        method: "POST",
        body: JSON.stringify({
          question: searchQuery.trim(),
          folderPath: folderPath.trim(),
          topK: 4,
        }),
      });

      if (!response.ok) {
        throw new Error(`RAG API error: ${response.status} ${response.statusText}`);
      }

      const data: SemanticSearchResponse = await response.json();
      setSemanticSearchResult(data);
    } catch (err) {
      console.error("Error performing semantic search:", err);
      setError(
        err instanceof Error ? err.message : "Failed to perform semantic search"
      );
      setSemanticSearchResult(null);
    } finally {
      setIsSemanticSearching(false);
    }
  };

  // Handle search mode change
  const handleSearchModeChange = (newMode: "filename" | "semantic") => {
    setSearchMode(newMode);
    setSearchQuery("");
  };

  // Handle search input enter key
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      if (searchMode === "semantic") {
        handleSemanticSearch();
      }
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
          const hasSummary = summaries.some(s => s.filePath === file.path);
          const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
          return hasSummary && matchesSearch;
        })
    : [];

  const handleExportToExcel = async () => {
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

    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Virtual Data Room";
    workbook.created = new Date();

    // Add a worksheet
    const worksheet = workbook.addWorksheet("Files");

    // Define columns
    worksheet.columns = [
      { header: "Name", key: "name", width: 30 },
      { header: "Type", key: "type", width: 10 },
      { header: "Size", key: "size", width: 12 },
      { header: "Last Modified", key: "lastModified", width: 20 },
      { header: "Summary", key: "summary", width: 40 },
      { header: "Path", key: "path", width: 50 },
    ];

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Add data rows
    filteredFiles.forEach((file) => {
      const apiSummary = summaries.find(s => s.filePath === file.path);
      worksheet.addRow({
        name: file.name,
        type: file.isDirectory ? "Folder" : getFileExtension(file.name),
        size: formatFileSize(file.size),
        lastModified: formatDate(file.lastModified),
        summary: apiSummary?.summary || "No summary available",
        path: file.path,
      });
    });

    // Generate file name with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const fileName = `VDR_Export_${timestamp}.xlsx`;

    // Write to browser
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // Create download link
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();

    // Clean up
    URL.revokeObjectURL(link.href);
  };

  const handleLogout = () => {
    instance.logoutPopup();
  };

  const currentAccount = accounts[0];

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
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

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
                onClick={() => setShowRegenerateDialog(true)}
                disabled={isLoading}
                size="sm"
                variant="outline"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
            )}
          </div>
          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <User className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{currentAccount?.name || "User"}</p>
                  <p className="text-xs text-gray-500">{currentAccount?.username}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
        <div className="flex-1 overflow-hidden relative">
          <ResizablePanelGroup direction="horizontal">
            {/* Left Sidebar - Tree View */}
            <ResizablePanel
              defaultSize={sidebarSize}
              minSize={isSidebarCollapsed ? 0 : 15}
              maxSize={50}
              collapsible={true}
              onResize={(size) => {
                if (size > 0) {
                  setSidebarSize(size);
                }
              }}
              className={isSidebarCollapsed ? "!flex-grow-0 !flex-shrink-0 !basis-0" : ""}
            >
              <div className={`h-full bg-white flex flex-col overflow-hidden transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
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
                      title="Collapse sidebar"
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
            </ResizablePanel>

            <ResizableHandle withHandle className={isSidebarCollapsed ? "invisible" : "visible"} />

            {/* Toggle Button (when collapsed) */}
            {isSidebarCollapsed && (
              <div className="absolute left-2 top-4 z-10">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsSidebarCollapsed(false)}
                  className="shadow-md"
                  title="Expand sidebar"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Right Content - File List */}
            <ResizablePanel defaultSize={isSidebarCollapsed ? 100 : (100 - sidebarSize)}>
              <div className="h-full flex flex-col bg-white overflow-hidden">
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
                    {/* Search Mode Tabs */}
                    <Tabs value={searchMode} onValueChange={(value) => handleSearchModeChange(value as "filename" | "semantic")}>
                      <TabsList>
                        <TabsTrigger value="filename" className="flex items-center gap-2">
                          <Filter className="w-4 h-4" />
                          File Name
                        </TabsTrigger>
                        <TabsTrigger value="semantic" className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          Ask AI
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    {/* Search Input */}
                    <div className="flex-1 max-w-md relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder={
                          searchMode === "filename"
                            ? "Filter by file name..."
                            : "Ask a question about your files..."
                        }
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        className="pl-10"
                      />
                    </div>

                    {/* Search Button for Semantic Mode */}
                    {searchMode === "semantic" && (
                      <Button
                        onClick={handleSemanticSearch}
                        disabled={isSemanticSearching || !searchQuery.trim()}
                        size="sm"
                        variant="default"
                      >
                        {isSemanticSearching ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Searching...
                          </>
                        ) : (
                          <>
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Search
                          </>
                        )}
                      </Button>
                    )}

                    {/* File Count for File Name Mode */}
                    {searchMode === "filename" && (
                      <span className="text-sm text-gray-500">
                        {filteredFiles.length} items
                      </span>
                    )}

                    {/* Action Buttons */}
                    {searchMode === "filename" && (
                      <>
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
                      </>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  {searchMode === "filename" ? (
                    <FileList
                      files={filteredFiles}
                      summaries={summaries}
                      onFileSelect={handleFileSelect}
                      selectedPath={selectedFile?.path}
                    />
                  ) : (
                    <SemanticSearchResults
                      result={semanticSearchResult}
                      onFileSelect={handleFileSelect}
                      isLoading={isSemanticSearching}
                    />
                  )}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}

      {/* Regenerate Confirmation Dialog */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              Regenerate Folder Structure
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p className="text-gray-700 font-medium">
                This action will:
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-600 ml-2">
                <li>Regenerate all file summaries</li>
                <li>Rebuild the knowledge RAG index</li>
                <li>Update the entire folder structure</li>
              </ul>
              <p className="text-orange-600 font-medium pt-2">
                ⚠️ This process may take some time depending on the folder size.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowRegenerateDialog(false);
                handleRegenerate();
              }}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Proceed with Regeneration
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
