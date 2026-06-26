"use client";
import { type DependencyList, useCallback, useEffect, useRef, useState } from "react";
import { api, clientId } from "./api";
import type {
  AuthResult,
  Collection,
  Comment,
  DetailResp,
  NotificationItem,
  Paged,
  RequestItem,
  Title,
} from "./types";

// ---- 通用原语（替代 alova 的 useRequest / useWatcher）----

// 只读取数：deps 变化或 enabled 由假转真时自动请求；send() 手动重取。失败保留上次数据。
export function useQuery<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  opts?: { enabled?: boolean; initialData?: T },
) {
  const { enabled = true, initialData } = opts ?? {};
  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState(false);
  const ref = useRef(fetcher);
  ref.current = fetcher;

  const send = useCallback(async () => {
    setLoading(true);
    try {
      const d = await ref.current();
      setData(d);
      return d;
    } catch {
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, send, ...deps]);

  return { data, loading, send, setData };
}

// 写操作：immediate:false 语义，调用 send(args) 触发。
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const ref = useRef(fn);
  ref.current = fn;
  const [loading, setLoading] = useState(false);
  const send = useCallback(async (...args: A): Promise<R> => {
    setLoading(true);
    try {
      return await ref.current(...args);
    } finally {
      setLoading(false);
    }
  }, []);
  return { loading, send };
}

const emptyPage = { list: [], total: 0, page: 1, size: 24 };

// ---- 读 ----

// id 可为数字 id 或拼音 slug（后端两者都认）；带 token 时还会回真实用户态
export function useTitleDetail(id: number | string) {
  return useQuery(() => api.get<DetailResp>(`/titles/${id}`), [id]);
}

export function useRelated(id: number) {
  return useQuery(() => api.get<Title[]>(`/titles/${id}/related`, { limit: 12 }), [id], {
    enabled: id > 0,
    initialData: [] as Title[],
  });
}

export function useCollections() {
  return useQuery(() => api.get<Collection[]>("/collections"), [], { initialData: [] as Collection[] });
}

export function useRecommend(enabled: boolean) {
  return useQuery(() => api.get<Title[]>("/me/recommend", { limit: 18 }), [], {
    enabled,
    initialData: [] as Title[],
  });
}

export function useHistory(enabled: boolean) {
  return useQuery(
    () =>
      api.get<Paged<{ id: number; title: Title; episode_idx: number; position: number }>>(
        "/me/history",
      ),
    [],
    { enabled, initialData: emptyPage as Paged<{ id: number; title: Title; episode_idx: number; position: number }> },
  );
}

export function useFavorites(enabled: boolean) {
  return useQuery(() => api.get<Paged<{ id: number; title: Title }>>("/me/favorites"), [], {
    enabled,
    initialData: emptyPage as Paged<{ id: number; title: Title }>,
  });
}

export function useSubscriptions(enabled: boolean) {
  return useQuery(() => api.get<Paged<{ id: number; title: Title }>>("/me/subscriptions"), [], {
    enabled,
    initialData: emptyPage as Paged<{ id: number; title: Title }>,
  });
}

export function useNotifications(enabled: boolean) {
  return useQuery(() => api.get<Paged<NotificationItem>>("/me/notifications"), [], {
    enabled,
    initialData: emptyPage as Paged<NotificationItem>,
  });
}

export function useHotSearches() {
  return useQuery(() => api.get<string[]>("/search/hot"), [], { initialData: [] as string[] });
}

export function useRequestsList(status: number) {
  return useQuery(() => api.get<Paged<RequestItem>>("/requests", { status, size: 30 }), [status], {
    initialData: emptyPage as Paged<RequestItem>,
  });
}

export function useComments(titleId: number) {
  return useQuery(
    () => api.get<Paged<Comment>>(`/titles/${titleId}/comments`, { size: 50 }),
    [titleId],
    { enabled: titleId > 0, initialData: emptyPage as Paged<Comment> },
  );
}

// ---- 写 ----

export function useRandomTitle() {
  return useMutation((params: { kind?: number; genre?: number }) =>
    api.get<Title>("/titles/random", params),
  );
}

export function useLogin() {
  return useMutation((v: { username: string; password: string }) =>
    api.post<AuthResult>("/auth/login", v),
  );
}

export function useRegister() {
  return useMutation((v: { username: string; password: string; nickname?: string }) =>
    api.post<AuthResult>("/auth/register", v),
  );
}

export function useCreateRequest() {
  return useMutation((v: { name: string; year?: number; kind?: number; note?: string }) =>
    api.post("/requests", v),
  );
}

export function useRequestVote() {
  return useMutation((v: { id: number; on: boolean }) =>
    v.on ? api.post(`/requests/${v.id}/vote`) : api.del(`/requests/${v.id}/vote`),
  );
}

export function useSaveProgress() {
  return useMutation(
    (v: {
      title_id: number;
      play_source_id?: number;
      episode_id?: number;
      episode_idx: number;
      position: number;
      duration: number;
    }) => api.post("/me/history", v),
  );
}

export function useSubmitSkip() {
  return useMutation((v: { titleId: number; intro_end: number; outro_start: number }) =>
    api.post(`/titles/${v.titleId}/skip`, { intro_end: v.intro_end, outro_start: v.outro_start }),
  );
}

export function useLikeTitle() {
  return useMutation((v: { titleId: number; on: boolean }) =>
    v.on ? api.post(`/titles/${v.titleId}/like`) : api.del(`/titles/${v.titleId}/like`),
  );
}

export function useFavoriteOps() {
  const add = useMutation((titleId: number) => api.post("/me/favorites", { title_id: titleId }));
  const remove = useMutation((titleId: number) => api.del(`/me/favorites/${titleId}`));
  return { add, remove };
}

export function useSubscribeOps() {
  const add = useMutation((titleId: number) => api.post("/me/subscriptions", { title_id: titleId }));
  const remove = useMutation((titleId: number) => api.del(`/me/subscriptions/${titleId}`));
  return { add, remove };
}

export function useCommentOps() {
  const add = useMutation((v: { title_id: number; content: string }) =>
    api.post<Comment>("/comments", v),
  );
  const like = useMutation((v: { id: number; on: boolean }) =>
    v.on ? api.post(`/comments/${v.id}/like`) : api.del(`/comments/${v.id}/like`),
  );
  const remove = useMutation((id: number) => api.del(`/comments/${id}`));
  return { add, like, remove };
}

export function useNotifOps() {
  const markRead = useMutation((id: number) => api.post(`/me/notifications/${id}/read`));
  const markAll = useMutation(() => api.post("/me/notifications/read-all"));
  return { markRead, markAll };
}

// 无限滚动：累积分页，params 变化自动重置回第 1 页。url 用 /titles 或 /search。
// 注意：Go 的 nil slice 序列化成 null，无数据分类返回 list:null，需兜底。
export function useInfinite(url: string, params: Record<string, unknown>) {
  const key = JSON.stringify(params);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Title[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<Paged<Title>>(url, { ...params, page, size: 30 })
      .then((data) => {
        if (cancelled) {
          return;
        }
        const list = data?.list ?? [];
        setTotal(data?.total ?? 0);
        setItems((prev) => (page === 1 ? list : [...prev, ...list]));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, key]);

  // params 变化：清空回第 1 页（首次挂载跳过，避免重复首取）
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setItems([]);
    setTotal(0);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const isLast = total > 0 && items.length >= total;
  const loadMore = useCallback(() => setPage((p) => p + 1), []);
  return { items, total, loading, isLast, loadMore };
}

// 批量查在看人数（首页/片单广场）：只读，30s 周期刷新保持实时。返回 {titleId: 人数}（仅 >0）。
export function useWatching(ids: number[]): Record<string, number> {
  const idsKey = ids.slice().sort((a, b) => a - b).join(",");
  const q = useQuery<{ counts: Record<string, number> }>(
    () =>
      idsKey
        ? api.get<{ counts: Record<string, number> }>("/watching", { ids: idsKey })
        : Promise.resolve({ counts: {} }),
    [idsKey],
    { initialData: { counts: {} } },
  );
  const { send } = q;
  useEffect(() => {
    if (!idsKey) {
      return;
    }
    const t = setInterval(() => void send(), 30000);
    return () => clearInterval(t);
  }, [idsKey, send]);
  return q.data?.counts ?? {};
}

// 观看心跳：在观看页挂载期间每 30s 上报一次，返回当前作品的在看人数。
export function usePresence(titleId: number) {
  const [watching, setWatching] = useState(0);
  useEffect(() => {
    if (!titleId) {
      return;
    }
    let cancelled = false;
    const ping = () =>
      api
        .post<{ watching: number }>(`/titles/${titleId}/heartbeat`, undefined, { cid: clientId() })
        .then((d) => {
          if (!cancelled) {
            setWatching(d?.watching ?? 0);
          }
        })
        .catch(() => {});
    ping();
    const t = setInterval(ping, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [titleId]);
  return watching;
}
