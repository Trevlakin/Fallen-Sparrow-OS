import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TEAM_MEMBER_ROLE_LABELS,
  TEAM_MEMBER_ROLES,
  type TeamMemberRole,
} from "@fallen-sparrow/shared/constants";
import { useIsManager } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { emitData, DATA_EVENTS } from "@/lib/eventBus";
import { useEventBusRefresh } from "@/hooks/useEventBusRefresh";
import { AddEmployeeModal } from "@/components/sops/AddEmployeeModal";
import { EmployeePinTable, type TeamMemberRow } from "@/components/sops/EmployeePinTable";
import { SopCard, type SopCardData } from "@/components/sops/SopCard";
import { SopEditPanel } from "@/components/sops/SopEditPanel";
import { SOPHistory } from "@/components/sops/SOPHistory";

interface ApiSop {
  id: string;
  title: string;
  roles: TeamMemberRole[];
  role: TeamMemberRole | null;
  isActive: boolean | null;
  items: { id: string; label: string; isActive?: boolean | null }[];
}

function normalizeSop(sop: ApiSop): SopCardData {
  const roles =
    sop.roles?.length > 0
      ? sop.roles
      : sop.role
        ? [sop.role]
        : (["CLEANER"] as TeamMemberRole[]);
  return { ...sop, roles };
}

export function SOPsPage() {
  const isManager = useIsManager();
  const { showToast } = useToast();
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [sops, setSops] = useState<SopCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editSop, setEditSop] = useState<SopCardData | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [editOpen, setEditOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const memberPath = showInactive
        ? "/api/team-members?include_inactive=true"
        : "/api/team-members";
      const [memberRes, sopRes] = await Promise.all([
        api.get<{ teamMembers: TeamMemberRow[] }>(memberPath),
        api.get<{ sops: ApiSop[] }>("/api/sops"),
      ]);
      setTeamMembers(memberRes.teamMembers);
      setSops(sopRes.sops.filter((s) => s.isActive !== false).map(normalizeSop));
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEventBusRefresh([DATA_EVENTS.sops], loadAll);

  const sopsByRole = useMemo(() => {
    const map: Partial<Record<TeamMemberRole, SopCardData[]>> = {};
    for (const role of TEAM_MEMBER_ROLES) {
      map[role] = sops.filter((s) => s.roles.includes(role));
    }
    return map;
  }, [sops]);

  const openCreate = (role?: TeamMemberRole) => {
    setEditSop({
      id: "",
      title: "",
      roles: role ? [role] : ["FRONT_DESK"],
      isActive: true,
      items: [],
    });
    setEditOpen(true);
  };

  const saveSop = async (input: {
    id?: string;
    title: string;
    roles: TeamMemberRole[];
    items: { id?: string; text: string }[];
  }) => {
    let sopId = input.id;
    if (!sopId) {
      const created = await api.post<{ sop: ApiSop }>("/api/sops", {
        title: input.title,
        roles: input.roles,
      });
      sopId = created.sop.id;
    } else {
      await api.patch(`/api/sops/${sopId}`, {
        title: input.title,
        roles: input.roles,
      });
    }

    const existing = sops.find((s) => s.id === sopId);
    const existingItems = existing?.items.filter((i) => i.isActive !== false) ?? [];

    for (const old of existingItems) {
      if (!input.items.some((i) => i.id === old.id)) {
        await api.delete(`/api/sops/${sopId}/items/${old.id}`);
      }
    }

    for (const [idx, item] of input.items.entries()) {
      if (item.id) {
        const prev = existingItems.find((i) => i.id === item.id);
        if (prev && prev.label !== item.text) {
          await api.patch(`/api/sops/${sopId}/items/${item.id}`, { text: item.text });
        }
        await api.patch(`/api/sops/${sopId}/items/${item.id}`, { sortOrder: idx });
      } else {
        await api.post(`/api/sops/${sopId}/items`, {
          text: item.text,
          sortOrder: idx,
        });
      }
    }

    showToast("SOP saved", "success");
    emitData(DATA_EVENTS.sops);
    await loadAll();
  };

  const createEmployee = async (input: {
    name: string;
    role: TeamMemberRole;
    pin: string;
  }) => {
    const res = await api.post<{ teamMember: TeamMemberRow; pin: string }>(
      "/api/team-members",
      input,
    );
    showToast(`Employee ${res.teamMember.displayName} created`, "success");
    emitData(DATA_EVENTS.sops);
    await loadAll();
    return { pin: res.pin };
  };

  const changePin = async (id: string, pin: string) => {
    await api.patch(`/api/team-members/${id}/pin`, { pin });
    showToast("PIN updated", "success");
  };

  const updateEmployee = async (
    id: string,
    input: { name: string; role: TeamMemberRole },
  ) => {
    await api.patch(`/api/team-members/${id}`, input);
    showToast("Employee updated", "success");
    emitData(DATA_EVENTS.sops);
    await loadAll();
  };

  const deactivateEmployee = async (id: string) => {
    await api.delete(`/api/team-members/${id}`);
    showToast("Employee deactivated", "success");
    emitData(DATA_EVENTS.sops);
    await loadAll();
  };

  const deleteSop = async (id: string) => {
    await api.delete(`/api/sops/${id}`);
    showToast("SOP deactivated", "success");
    emitData(DATA_EVENTS.sops);
    await loadAll();
  };

  return (
    <div className="sops-page operations-page">
      <header className="operations-header sops-header">
        <div>
          <h1>SOPs</h1>
          <p className="text-muted">Role checklists and employee PIN access</p>
        </div>
        <div className="sops-header-actions">
          {isManager && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setEmployeeModalOpen(true)}
            >
              Add employee
            </button>
          )}
          <button type="button" className="btn-primary" onClick={() => openCreate()}>
            Create SOP
          </button>
        </div>
      </header>

      {loading && <p className="text-muted">Loading SOPs...</p>}

      {!loading && isManager && (
        <EmployeePinTable
          members={teamMembers}
          showInactive={showInactive}
          onToggleInactive={setShowInactive}
          onChangePin={changePin}
          onUpdateMember={updateEmployee}
          onDeactivate={deactivateEmployee}
        />
      )}

      {!loading &&
        TEAM_MEMBER_ROLES.map((role) => (
          <section key={role} className="sops-role-section">
            <h2 className="sops-role-heading">{TEAM_MEMBER_ROLE_LABELS[role]}</h2>
            <div className="sops-role-grid">
              {(sopsByRole[role] ?? []).map((sop) => (
                <SopCard
                  key={`${role}-${sop.id}`}
                  sop={sop}
                  onEdit={(selected) => {
                    setEditSop(selected);
                    setEditOpen(true);
                  }}
                />
              ))}
              <button
                type="button"
                className="sop-card sop-card-add"
                onClick={() => openCreate(role)}
              >
                <span>+ Add SOP</span>
              </button>
            </div>
            <SOPHistory role={role} />
          </section>
        ))}

      <AddEmployeeModal
        open={employeeModalOpen}
        onClose={() => setEmployeeModalOpen(false)}
        onCreate={createEmployee}
      />

      <SopEditPanel
        sop={editSop}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={saveSop}
        onDelete={deleteSop}
      />
    </div>
  );
}
