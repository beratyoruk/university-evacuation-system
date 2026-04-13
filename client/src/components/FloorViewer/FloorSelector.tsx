import { useAppStore } from "../../store/useAppStore";

interface FloorInfo {
  id: string;
  floorNumber: number;
  name: string;
}

interface FloorSelectorProps {
  floors: FloorInfo[];
  selectedFloorId: string | null;
  onSelectFloor: (floorId: string) => void;
}

/**
 * FloorSelector - Side panel for selecting building floors.
 *
 * Highlights the floor the user is currently on (detected via location).
 * Allows manual floor selection to view other floors in the 3D viewer.
 */
export default function FloorSelector({
  floors,
  selectedFloorId,
  onSelectFloor,
}: FloorSelectorProps) {
  const userLocation = useAppStore((s) => s.userLocation);
  const emergencyMode = useAppStore((s) => s.emergencyMode);

  // Sort floors by floor number descending (top floor first)
  const sortedFloors = [...floors].sort(
    (a, b) => b.floorNumber - a.floorNumber
  );

  return (
    <div className="flex w-16 flex-col items-center gap-1 border-r border-gray-700 bg-gray-900/90 py-3">
      <span className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        Floors
      </span>

      {sortedFloors.map((floor) => {
        const isSelected = floor.id === selectedFloorId;
        const isUserFloor = floor.id === userLocation?.floorId;

        return (
          <button
            key={floor.id}
            onClick={() => onSelectFloor(floor.id)}
            className={`
              relative flex h-10 w-10 items-center justify-center rounded-lg
              text-sm font-bold transition-all duration-200
              ${
                isSelected
                  ? emergencyMode
                    ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                    : "bg-primary-600 text-white shadow-lg shadow-primary-600/30"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
              }
            `}
            title={floor.name}
          >
            {floor.floorNumber}

            {/* User location indicator dot */}
            {isUserFloor && (
              <span
                className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-gray-900 ${
                  emergencyMode
                    ? "animate-pulse bg-red-400"
                    : "animate-pulse bg-blue-400"
                }`}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
