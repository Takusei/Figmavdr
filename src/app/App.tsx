import { useState } from "react";
import { FolderOpen, Search, Download } from "lucide-react";
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

export default function App() {
  const [rootDirectory, setRootDirectory] = useState<FileNode | null>(null);
  const [allFiles, setAllFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [showFileDetail, setShowFileDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [usesFallback, setUsesFallback] = useState(false);

  // Build file tree from FileList (fallback method)
  const buildFileTree = (files: File[]): FileNode => {
    const root: FileNode = {
      name: "Selected Directory",
      path: "root",
      isDirectory: true,
      handle: null as any,
      children: [],
    };

    const nodeMap = new Map<string, FileNode>();
    nodeMap.set("root", root);

    // Sort files by path to ensure parents are created before children
    const sortedFiles = [...files].sort((a, b) => {
      const aPath = a.webkitRelativePath || a.name;
      const bPath = b.webkitRelativePath || b.name;
      return aPath.localeCompare(bPath);
    });

    sortedFiles.forEach((file) => {
      const relativePath = file.webkitRelativePath || file.name;
      const parts = relativePath.split("/");
      
      let currentPath = "root";
      
      // Create all parent directories
      for (let i = 0; i < parts.length - 1; i++) {
        const parentPath = currentPath;
        currentPath = currentPath === "root" ? parts[i] : `${currentPath}/${parts[i]}`;
        
        if (!nodeMap.has(currentPath)) {
          const dirNode: FileNode = {
            name: parts[i],
            path: currentPath,
            isDirectory: true,
            handle: null as any,
            children: [],
          };
          
          nodeMap.set(currentPath, dirNode);
          const parent = nodeMap.get(parentPath);
          if (parent && parent.children) {
            parent.children.push(dirNode);
          }
        }
      }
      
      // Add the file
      const fileName = parts[parts.length - 1];
      const filePath = currentPath === "root" ? fileName : `${currentPath}/${fileName}`;
      const fileNode: FileNode = {
        name: fileName,
        path: filePath,
        isDirectory: false,
        handle: file as any,
        size: file.size,
        lastModified: file.lastModified,
      };
      
      nodeMap.set(filePath, fileNode);
      const parent = nodeMap.get(currentPath);
      if (parent && parent.children) {
        parent.children.push(fileNode);
      }
    });

    // Sort all children (directories first, then alphabetically)
    const sortChildren = (node: FileNode) => {
      if (node.children) {
        node.children.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortChildren);
      }
    };
    sortChildren(root);

    return root;
  };

  const traverseDirectory = async (
    dirHandle: FileSystemDirectoryHandle,
    path: string = ""
  ): Promise<FileNode> => {
    const currentPath = path ? `${path}/${dirHandle.name}` : dirHandle.name;
    const children: FileNode[] = [];

    for await (const entry of dirHandle.values()) {
      if (entry.kind === "directory") {
        const subDir = await traverseDirectory(
          entry as FileSystemDirectoryHandle,
          currentPath
        );
        children.push(subDir);
      } else {
        const fileHandle = entry as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        children.push({
          name: entry.name,
          path: `${currentPath}/${entry.name}`,
          isDirectory: false,
          handle: fileHandle,
          size: file.size,
          lastModified: file.lastModified,
        });
      }
    }

    return {
      name: dirHandle.name,
      path: currentPath,
      isDirectory: true,
      handle: dirHandle,
      children: children.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      }),
    };
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

  const handleSelectDirectory = async () => {
    try {
      // Check if we're in an iframe
      const isInIframe = window.self !== window.top;
      
      // Try File System Access API first (if not in iframe and supported)
      if (!isInIframe && "showDirectoryPicker" in window) {
        setLoading(true);
        const dirHandle = await (window as any).showDirectoryPicker();
        const tree = await traverseDirectory(dirHandle);
        setRootDirectory(tree);
        
        const files = flattenFiles(tree);
        setAllFiles(files);
        setUsesFallback(false);
        setLoading(false);
      } else {
        // Fallback to traditional file input
        const input = document.createElement("input");
        input.type = "file";
        input.webkitdirectory = true;
        input.multiple = true;
        
        input.onchange = (e) => {
          const files = Array.from((e.target as HTMLInputElement).files || []);
          if (files.length > 0) {
            setLoading(true);
            const tree = buildFileTree(files);
            setRootDirectory(tree);
            
            const allFilesList = flattenFiles(tree);
            setAllFiles(allFilesList);
            setUsesFallback(true);
            setLoading(false);
          }
        };
        
        input.click();
      }
    } catch (error: any) {
      console.error("Error accessing directory:", error);
      
      // If File System Access API fails, fall back to file input
      if (error.name === "SecurityError" || error.name === "NotAllowedError") {
        const input = document.createElement("input");
        input.type = "file";
        input.webkitdirectory = true;
        input.multiple = true;
        
        input.onchange = (e) => {
          const files = Array.from((e.target as HTMLInputElement).files || []);
          if (files.length > 0) {
            setLoading(true);
            const tree = buildFileTree(files);
            setRootDirectory(tree);
            
            const allFilesList = flattenFiles(tree);
            setAllFiles(allFilesList);
            setUsesFallback(true);
            setLoading(false);
          }
        };
        
        input.click();
      }
      setLoading(false);
    }
  };

  const handleFileSelect = (file: FileNode) => {
    setSelectedFile(file);
    setShowFileDetail(true);
  };

  const filteredFiles = allFiles.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    worksheet['!cols'] = [
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const fileName = `VDR_Export_${timestamp}.xlsx`;

    // Save file
    XLSX.writeFile(workbook, fileName);
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
          <Button onClick={handleSelectDirectory} disabled={loading}>
            <FolderOpen className="w-4 h-4 mr-2" />
            {loading ? "Loading..." : "Select Directory"}
          </Button>
        </div>
      </header>

      {!rootDirectory ? (
        /* Welcome Screen */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <FolderOpen className="w-24 h-24 mx-auto mb-6 text-gray-400" />
            <h2 className="text-2xl font-semibold mb-3">Welcome to Virtual Data Room</h2>
            <p className="text-gray-600 mb-6">
              Select a directory from your local computer to browse and manage your files.
              The File System Access API allows you to access and view your local files directly in the browser.
            </p>
            <Button onClick={handleSelectDirectory} size="lg">
              <FolderOpen className="w-5 h-5 mr-2" />
              Get Started
            </Button>
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