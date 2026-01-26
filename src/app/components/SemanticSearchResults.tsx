import { FileNode } from "./TreeView";
import { File as FileIcon, MessageSquare, FileText, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import type { FileSummary } from "@/app/App";

export interface SemanticSearchResponse {
  question: string;
  answer: string;
  sources: Array<{
    content: string;
    metadata: Record<string, any>;
  }>;
  duration: number;
}

interface SemanticSearchResultsProps {
  result: SemanticSearchResponse | null;
  onFileSelect: (node: FileNode) => void;
  isLoading?: boolean;
}

export function SemanticSearchResults({ 
  result, 
  onFileSelect,
  isLoading = false 
}: SemanticSearchResultsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Searching...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Ask a Question
          </h3>
          <p className="text-gray-600">
            Use semantic search to find files by asking questions about their content.
            For example: "What documents discuss project timeline?"
          </p>
        </div>
      </div>
    );
  }

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

  const getFileExtension = (filename: string) => {
    const parts = filename.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "FILE";
  };

  const extractFilePathFromMetadata = (metadata: Record<string, any>): string | null => {
    // Try common metadata field names
    return metadata.file_path || metadata.filePath || metadata.path || metadata.source || null;
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Question Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Your Question
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-900">{result.question}</p>
        </CardContent>
      </Card>

      {/* Answer Card */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-green-600" />
            Answer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-900 whitespace-pre-wrap">{result.answer}</p>
          <div className="flex items-center gap-2 mt-4 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>Response time: {result.duration.toFixed(2)}s</span>
          </div>
        </CardContent>
      </Card>

      {/* Sources Card */}
      {result.sources && result.sources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileIcon className="w-5 h-5 text-gray-600" />
              Relevant Sources ({result.sources.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.sources.map((source, index) => {
              const filePath = extractFilePathFromMetadata(source.metadata);
              const fileName = filePath ? filePath.split("/").pop() || filePath : `Source ${index + 1}`;
              const fileExt = getFileExtension(fileName);

              return (
                <div
                  key={index}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => {
                    if (filePath) {
                      // Create a FileNode from the metadata to pass to onFileSelect
                      const fileNode: FileNode = {
                        name: fileName,
                        path: filePath,
                        isDirectory: false,
                        size: source.metadata.fileSize || source.metadata.file_size,
                        lastModified: source.metadata.lastModifiedTime || source.metadata.last_modified_time,
                      };
                      onFileSelect(fileNode);
                    }
                  }}
                >
                  <div className="flex items-start gap-3 mb-2">
                    <FileIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-gray-900 break-words">
                          {fileName}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {fileExt}
                        </Badge>
                        {source.metadata.fileSize && (
                          <span className="text-xs text-gray-500">
                            {formatFileSize(source.metadata.fileSize || source.metadata.file_size)}
                          </span>
                        )}
                      </div>
                      {filePath && (
                        <p className="text-xs text-gray-500 mt-1 break-all">
                          {filePath}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Content Excerpt */}
                  <div className="bg-gray-100 rounded p-3 mt-2">
                    <p className="text-sm text-gray-700 line-clamp-4">
                      {source.content}
                    </p>
                  </div>

                  {/* Metadata */}
                  {Object.keys(source.metadata).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(source.metadata).map(([key, value]) => {
                        // Skip already displayed metadata
                        if (
                          key === "file_path" || 
                          key === "filePath" || 
                          key === "path" || 
                          key === "source" ||
                          key === "fileSize" ||
                          key === "file_size"
                        ) {
                          return null;
                        }
                        
                        return (
                          <Badge key={key} variant="secondary" className="text-xs">
                            {key}: {typeof value === "object" ? JSON.stringify(value) : String(value)}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* No Sources Message */}
      {(!result.sources || result.sources.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No source files were referenced for this answer.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
