import { FileNode } from "./TreeView";
import { File as FileIcon, Folder } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { useState, useRef, useEffect } from "react";

interface FileListProps {
  files: FileNode[];
  onFileSelect: (node: FileNode) => void;
  selectedPath?: string;
}

export function FileList({ files, onFileSelect, selectedPath }: FileListProps) {
  const [columnWidths, setColumnWidths] = useState({
    icon: 50,
    name: 250,
    type: 100,
    size: 120,
    lastModified: 180,
    summary: 350,
    path: 300,
  });

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

  return (
    <div className="h-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead style={{ width: columnWidths.icon, position: "relative" }}>
              {/* Icon column - no resize */}
            </TableHead>
            <TableHead style={{ width: columnWidths.name, position: "relative" }}>
              Name
              <div
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 bg-gray-300"
                onMouseDown={(e) => handleMouseDown("name", e)}
              />
            </TableHead>
            <TableHead style={{ width: columnWidths.type, position: "relative" }}>
              Type
              <div
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 bg-gray-300"
                onMouseDown={(e) => handleMouseDown("type", e)}
              />
            </TableHead>
            <TableHead style={{ width: columnWidths.size, position: "relative" }}>
              Size
              <div
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 bg-gray-300"
                onMouseDown={(e) => handleMouseDown("size", e)}
              />
            </TableHead>
            <TableHead style={{ width: columnWidths.lastModified, position: "relative" }}>
              Last Modified
              <div
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 bg-gray-300"
                onMouseDown={(e) => handleMouseDown("lastModified", e)}
              />
            </TableHead>
            <TableHead style={{ width: columnWidths.summary, position: "relative" }}>
              Summary
              <div
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 bg-gray-300"
                onMouseDown={(e) => handleMouseDown("summary", e)}
              />
            </TableHead>
            <TableHead style={{ width: columnWidths.path, position: "relative" }}>
              Path
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow
              key={file.path}
              className={`cursor-pointer ${
                selectedPath === file.path ? "bg-blue-50" : ""
              }`}
              onClick={() => onFileSelect(file)}
            >
              <TableCell style={{ width: columnWidths.icon }}>
                {file.isDirectory ? (
                  <Folder className="w-5 h-5 text-blue-500" />
                ) : (
                  <FileIcon className="w-5 h-5 text-gray-500" />
                )}
              </TableCell>
              <TableCell style={{ width: columnWidths.name }} className="font-medium">
                {file.name}
              </TableCell>
              <TableCell style={{ width: columnWidths.type }}>
                {file.isDirectory ? "Folder" : getFileExtension(file.name)}
              </TableCell>
              <TableCell style={{ width: columnWidths.size }}>
                {formatFileSize(file.size)}
              </TableCell>
              <TableCell style={{ width: columnWidths.lastModified }}>
                {formatDate(file.lastModified)}
              </TableCell>
              <TableCell style={{ width: columnWidths.summary }} className="text-gray-600 text-sm">
                {generateSummary(file)}
              </TableCell>
              <TableCell style={{ width: columnWidths.path }} className="text-gray-500 text-sm truncate">
                {file.path}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}