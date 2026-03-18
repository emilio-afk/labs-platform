import { useEffect, useMemo, useState } from "react";
import type {
  ManagedUser,
  UserActivityItem,
  UserActivitySummary,
  UserEntitlementLab,
} from "../types";

export function useUsersTab() {
  const [userSearch, setUserSearch] = useState("");
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [selectedManagedUserId, setSelectedManagedUserId] = useState<string | null>(null);
  const [userMgmtMsg, setUserMgmtMsg] = useState("");
  const [entitlementLabs, setEntitlementLabs] = useState<UserEntitlementLab[]>([]);
  const [activitySummary, setActivitySummary] = useState<UserActivitySummary | null>(null);
  const [activityItems, setActivityItems] = useState<UserActivityItem[]>([]);
  const [userMgmtRefreshTick, setUserMgmtRefreshTick] = useState(0);

  const selectedManagedUser = useMemo(
    () => managedUsers.find((u) => u.id === selectedManagedUserId) ?? null,
    [managedUsers, selectedManagedUserId],
  );

  useEffect(() => {
    let active = true;

    const loadManagedUsers = async () => {
      const params = new URLSearchParams();
      if (userSearch.trim()) params.set("q", userSearch.trim());
      const response = await fetch(`/api/admin/users?${params.toString()}`);
      const payload = (await response.json()) as { users?: ManagedUser[]; error?: string };

      if (!active) return;
      if (!response.ok) {
        setUserMgmtMsg(payload.error ?? "No se pudieron cargar usuarios");
        return;
      }

      const users = payload.users ?? [];
      setManagedUsers(users);
      setUserMgmtMsg("");

      if (!selectedManagedUserId && users.length > 0) {
        setSelectedManagedUserId(users[0].id);
      }
      if (selectedManagedUserId && !users.some((u) => u.id === selectedManagedUserId)) {
        setSelectedManagedUserId(users[0]?.id ?? null);
      }
    };

    void loadManagedUsers();
    return () => {
      active = false;
    };
  }, [selectedManagedUserId, userMgmtRefreshTick, userSearch]);

  useEffect(() => {
    let active = true;

    const loadSelectedUserData = async () => {
      if (!selectedManagedUserId) {
        if (active) {
          setEntitlementLabs([]);
          setActivitySummary(null);
          setActivityItems([]);
        }
        return;
      }

      const [entitlementsRes, activityRes] = await Promise.all([
        fetch(`/api/admin/user-entitlements?userId=${selectedManagedUserId}`),
        fetch(`/api/admin/user-activity?userId=${selectedManagedUserId}`),
      ]);

      const entitlementsPayload = (await entitlementsRes.json()) as {
        labs?: UserEntitlementLab[];
        error?: string;
      };
      const activityPayload = (await activityRes.json()) as {
        summary?: UserActivitySummary;
        progress?: UserActivityItem[];
        comments?: UserActivityItem[];
        error?: string;
      };

      if (!active) return;

      if (!entitlementsRes.ok) {
        setUserMgmtMsg(entitlementsPayload.error ?? "No se pudieron cargar accesos del usuario");
      } else {
        setEntitlementLabs(entitlementsPayload.labs ?? []);
      }

      if (!activityRes.ok) {
        setUserMgmtMsg(activityPayload.error ?? "No se pudo cargar actividad del usuario");
      } else {
        setActivitySummary(activityPayload.summary ?? null);
        const merged = [
          ...(activityPayload.comments ?? []),
          ...(activityPayload.progress ?? []),
        ].slice(0, 20);
        setActivityItems(merged);
      }
    };

    void loadSelectedUserData();
    return () => {
      active = false;
    };
  }, [selectedManagedUserId]);

  const toggleUserLabAccess = async (labId: string, grant: boolean) => {
    if (!selectedManagedUserId) return;

    setUserMgmtMsg("Guardando acceso...");
    const response = await fetch("/api/admin/user-entitlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedManagedUserId, labId, grant }),
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setUserMgmtMsg(payload.error ?? "No se pudo actualizar acceso");
      return;
    }

    setEntitlementLabs((prev) =>
      prev.map((lab) =>
        lab.id === labId
          ? { ...lab, hasAccess: grant, status: grant ? "active" : "revoked" }
          : lab,
      ),
    );
    setUserMgmtMsg(grant ? "Acceso concedido" : "Acceso revocado");
    setUserMgmtRefreshTick((prev) => prev + 1);
  };

  return {
    userSearch, setUserSearch,
    managedUsers,
    selectedManagedUserId, setSelectedManagedUserId,
    selectedManagedUser,
    userMgmtMsg,
    entitlementLabs,
    activitySummary,
    activityItems,
    toggleUserLabAccess,
    setUserMgmtRefreshTick,
  };
}
