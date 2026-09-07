import React, { useState } from "react";
import { Warehouse as WarehouseIcon, Plus, Check, X, MapPin } from "lucide-react";
import { Warehouse } from "../types";

interface WarehouseSelectorProps {
  warehouses: Warehouse[];
  selectedWarehouseId: string;
  onChange: (warehouseId: string) => void;
  onWarehouseCreated?: (newWarehouse: Warehouse) => void;
  label?: string;
  helperText?: string;
  theme?: "blue" | "amber" | "slate";
}

export function WarehouseSelector({
  warehouses,
  selectedWarehouseId,
  onChange,
  onWarehouseCreated,
  label = "Assigned Warehouse Location",
  helperText = "Select which warehouse holds this stock",
  theme = "amber"
}: WarehouseSelectorProps) {
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  const activeWarehouse = warehouses.find(w => w.id === selectedWarehouseId) || warehouses[0];

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSubmitting(true);
    setQuickError(null);

    try {
      const res = await fetch("/api/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          code: newCode.trim(),
          location: newLocation.trim(),
          isDefault: warehouses.length === 0
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create warehouse");
      }

      const created: Warehouse = await res.json();
      onChange(created.id);
      if (onWarehouseCreated) {
        onWarehouseCreated(created);
      }
      setNewName("");
      setNewCode("");
      setNewLocation("");
      setIsQuickAdding(false);
    } catch (err: any) {
      setQuickError(err.message || "Failed to create");
    } finally {
      setIsSubmitting(false);
    }
  };

  const ringColor = theme === "amber" ? "focus:ring-amber-400 focus:border-amber-400" : "focus:ring-blue-400 focus:border-blue-400";
  const badgeBg = theme === "amber" ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-blue-100 text-blue-800 border-blue-200";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <WarehouseIcon size={14} className={theme === "amber" ? "text-amber-600" : "text-blue-600"} />
          <span>{label}</span>
        </label>
        {!isQuickAdding && (
          <button
            type="button"
            onClick={() => setIsQuickAdding(true)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
          >
            <Plus size={12} />
            <span>+ New Warehouse</span>
          </button>
        )}
      </div>

      {!isQuickAdding ? (
        <div className="space-y-1.5">
          <div className="relative">
            <select
              value={selectedWarehouseId || (activeWarehouse?.id ?? "")}
              onChange={e => onChange(e.target.value)}
              className={`w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 appearance-none pr-10 ${ringColor}`}
            >
              {warehouses.map(wh => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} {wh.code ? `(${wh.code})` : ""} {wh.location ? `— ${wh.location}` : ""} {wh.isDefault ? "[Default]" : ""}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-3.5 pointer-events-none text-slate-400">
              ▼
            </div>
          </div>
          {activeWarehouse && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500 pl-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${badgeBg}`}>
                <WarehouseIcon size={11} />
                <span>{activeWarehouse.name}</span>
              </span>
              {activeWarehouse.location && (
                <span className="flex items-center gap-1 text-slate-400 truncate">
                  <MapPin size={11} />
                  <span>{activeWarehouse.location}</span>
                </span>
              )}
            </div>
          )}
          {helperText && (
            <p className="text-[10px] text-slate-400 pl-1">{helperText}</p>
          )}
        </div>
      ) : (
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <span>Quick Create Warehouse</span>
            <button
              type="button"
              onClick={() => {
                setIsQuickAdding(false);
                setQuickError(null);
              }}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          {quickError && (
            <p className="text-[11px] text-red-600 font-medium">{quickError}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Warehouse Name (e.g. Harbor Depot)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-400"
              autoFocus
            />
            <input
              type="text"
              placeholder="Code (e.g. WH-EAST)"
              value={newCode}
              onChange={e => setNewCode(e.target.value.toUpperCase())}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono uppercase focus:ring-1 focus:ring-blue-400"
            />
            <input
              type="text"
              placeholder="Location / Area (Optional)"
              value={newLocation}
              onChange={e => setNewLocation(e.target.value)}
              className="sm:col-span-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsQuickAdding(false);
                setQuickError(null);
              }}
              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleQuickCreate}
              disabled={isSubmitting || !newName.trim()}
              className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <Check size={12} />
              <span>{isSubmitting ? "Creating..." : "Save & Assign"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
