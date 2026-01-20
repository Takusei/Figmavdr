import { ChevronRight, ChevronDown, Folder, File as FileIcon, ChevronsRight, ChevronsDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";

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
  expandedDirs?: Set<string>;
  onToggleDirectory?: (path: string) => void;
}

// Helper function to get all directory paths
const getAllDirectoryPaths = (nodes: FileNode[]): string[] => {
  const paths: string[] = [];
  const traverse = (nodeList: FileNode[]) => {
    nodeList.forEach(node => {
      if (node.isDirectory) {
        paths.push(node.path);
        if (node.children) {
          traverse(node.children);
        }
      }
    });
  };
  traverse(nodes);
  return paths;
};

export function TreeView({ nodes, onFileSelect, selectedPath, level = 0, expandedDirs: externalExpandedDirs, onToggleDirectory: externalToggleDirectory }: TreeViewProps) {
  const [internalExpandedDirs, setInternalExpandedDirs] = useState<Set<string>>(new Set());
  
  // Use external state if provided, otherwise use internal state
  const expandedDirs = externalExpandedDirs ?? internalExpandedDirs;
  const setExpandedDirs = externalToggleDirectory ? undefined : setInternalExpandedDirs;

  const toggleDirectory = (path: string) => {
    if (externalToggleDirectory) {
      externalToggleDirectory(path);
    } else {
      const newExpanded = new Set(expandedDirs);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      setInternalExpandedDirs(newExpanded);
    }
  };

  const expandAll = () => {
    const allPaths = getAllDirectoryPaths(nodes);
    if (externalToggleDirectory) {
      // If using external state, toggle each path
      allPaths.forEach(path => {
        if (!expandedDirs.has(path)) {
          externalToggleDirectory(path);
        }
      });
    } else {
      setInternalExpandedDirs(new Set(allPaths));
    }
  };

  const collapseAll = () => {
    if (externalToggleDirectory) {
      // If using external state, toggle each expanded path
      expandedDirs.forEach(path => {
        externalToggleDirectory(path);
      });
    } else {
      setInternalExpandedDirs(new Set());
    }
  };

  return (
    <div className="select-none">
      {level === 0 && (
        <div className="flex items-center gap-2 px-2 py-2 border-b bg-gray-50">
          <Button 
            size="sm" 
            variant="outline"
            onClick={expandAll}
            className="flex items-center gap-1 text-xs"
          >
            <ChevronsDown className="w-3 h-3" />
            Expand All
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={collapseAll}
            className="flex items-center gap-1 text-xs"
          >
            <ChevronsRight className="w-3 h-3" />
            Collapse All
          </Button>
        </div>
      )}
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
                <FileIcon className="w-4 h-4 flex-shrink-0 text-gray-500" />
              )}
              <span className="truncate text-sm">{node.name}</span>
            </div>
            {node.isDirectory && isExpanded && node.children && (
              <TreeView
                nodes={node.children}
                onFileSelect={onFileSelect}
                selectedPath={selectedPath}
                level={level + 1}
                expandedDirs={expandedDirs}
                onToggleDirectory={toggleDirectory}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}