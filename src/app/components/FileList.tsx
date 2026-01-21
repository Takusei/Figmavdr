import { FileNode } from "./TreeView";
import { File as FileIcon, Folder, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { useState, useRef, useEffect } from "react";
import type { FileSummary } from "@/app/App";

interface FileListProps {
  files: FileNode[];
  summaries: FileSummary[];
  onFileSelect: (node: FileNode) => void;
  selectedPath?: string;
}

type SortColumn = "name" | "type" | "size" | "lastModified" | "summary" | "path";
type SortDirection = "asc" | "desc";

export function FileList({ files, summaries, onFileSelect, selectedPath }: FileListProps) {
  const [columnWidths, setColumnWidths] = useState({
    number: 50,
    icon: 40,
    name: 180,
    type: 80,
    size: 90,
    lastModified: 150,
    summary: 250,
    path: 200,
  });

  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [resizing, setResizing] = useState<string | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = (column: string, e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(column);
    startXRef.current = e.clientX;
    startWidthRef.current = columnWidths[column as keyof typeof columnWidths];
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing) return;

      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(50, startWidthRef.current + diff);

      setColumnWidths((prev) => ({
        ...prev,
        [resizing]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    if (resizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing]);

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
    // First check if we have a summary from the API
    const apiSummary = summaries.find(s => s.filePath === file.path);
    if (apiSummary && apiSummary.summary) {
      return apiSummary.summary;
    }

    // Fallback to generated summary
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

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedFiles = [...files].sort((a, b) => {
    if (!sortColumn) return 0;

    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case "name":
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case "type":
        aValue = a.isDirectory ? "folder" : getFileExtension(a.name).toLowerCase();
        bValue = b.isDirectory ? "folder" : getFileExtension(b.name).toLowerCase();
        break;
      case "size":
        aValue = a.size || 0;
        bValue = b.size || 0;
        break;
      case "lastModified":
        aValue = a.lastModified || 0;
        bValue = b.lastModified || 0;
        break;
      case "summary":
        aValue = generateSummary(a).toLowerCase();
        bValue = generateSummary(b).toLowerCase();
        break;
      case "path":
        aValue = a.path.toLowerCase();
        bValue = b.path.toLowerCase();
        break;
      default:
        return 0;
    }

    if (typeof aValue === "string" && typeof bValue === "string") {
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === "asc" ? comparison : -comparison;
    } else if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    }
    return 0;
  });

  return (
    <div className="h-full flex flex-col">
      {files.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500">
          <p>No files to display</p>
        </div>
      ) : (
        <>
          {/* Sticky Header */}
          <div className="flex-shrink-0 bg-white border-b shadow-sm overflow-x-auto">
            <table className="w-full" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: columnWidths.number }} />
                <col style={{ width: columnWidths.icon }} />
                <col style={{ width: columnWidths.name }} />
                <col style={{ width: columnWidths.type }} />
                <col style={{ width: columnWidths.size }} />
                <col style={{ width: columnWidths.lastModified }} />
                <col style={{ width: columnWidths.summary }} />
                <col style={{ width: columnWidths.path }} />
              </colgroup>
              <thead>
                <tr className="border-b">
                  <th className="text-left px-4 py-3 font-medium text-sm text-gray-700">
                    #
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-sm text-gray-700">
                    {/* Icon column */}
                  </th>
                  <th 
                    style={{ position: "relative", cursor: "pointer" }}
                    className="text-left px-4 py-3 font-medium text-sm text-gray-700"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      {sortColumn === "name" && (
                        sortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                      )}
                    </div>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 bg-gray-300"
                      onMouseDown={(e) => handleMouseDown("name", e)}
                    />
                  </th>
                  <th 
                    style={{ position: "relative", cursor: "pointer" }}
                    className="text-left px-4 py-3 font-medium text-sm text-gray-700"
                    onClick={() => handleSort("type")}
                  >
                    <div className="flex items-center gap-1">
                      Type
                      {sortColumn === "type" && (
                        sortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                      )}
                    </div>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 bg-gray-300"
                      onMouseDown={(e) => handleMouseDown("type", e)}
                    />
                  </th>
                  <th 
                    style={{ position: "relative", cursor: "pointer" }}
                    className="text-left px-4 py-3 font-medium text-sm text-gray-700"
                    onClick={() => handleSort("size")}
                  >
                    <div className="flex items-center gap-1">
                      Size
                      {sortColumn === "size" && (
                        sortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                      )}
                    </div>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 bg-gray-300"
                      onMouseDown={(e) => handleMouseDown("size", e)}
                    />
                  </th>
                  <th 
                    style={{ position: "relative", cursor: "pointer" }}
                    className="text-left px-4 py-3 font-medium text-sm text-gray-700"
                    onClick={() => handleSort("lastModified")}
                  >
                    <div className="flex items-center gap-1">
                      Last Modified
                      {sortColumn === "lastModified" && (
                        sortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                      )}
                    </div>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 bg-gray-300"
                      onMouseDown={(e) => handleMouseDown("lastModified", e)}
                    />
                  </th>
                  <th 
                    style={{ position: "relative", cursor: "pointer" }}
                    className="text-left px-4 py-3 font-medium text-sm text-gray-700"
                    onClick={() => handleSort("summary")}
                  >
                    <div className="flex items-center gap-1">
                      Summary
                      {sortColumn === "summary" && (
                        sortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                      )}
                    </div>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 bg-gray-300"
                      onMouseDown={(e) => handleMouseDown("summary", e)}
                    />
                  </th>
                  <th 
                    style={{ position: "relative", cursor: "pointer" }}
                    className="text-left px-4 py-3 font-medium text-sm text-gray-700"
                    onClick={() => handleSort("path")}
                  >
                    <div className="flex items-center gap-1">
                      Path
                      {sortColumn === "path" && (
                        sortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
            </table>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-auto">
            <table className="w-full" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: columnWidths.number }} />
                <col style={{ width: columnWidths.icon }} />
                <col style={{ width: columnWidths.name }} />
                <col style={{ width: columnWidths.type }} />
                <col style={{ width: columnWidths.size }} />
                <col style={{ width: columnWidths.lastModified }} />
                <col style={{ width: columnWidths.summary }} />
                <col style={{ width: columnWidths.path }} />
              </colgroup>
              <tbody>
                {sortedFiles.map((file, index) => (
                  <tr
                    key={file.path}
                    className={`border-b cursor-pointer hover:bg-gray-50 ${
                      selectedPath === file.path ? "bg-blue-50" : ""
                    }`}
                    onClick={() => onFileSelect(file)}
                  >
                    <td className="px-4 py-3 text-sm align-top">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 text-sm align-top">
                      {file.isDirectory ? (
                        <Folder className="w-5 h-5 text-blue-500" />
                      ) : (
                        <FileIcon className="w-5 h-5 text-gray-500" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium whitespace-normal break-words align-top">
                      {file.name}
                    </td>
                    <td className="px-4 py-3 text-sm align-top">
                      {file.isDirectory ? "Folder" : getFileExtension(file.name)}
                    </td>
                    <td className="px-4 py-3 text-sm align-top">
                      {formatFileSize(file.size)}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-normal break-words align-top">
                      {formatDate(file.lastModified)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-normal break-words align-top">
                      {generateSummary(file)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-normal break-words align-top">
                      {file.path}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}