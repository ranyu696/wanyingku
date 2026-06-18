import { useRequest, useWatcher } from "alova/client";
import { alova } from "./client";
import type {
  AuthResult,
  Paged,
  RequestItem,
  Source,
  SourceHealth,
  SourceItem,
  Stats,
  Title,
  User,
} from "./types";

const emptyPage = { list: [], total: 0, page: 1, size: 20 };

export function useStats() {
  return useRequest(() => alova.Get<Stats>("/admin/stats"));
}

export function useSourceHealth() {
  return useRequest(() => alova.Get<SourceHealth[]>("/admin/source-health"), {
    initialData: [] as SourceHealth[],
  });
}

export function useSources() {
  return useRequest(() => alova.Get<Source[]>("/admin/sources"), { initialData: [] as Source[] });
}

export function useReview(page: number) {
  return useWatcher(
    () => alova.Get<Paged<SourceItem>>("/admin/review", { params: { page, size: 30 } }),
    [page],
    { immediate: true, initialData: { list: [], total: 0, page: 1, size: 30 } },
  );
}

export function useAdminRequests(status: number, page: number) {
  return useWatcher(
    () => alova.Get<Paged<RequestItem>>("/admin/requests", { params: { status, page, size: 30 } }),
    [status, page],
    { immediate: true, initialData: { list: [], total: 0, page: 1, size: 30 } },
  );
}

export function useLogin() {
  return useRequest(
    (v: { username: string; password: string }) => alova.Post<AuthResult>("/auth/login", v),
    { immediate: false },
  );
}

export function useSourceOps() {
  const create = useRequest((v: Partial<Source>) => alova.Post("/admin/sources", v), {
    immediate: false,
  });
  const update = useRequest(
    (v: { id: number; data: Partial<Source> }) => alova.Put(`/admin/sources/${v.id}`, v.data),
    { immediate: false },
  );
  const remove = useRequest((id: number) => alova.Delete(`/admin/sources/${id}`), {
    immediate: false,
  });
  const sync = useRequest(
    (v: { id: number; full: boolean }) =>
      alova.Post(`/admin/sources/${v.id}/sync?full=${v.full ? 1 : 0}`),
    { immediate: false },
  );
  const syncAll = useRequest((full: boolean) => alova.Post(`/admin/sync-all?full=${full ? 1 : 0}`), {
    immediate: false,
  });
  return { create, update, remove, sync, syncAll };
}

export function useMergeTitles() {
  return useRequest(
    (v: { from_id: number; to_id: number }) => alova.Post("/admin/titles/merge", v),
    { immediate: false },
  );
}

export function useUpdateRequest() {
  return useRequest(
    (v: { id: number; status: number; title_id?: number; admin_note?: string }) =>
      alova.Put(`/admin/requests/${v.id}`, {
        status: v.status,
        title_id: v.title_id,
        admin_note: v.admin_note,
      }),
    { immediate: false },
  );
}

// ---- 数据管理 ----

export function useAdminTitles(p: { q: string; kind: number; status: number; page: number }) {
  return useWatcher(
    () => alova.Get<Paged<Title>>("/admin/titles", { params: p }),
    [p.q, p.kind, p.status, p.page],
    { immediate: true, debounce: 300, initialData: emptyPage as Paged<Title> },
  );
}

export function useTitleOps() {
  const update = useRequest(
    (v: { id: number; data: Record<string, unknown> }) =>
      alova.Put(`/admin/titles/${v.id}`, v.data),
    { immediate: false },
  );
  const remove = useRequest((id: number) => alova.Delete(`/admin/titles/${id}`), {
    immediate: false,
  });
  return { update, remove };
}

export function useSourceItems(p: { q: string; source_id: number; page: number }) {
  return useWatcher(
    () => alova.Get<Paged<SourceItem>>("/admin/source-items", { params: p }),
    [p.q, p.source_id, p.page],
    { immediate: true, debounce: 300, initialData: emptyPage as Paged<SourceItem> },
  );
}

export function useUsers(q: string, page: number) {
  return useWatcher(
    () => alova.Get<Paged<User>>("/admin/users", { params: { q, page } }),
    [q, page],
    { immediate: true, debounce: 300, initialData: emptyPage as Paged<User> },
  );
}

export function useUpdateUser() {
  return useRequest(
    (v: { id: number; role?: number; status?: number }) =>
      alova.Put(`/admin/users/${v.id}`, { role: v.role, status: v.status }),
    { immediate: false },
  );
}
