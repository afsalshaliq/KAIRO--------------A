import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/lib/tenant";
import { supabase } from "@/lib/supabase";
import type { School } from "@/types/db";

export function AdminTenantSwitcher() {
  const { subdomain, setDevSubdomain } = useTenant();
  const [schools, setSchools] = useState<School[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadSchools() {
      if (!supabase) return;
      const { data } = await supabase
        .from("schools")
        .select("id, name, slug, domain, is_active, primary_color")
        .eq("is_active", true)
        .order("name");
      if (data) {
        setSchools(data as School[]);
      }
    }
    loadSchools();
  }, []);

  const handleChange = (val: string) => {
    if (val === "global") {
      setDevSubdomain(null);
      navigate("/super/overview");
    } else {
      const selected = schools.find((s) => s.slug === val);
      if (selected) {
        setDevSubdomain(selected.slug);
        // Navigate to the school's overview inside the Super Admin console
        navigate(`/super/schools/${selected.id}`);
      }
    }
  };

  return (
    <div className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-2 py-1 text-xs shadow-2xs">
      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-[11px] font-semibold text-muted hidden lg:inline">
        Admin Scope:
      </span>
      <select
        value={subdomain || "global"}
        onChange={(e) => handleChange(e.target.value)}
        className="bg-transparent text-fg text-xs font-medium cursor-pointer focus:outline-none pr-1"
        aria-label="Switch platform tenant scope"
      >
        <option value="global">Global Platform (All Tenants)</option>
        {schools.map((s) => (
          <option key={s.id} value={s.slug}>
            {s.name} ({s.slug}.kairo.com)
          </option>
        ))}
        {schools.length === 0 && (
          <>
            <option value="royal">Royal School (royal.kairo.com)</option>
            <option value="oxford">Oxford School (oxford.kairo.com)</option>
          </>
        )}
      </select>
    </div>
  );
}
