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

interface FileListProps {
  files: FileNode[];
  onFileSelect: (node: FileNode) => void;
  selectedPath?: string;
}

export function FileList({ files, onFileSelect, selectedPath }: FileListProps) {
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
            <TableHead className="w-12"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Last Modified</TableHead>
            <TableHead>Summary</TableHead>
            <TableHead>Path</TableHead>
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
              <TableCell>
                {file.isDirectory ? (
                  <Folder className="w-5 h-5 text-blue-500" />
                ) : (
                  <FileIcon className="w-5 h-5 text-gray-500" />
                )}
              </TableCell>
              <TableCell className="font-medium">{file.name}</TableCell>
              <TableCell>
                {file.isDirectory ? "Folder" : getFileExtension(file.name)}
              </TableCell>
              <TableCell>{formatFileSize(file.size)}</TableCell>
              <TableCell>{formatDate(file.lastModified)}</TableCell>
              <TableCell className="text-gray-600 text-sm max-w-md">
                {generateSummary(file)}
              </TableCell>
              <TableCell className="text-gray-500 text-sm truncate max-w-xs">
                {file.path}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}