import { FileNode } from "./TreeView";
import { X, FileText, Image as ImageIcon, FileCode, File as FileIcon } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/app/components/ui/breadcrumb";
import { useState, useEffect } from "react";
import type { FileSummary } from "@/app/App";

interface FileDetailProps {
  file: FileNode;
  summaries: FileSummary[];
  onClose: () => void;
}

export function FileDetail({ file, summaries, onClose }: FileDetailProps) {
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"text" | "image" | "unsupported">("unsupported");

  useEffect(() => {
    loadFilePreview();
  }, [file]);

  const loadFilePreview = async () => {
    if (file.isDirectory) return;

    // Handle both FileSystemFileHandle (modern API) and File (fallback)
    let fileObj: File;
    
    // Check if handle has a 'getFile' method (FileSystemFileHandle) or is already a File object
    if (file.handle && typeof (file.handle as any).getFile === 'function') {
      // Modern API - handle is FileSystemFileHandle
      const fileHandle = file.handle as FileSystemFileHandle;
      fileObj = await fileHandle.getFile();
    } else {
      // Fallback method - handle is already a File object
      fileObj = file.handle as any;
    }

    // Determine preview type based on file extension
    const ext = file.name.split(".").pop()?.toLowerCase();
    
    if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(ext || "")) {
      setPreviewType("image");
      const url = URL.createObjectURL(fileObj);
      setFileContent(url);
    } else if (["txt", "json", "js", "jsx", "ts", "tsx", "css", "html", "md", "xml", "csv"].includes(ext || "")) {
      setPreviewType("text");
      const text = await fileObj.text();
      setFileContent(text);
    } else {
      setPreviewType("unsupported");
      setFileContent(null);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown";
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
    if (!timestamp) return "Unknown";
    return new Date(timestamp).toLocaleString();
  };

  const getPathSegments = () => {
    const segments = file.path.split("/").filter(Boolean);
    return segments;
  };

  const generateSummary = () => {
    // First check if we have a summary from the API
    const apiSummary = summaries.find(s => s.filePath === file.path);
    if (apiSummary && apiSummary.summary) {
      return apiSummary.summary;
    }

    // Fallback to generated summary
    if (file.isDirectory) {
      return `This is a directory containing ${file.children?.length || 0} items.`;
    }
    
    const ext = file.name.split(".").pop()?.toLowerCase();
    const sizeStr = formatFileSize(file.size);
    
    if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext || "")) {
      return `Image file (${ext?.toUpperCase()}) with size ${sizeStr}. Last modified on ${formatDate(file.lastModified)}.`;
    } else if (["txt", "md"].includes(ext || "")) {
      return `Text document with size ${sizeStr}. Last modified on ${formatDate(file.lastModified)}.`;
    } else if (["js", "jsx", "ts", "tsx"].includes(ext || "")) {
      return `JavaScript/TypeScript source code file with size ${sizeStr}. Last modified on ${formatDate(file.lastModified)}.`;
    } else if (["json", "xml", "csv"].includes(ext || "")) {
      return `Data file (${ext?.toUpperCase()}) with size ${sizeStr}. Last modified on ${formatDate(file.lastModified)}.`;
    } else {
      return `File with size ${sizeStr}. Last modified on ${formatDate(file.lastModified)}.`;
    }
  };

  const getFileIcon = () => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    
    if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(ext || "")) {
      return <ImageIcon className="w-8 h-8 text-blue-500" />;
    } else if (["js", "jsx", "ts", "tsx", "css", "html"].includes(ext || "")) {
      return <FileCode className="w-8 h-8 text-green-500" />;
    } else if (["txt", "md", "json", "xml", "csv"].includes(ext || "")) {
      return <FileText className="w-8 h-8 text-orange-500" />;
    } else {
      return <FileIcon className="w-8 h-8 text-gray-500" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-auto">
      {/* Header */}
      <div className="border-b bg-white sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {getFileIcon()}
            <h1 className="text-xl font-semibold">{file.name}</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Breadcrumb */}
        <div className="px-4 pb-4">
          <Breadcrumb>
            <BreadcrumbList>
              {getPathSegments().map((segment, index) => (
                <div key={index} className="flex items-center">
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    <BreadcrumbLink className={index === getPathSegments().length - 1 ? "font-semibold" : ""}>
                      {segment}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-6xl mx-auto">
        {/* Summary Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-2">Summary</h2>
          <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">
            {generateSummary()}
          </p>
        </div>

        {/* File Details */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-2">Details</h2>
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-medium">{file.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Type</p>
              <p className="font-medium">
                {file.isDirectory ? "Folder" : file.name.split(".").pop()?.toUpperCase() || "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Size</p>
              <p className="font-medium">{formatFileSize(file.size)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Last Modified</p>
              <p className="font-medium">{formatDate(file.lastModified)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-500">Full Path</p>
              <p className="font-medium break-all">{file.path}</p>
            </div>
          </div>
        </div>

        {/* Preview Section */}
        {!file.isDirectory && (
          <div>
            <h2 className="text-lg font-semibold mb-2">Preview</h2>
            <div className="border rounded-lg p-4 bg-white">
              {previewType === "image" && fileContent && (
                <img src={fileContent} alt={file.name} className="max-w-full h-auto rounded" />
              )}
              {previewType === "text" && fileContent && (
                <pre className="bg-gray-50 p-4 rounded overflow-auto max-h-96 text-sm">
                  <code>{fileContent}</code>
                </pre>
              )}
              {previewType === "unsupported" && (
                <div className="text-center py-12 text-gray-500">
                  <FileIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p>Preview not available for this file type</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}