export type EditorTool = "select" | "wall" | "exit" | "waypoint" | "room" | "eraser";

interface ToolBarProps {
  activeTool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
  onClear: () => void;
  onAutoGrid: () => void;
}

const tools: Array<{ id: EditorTool; label: string; icon: string }> = [
  { id: "select", label: "Select", icon: "cursor" },
  { id: "wall", label: "Wall", icon: "wall" },
  { id: "room", label: "Room", icon: "room" },
  { id: "exit", label: "Exit", icon: "exit" },
  { id: "waypoint", label: "Waypoint", icon: "waypoint" },
  { id: "eraser", label: "Eraser", icon: "eraser" },
];

const ICONS: Record<string, JSX.Element> = {
  cursor: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
    </svg>
  ),
  wall: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
  ),
  room: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  ),
  exit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  ),
  waypoint: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <circle cx="12" cy="12" r="3" />
      <circle cx="5" cy="5" r="2" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="19" cy="19" r="2" />
      <line x1="7" y1="6" x2="10" y2="10" />
      <line x1="14" y1="10" x2="17" y2="6" />
      <line x1="14" y1="14" x2="17" y2="18" />
    </svg>
  ),
  eraser: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M20 20H7L3 16l9-9 8 8-4 4" />
      <line x1="6" y1="11" x2="13" y2="18" />
    </svg>
  ),
};

export default function ToolBar({ activeTool, onToolChange, onClear, onAutoGrid }: ToolBarProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-800 p-1.5">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onToolChange(tool.id)}
          title={tool.label}
          className={`rounded-md p-2 transition ${
            activeTool === tool.id
              ? "bg-emerald-600 text-white"
              : "text-gray-400 hover:bg-gray-700 hover:text-white"
          }`}
        >
          {ICONS[tool.icon]}
        </button>
      ))}

      <div className="mx-1.5 h-6 w-px bg-gray-700" />

      <button
        onClick={onAutoGrid}
        title="Auto Grid"
        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-400 transition hover:bg-gray-700 hover:text-white"
      >
        Auto Grid
      </button>

      <button
        onClick={onClear}
        title="Clear All"
        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-900/30 hover:text-red-300"
      >
        Clear
      </button>
    </div>
  );
}
