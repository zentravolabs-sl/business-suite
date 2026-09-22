"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tag, Plus, Search } from "lucide-react";
import { toast } from "sonner";

interface Brand {
  id: string;
  name: string;
  productCount: number;
}

export function BrandsClient({
  initialBrands,
}: {
  initialBrands: Brand[];
}) {
  const router = useRouter();
  const [brands, setBrands] = useState(initialBrands);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = brands.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create brand");

      toast.success(`Brand "${name}" created`);
      setBrands((prev) => [
        ...prev,
        {
          id: data.brand.id,
          name: data.brand.name,
          productCount: 0,
        },
      ]);
      setName("");
      setShowAdd(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Brands</h1>
          <p className="text-xs text-muted-foreground">
            Manage manufacturer labels, electronics brands, and suppliers.
          </p>
        </div>

        <button
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-all"
        >
          <Plus className="h-4 w-4" />
          Add Brand
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border bg-card p-5 shadow-sm space-y-3 animate-fade-in"
        >
          <h3 className="text-sm font-bold">New Brand</h3>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Brand / Manufacturer Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sony, Apple, Anchor, Unilever"
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-xl border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Save Brand"}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search brands..."
              className="w-full rounded-xl border bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No brands found.
            </div>
          ) : (
            filtered.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                    <Tag className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{b.name}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                    {b.productCount} Products
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
