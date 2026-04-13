import { useState, useEffect } from "react";
import { buildingsApi, type Building } from "../../api/buildings.api";
import { floorsApi, type Floor } from "../../api/floors.api";
import { exitsApi, type Exit, type ExitPayload } from "../../api/exits.api";

const EXIT_TYPE_LABELS: Record<string, string> = {
  emergency: "Emergency Exit",
  door: "Normal Door",
  staircase: "Staircase",
  elevator: "Elevator",
};

const EXIT_TYPE_COLORS: Record<string, string> = {
  emergency: "bg-emerald-600",
  door: "bg-blue-600",
  staircase: "bg-amber-600",
  elevator: "bg-violet-600",
};

export default function ExitEditor() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [exits, setExits] = useState<Exit[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState("");
  const [selectedFloor, setSelectedFloor] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExitPayload>({
    floorId: "",
    name: "",
    x: 0,
    y: 0,
    type: "door",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    buildingsApi.list().then((res) => setBuildings(res.data.data || []));
  }, []);

  useEffect(() => {
    if (!selectedBuilding) { setFloors([]); return; }
    floorsApi.listByBuilding(selectedBuilding).then((res) => setFloors(res.data.data || []));
  }, [selectedBuilding]);

  const fetchExits = async () => {
    if (!selectedFloor) { setExits([]); return; }
    setLoading(true);
    try {
      const res = await exitsApi.listByFloor(selectedFloor);
      setExits(res.data.data || []);
    } catch {
      setError("Failed to load exits");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExits();
  }, [selectedFloor]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ floorId: selectedFloor, name: "", x: 0, y: 0, type: "door", isActive: true });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (exit: Exit) => {
    setEditingId(exit.id);
    setForm({
      floorId: exit.floorId,
      name: exit.name,
      x: exit.x,
      y: exit.y,
      type: exit.type,
      isActive: exit.isActive,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await exitsApi.update(editingId, form);
      } else {
        await exitsApi.create(form);
      }
      setModalOpen(false);
      fetchExits();
    } catch {
      setError("Failed to save exit");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this exit?")) return;
    try {
      await exitsApi.delete(id);
      fetchExits();
    } catch {
      setError("Failed to delete exit");
    }
  };

  const toggleActive = async (exit: Exit) => {
    try {
      await exitsApi.update(exit.id, { isActive: !exit.isActive });
      fetchExits();
    } catch {
      setError("Failed to update exit");
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Exit Management</h1>
        <p className="mt-0.5 text-sm text-gray-500">Configure exit points for each floor</p>
      </div>

      {/* Selectors */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select
          value={selectedBuilding}
          onChange={(e) => { setSelectedBuilding(e.target.value); setSelectedFloor(""); }}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        >
          <option value="">Select Building</option>
          {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <select
          value={selectedFloor}
          onChange={(e) => setSelectedFloor(e.target.value)}
          disabled={!selectedBuilding}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
        >
          <option value="">Select Floor</option>
          {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>

        <div className="flex-1" />

        {selectedFloor && (
          <button
            onClick={openCreate}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            + Add Exit
          </button>
        )}
      </div>

      {error && !modalOpen && (
        <div className="mb-4 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-400">{error}</div>
      )}

      {/* Exits list */}
      {!selectedFloor ? (
        <div className="rounded-xl border border-dashed border-gray-700 py-16 text-center">
          <p className="text-gray-500">Select a building and floor to manage exits</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      ) : exits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 py-16 text-center">
          <p className="text-gray-500">No exits configured for this floor</p>
          <button onClick={openCreate} className="mt-2 text-sm text-emerald-400 hover:text-emerald-300">
            Add first exit
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exits.map((exit) => (
            <div
              key={exit.id}
              className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 transition hover:border-gray-700"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-3 w-3 rounded-full ${EXIT_TYPE_COLORS[exit.type]}`} />
                  <span className="font-medium text-white">{exit.name}</span>
                </div>
                <button
                  onClick={() => toggleActive(exit)}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                    exit.isActive
                      ? "bg-emerald-900/40 text-emerald-400"
                      : "bg-red-900/40 text-red-400"
                  }`}
                >
                  {exit.isActive ? "Active" : "Inactive"}
                </button>
              </div>

              <div className="mb-3 space-y-1 text-xs text-gray-500">
                <div>Type: {EXIT_TYPE_LABELS[exit.type]}</div>
                <div>Position: ({exit.x.toFixed(1)}, {exit.y.toFixed(1)})</div>
              </div>

              <div className="flex gap-2 border-t border-gray-800 pt-3">
                <button
                  onClick={() => openEdit(exit)}
                  className="flex-1 rounded-lg bg-gray-800 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-gray-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(exit.id)}
                  className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-900/30"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
            <h2 className="mb-5 text-lg font-bold text-white">
              {editingId ? "Edit Exit" : "Add Exit"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Exit Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  placeholder="Main Entrance"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ExitPayload["type"] }))}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="door">Normal Door</option>
                  <option value="emergency">Emergency Exit</option>
                  <option value="staircase">Staircase</option>
                  <option value="elevator">Elevator</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">X (meters)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.x}
                    onChange={(e) => setForm((f) => ({ ...f, x: parseFloat(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Y (meters)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.y}
                    onChange={(e) => setForm((f) => ({ ...f, y: parseFloat(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-300">Active</span>
              </label>

              {error && (
                <p className="rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-400">{error}</p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 transition hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
