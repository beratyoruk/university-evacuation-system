import { useState, useEffect } from "react";
import { buildingsApi, type Building, type BuildingPayload } from "../../api/buildings.api";

const EMPTY_FORM: BuildingPayload = {
  name: "",
  address: "",
  latitude: 0,
  longitude: 0,
  totalFloors: 1,
};

export default function BuildingManager() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BuildingPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBuildings = async () => {
    try {
      const res = await buildingsApi.list();
      setBuildings(res.data.data || []);
    } catch {
      setError("Failed to load buildings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuildings();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (b: Building) => {
    setEditingId(b.id);
    setForm({
      name: b.name,
      address: b.address,
      latitude: b.latitude,
      longitude: b.longitude,
      totalFloors: b.totalFloors,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await buildingsApi.update(editingId, form);
      } else {
        await buildingsApi.create(form);
      }
      setModalOpen(false);
      fetchBuildings();
    } catch {
      setError("Failed to save building");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this building? All associated floors and data will be removed.")) return;
    try {
      await buildingsApi.delete(id);
      fetchBuildings();
    } catch {
      setError("Failed to delete building");
    }
  };

  const updateField = <K extends keyof BuildingPayload>(key: K, value: BuildingPayload[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Buildings</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage campus buildings and their locations</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          + Add Building
        </button>
      </div>

      {error && !modalOpen && (
        <div className="mb-4 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-400">{error}</div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      ) : buildings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 py-16 text-center">
          <p className="text-gray-500">No buildings yet</p>
          <button onClick={openCreate} className="mt-2 text-sm text-emerald-400 hover:text-emerald-300">
            Add your first building
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50 text-xs uppercase text-gray-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Address</th>
                <th className="px-4 py-3 font-medium">Lat / Lng</th>
                <th className="px-4 py-3 font-medium text-center">Floors</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {buildings.map((b) => (
                <tr key={b.id} className="border-b border-gray-800/50 transition hover:bg-gray-900/30">
                  <td className="px-4 py-3 font-medium text-white">{b.name}</td>
                  <td className="px-4 py-3 text-gray-400">{b.address}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {b.latitude.toFixed(4)}, {b.longitude.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-300">{b.totalFloors}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(b)}
                      className="mr-2 text-gray-400 transition hover:text-white"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="text-red-500 transition hover:text-red-400"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
            <h2 className="mb-5 text-lg font-bold text-white">
              {editingId ? "Edit Building" : "Add Building"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Building Name</label>
                <input
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                  placeholder="Engineering Faculty"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Address</label>
                <input
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                  placeholder="Campus Road No: 1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => updateField("latitude", parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                    placeholder="41.0082"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => updateField("longitude", parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                    placeholder="28.9784"
                  />
                </div>
              </div>

              {/* Map preview */}
              {form.latitude !== 0 && form.longitude !== 0 && (
                <div className="overflow-hidden rounded-lg border border-gray-700">
                  <iframe
                    title="Location preview"
                    width="100%"
                    height="200"
                    style={{ border: 0 }}
                    loading="lazy"
                    src={`https://maps.google.com/maps?q=${form.latitude},${form.longitude}&z=16&output=embed`}
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Total Floors</label>
                <input
                  type="number"
                  min={1}
                  value={form.totalFloors}
                  onChange={(e) => updateField("totalFloors", parseInt(e.target.value) || 1)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

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
