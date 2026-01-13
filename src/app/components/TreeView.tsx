import { ChevronRight, ChevronDown, Folder, File } from "lucide-react";
import { useState } from "react";

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  children?: FileNode[];
  size?: number;
  lastModified?: number;
}

interface TreeViewProps {
  nodes: FileNode[];
  onFileSelect: (node: FileNode) => void;
  selectedPath?: string;
  level?: number;
}

export function TreeView({ nodes, onFileSelect, selectedPath, level = 0 }: TreeViewProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const toggleDirectory = (path: string) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedDirs(newExpanded);
  };

  return (
    <div className="select-none">
      {nodes.map((node) => {
        const isExpanded = expandedDirs.has(node.path);
        const isSelected = selectedPath === node.path;

        return (
          <div key={node.path}>
            <div
              className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-gray-100 ${
                isSelected ? "bg-blue-50 text-blue-700" : ""
              }`}
              style={{ paddingLeft: `${level * 16 + 8}px` }}
              onClick={() => {
                if (node.isDirectory) {
                  toggleDirectory(node.path);
                } else {
                  onFileSelect(node);
                }
              }}
            >
              {node.isDirectory && (
                <span className="flex-shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </span>
              )}
              {!node.isDirectory && <span className="w-4" />}
              {node.isDirectory ? (
                <Folder className="w-4 h-4 flex-shrink-0 text-blue-500" />
              ) : (
                <File className="w-4 h-4 flex-shrink-0 text-gray-500" />
              )}
              <span className="truncate text-sm">{node.name}</span>
            </div>
            {node.isDirectory && isExpanded && node.children && (
              <TreeView
                nodes={node.children}
                onFileSelect={onFileSelect}
                selectedPath={selectedPath}
                level={level + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
