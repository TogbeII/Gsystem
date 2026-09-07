import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Warehouse as WarehouseIcon, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  MapPin, 
  Boxes, 
  Layers,
  AlertCircle
} from "lucide-react";
import { Warehouse, Product } from "../types";

interface WarehouseManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  products: Product[];
  refreshWarehouses: () => Promise<void> | void;
  canManage?: boolean;
}

export function WarehouseManagerModal({
  isOpen,
  onClose,
  warehouses,
  products,
  refreshWarehouses,
  canManage = true
}: WarehouseManagerModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    code: "",
    location: "",
    isDefault: false
  });

  const resetForm = () => {
    setForm({ name: "", code: "", location: "", isDefault: false });
    setIsCreating(false);
    setEditingWarehouse(null);
    setError(null);
  };

  const startCreate = () => {
    setForm({ name: "", code: "", location: "", isDefault: warehouses.length === 0 });
    setEditingWarehouse(null);
    setIsCreating(true);
    setError(null);
  };

  const startEdit = (wh: Warehouse) => {
    setForm({
      name: wh.name,
      code: wh.code || "",
      location: wh.location || "",
      isDefault: Boolean(wh.isDefault)
    });
    setIsCreating(false);
    setEditingWarehouse(wh);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Please enter a warehouse name.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (editingWarehouse) {
        const res = await fetch(`/api/warehouses/${editingWarehouse.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form)
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update warehouse");
        }
      } else {
        const res = await fetch("/api/warehouses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form)
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create warehouse");
        }
      }

      await refreshWarehouses();
      resetForm();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/warehouses/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete warehouse");
      }
      setDeleteConfirmId(null);
      await refreshWarehouses();
    } catch (err: any) {
      setError(err.message || "Failed to delete warehouse");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 10 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.95, opacity: 0, y: 10 }} 
        className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center">
              <WarehouseIcon size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Manage Warehouses</h2>
              <p className="text-xs text-slate-500">Create and oversee multiple warehouse locations & stock depots</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-8 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 text-sm">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form when Creating or Editing */}
          <AnimatePresence>
            {(isCreating || editingWarehouse) && (
              <motion.form 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleSave}
                className="bg-slate-50 border border-slate-200 p-6 rounded-2xl space-y-4"
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    {editingWarehouse ? `Edit Warehouse: ${editingWarehouse.name}` : "Create New Warehouse"}
                  </h3>
                  <button 
                    type="button" 
                    onClick={resetForm} 
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Warehouse Name *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Main Depot, Harbor Storage" 
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Warehouse Code</label>
                    <input 
                      type="text" 
                      placeholder="e.g. WH-EAST, WH-02" 
                      value={form.code}
                      onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-amber-400 focus:border-amber-400 uppercase"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700">Location / Address</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Tema Industrial Area, Gate 3" 
                      value={form.location}
                      onChange={e => setForm({ ...form, location: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                      <input 
                        type="checkbox" 
                        checked={form.isDefault}
                        onChange={e => setForm({ ...form, isDefault: e.target.checked })}
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-400 h-4 w-4"
                      />
                      <span>Set as primary default warehouse for new stock</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={resetForm}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Check size={14} />
                    <span>{editingWarehouse ? "Save Updates" : "Create Warehouse"}</span>
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Action Row */}
          {!isCreating && !editingWarehouse && canManage && (
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Active Locations ({warehouses.length})
              </span>
              <button 
                type="button"
                onClick={startCreate}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>Add Warehouse</span>
              </button>
            </div>
          )}

          {/* Warehouses List */}
          <div className="grid grid-cols-1 gap-3">
            {warehouses.map(wh => {
              // Calculate stats for this warehouse
              const assignedProducts = products.filter(p => 
                p.warehouseId === wh.id || 
                (p.warehouseStocks && (p.warehouseStocks[wh.id] || 0) > 0)
              );
              const totalItemsInWh = assignedProducts.reduce((sum, p) => {
                const boxes = p.warehouseStocks ? (p.warehouseStocks[wh.id] || 0) : (p.warehouseId === wh.id ? (p.warehouseStock || 0) : 0);
                const singles = (p.warehouseId === wh.id ? ((p as any).warehouseLooseStock || 0) : 0);
                return sum + (boxes * (p.bulkUnitSize || 1)) + singles;
              }, 0);

              const isDeleteConfirm = deleteConfirmId === wh.id;

              return (
                <div 
                  key={wh.id}
                  className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-amber-300 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold text-xs">
                        <WarehouseIcon size={16} />
                      </div>
                      <h4 className="font-bold text-slate-900 text-base">{wh.name}</h4>
                      {wh.code && (
                        <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                          {wh.code}
                        </span>
                      )}
                      {wh.isDefault && (
                        <span className="text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Primary Default
                        </span>
                      )}
                    </div>

                    {wh.location && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 pl-1">
                        <MapPin size={13} className="text-slate-400 shrink-0" />
                        <span>{wh.location}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 pl-1">
                      <span className="inline-flex items-center gap-1">
                        <Boxes size={13} className="text-slate-400" />
                        <strong className="text-slate-700 font-semibold">{assignedProducts.length}</strong> catalog items
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Layers size={13} className="text-slate-400" />
                        <strong className="text-slate-700 font-semibold">{totalItemsInWh.toLocaleString()}</strong> units in stock
                      </span>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {isDeleteConfirm ? (
                        <div className="flex items-center gap-2 bg-red-50 p-2 rounded-xl border border-red-200">
                          <span className="text-[11px] text-red-700 font-bold">Delete?</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(wh.id)}
                            disabled={loading}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(wh)}
                            title="Edit warehouse details"
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                          >
                            <Edit3 size={15} />
                          </button>
                          {warehouses.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(wh.id)}
                              title="Delete warehouse"
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
