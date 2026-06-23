import { useCallback, useEffect, useRef, useState } from "react";
import { useRequest, useWatcher } from "alova/client";
import { alova } from "./client";
import type {
  AuthResult,
  Collection,
  Comment,
  DetailResp,
  Genre,
  NotificationItem,
  Paged,
  RequestItem,
  Title,
} from "./types";

export interface TitleFilter {
  kind?: number;
  genre?: number;
  year?: number;
  region?: string;
  sort?: string;
  page?: number;
  size?: number;
}

const emptyPage = { list: [], total: 0, page: 1, size: 24 };

export function useTitles(filter: TitleFilter) {
  return useWatcher(
    () => alova.Get<Paged<Title>>("/titles", { params: filter as Record<string, unknown> }),
    [filter.kind ?? 0, filter.genre ?? 0, filter.year ?? 0, filter.sort ?? "", filter.page ?? 1],
    { immediate: true, initialData: emptyPage as Paged<Title> },
  );
}

// id 可为数字 id 或拼音 slug（后端两者都认）
export function useTitleDetail(id: number | string) {
  return useWatcher(() => alova.Get<DetailResp>(`/titles/${id}`), [id], { immediate: true });
}

export function useCollections() {
  return useRequest(() => alova.Get<Collection[]>("/collections"), {
    initialData: [] as Collection[],
  });
}

export function useCollectionTitles(key: string) {
  return useWatcher(
    () =>
      alova.Get<{ title: string; desc: string; list: Title[]; total: number }>(
        `/collections/${key}`,
        { params: { size: 60 } },
      ),
    [key],
    { immediate: true },
  );
}

export function useRelated(id: number) {
  return useWatcher(
    () => alova.Get<Title[]>(`/titles/${id}/related`, { params: { limit: 12 } }),
    [id],
    { immediate: id > 0, initialData: [] as Title[] },
  );
}

export function usePersonTitles(name: string) {
  return useWatcher(
    () => alova.Get<Paged<Title>>("/people", { params: { name, size: 60 } }),
    [name],
    { immediate: Boolean(name), initialData: emptyPage as Paged<Title> },
  );
}

export function useSearch(q: string, kind: number) {
  return useWatcher(
    () => alova.Get<Paged<Title>>("/search", { params: { q, kind, size: 30 } }),
    [q, kind],
    { immediate: true, debounce: 350, initialData: emptyPage as Paged<Title> },
  );
}

export function useRequestsList(status: number) {
  return useWatcher(
    () => alova.Get<Paged<RequestItem>>("/requests", { params: { status, size: 30 } }),
    [status],
    { immediate: true, initialData: emptyPage as Paged<RequestItem> },
  );
}

export function useRequestVote() {
  return useRequest(
    (v: { id: number; on: boolean }) =>
      v.on ? alova.Post(`/requests/${v.id}/vote`) : alova.Delete(`/requests/${v.id}/vote`),
    { immediate: false },
  );
}

export function useFavorites(enabled: boolean) {
  return useRequest(() => alova.Get<Paged<{ id: number; title: Title }>>("/me/favorites"), {
    immediate: enabled,
    initialData: emptyPage,
  });
}

export function useHistory(enabled: boolean) {
  return useRequest(
    () =>
      alova.Get<Paged<{ id: number; title: Title; episode_idx: number; position: number }>>(
        "/me/history",
      ),
    { immediate: enabled, initialData: emptyPage },
  );
}

export function useRecommend(enabled: boolean) {
  return useRequest(() => alova.Get<Title[]>("/me/recommend", { params: { limit: 18 } }), {
    immediate: enabled,
    initialData: [] as Title[],
  });
}

export function useNotifications(enabled: boolean) {
  return useRequest(() => alova.Get<Paged<NotificationItem>>("/me/notifications"), {
    immediate: enabled,
    initialData: emptyPage,
  });
}

// ---- mutations（immediate:false，调用 send 触发）----

export function useLogin() {
  return useRequest(
    (v: { username: string; password: string }) => alova.Post<AuthResult>("/auth/login", v),
    { immediate: false },
  );
}

export function useRegister() {
  return useRequest(
    (v: { username: string; password: string; nickname?: string }) =>
      alova.Post<AuthResult>("/auth/register", v),
    { immediate: false },
  );
}

export function useCreateRequest() {
  return useRequest(
    (v: { name: string; year?: number; kind?: number; note?: string }) =>
      alova.Post("/requests", v),
    { immediate: false },
  );
}

export function useSaveProgress() {
  return useRequest(
    (v: {
      title_id: number;
      play_source_id?: number;
      episode_id?: number;
      episode_idx: number;
      position: number;
      duration: number;
    }) => alova.Post("/me/history", v),
    { immediate: false },
  );
}

export function useHotSearches() {
  return useRequest(() => alova.Get<string[]>("/search/hot"), { initialData: [] as string[] });
}

export function useTags(kind: number) {
  return useWatcher(() => alova.Get<string[]>("/tags", { params: { kind } }), [kind], {
    immediate: true,
    initialData: [] as string[],
  });
}

export function useRandomTitle() {
  return useRequest((params: { kind?: number; genre?: number }) =>
    alova.Get<Title>("/titles/random", { params }), { immediate: false });
}

export function useSubmitSkip() {
  return useRequest(
    (v: { titleId: number; intro_end: number; outro_start: number }) =>
      alova.Post(`/titles/${v.titleId}/skip`, {
        intro_end: v.intro_end,
        outro_start: v.outro_start,
      }),
    { immediate: false },
  );
}

export function useFavoriteOps() {
  const add = useRequest((titleId: number) => alova.Post("/me/favorites", { title_id: titleId }), {
    immediate: false,
  });
  const remove = useRequest((titleId: number) => alova.Delete(`/me/favorites/${titleId}`), {
    immediate: false,
  });
  return { add, remove };
}

export function useSubscribeOps() {
  const add = useRequest(
    (titleId: number) => alova.Post("/me/subscriptions", { title_id: titleId }),
    { immediate: false },
  );
  const remove = useRequest((titleId: number) => alova.Delete(`/me/subscriptions/${titleId}`), {
    immediate: false,
  });
  return { add, remove };
}

export function useGenres(kind: number) {
  return useWatcher(() => alova.Get<Genre[]>("/genres", { params: { kind } }), [kind], {
    immediate: true,
    initialData: [] as Genre[],
  });
}

export function useComments(titleId: number) {
  return useWatcher(
    () => alova.Get<Paged<Comment>>(`/titles/${titleId}/comments`, { params: { size: 50 } }),
    [titleId],
    { immediate: titleId > 0, initialData: emptyPage as Paged<Comment> },
  );
}

export function useCommentOps() {
  const add = useRequest(
    (v: { title_id: number; content: string }) => alova.Post<Comment>("/comments", v),
    { immediate: false },
  );
  const like = useRequest(
    (v: { id: number; on: boolean }) =>
      v.on ? alova.Post(`/comments/${v.id}/like`) : alova.Delete(`/comments/${v.id}/like`),
    { immediate: false },
  );
  const remove = useRequest((id: number) => alova.Delete(`/comments/${id}`), { immediate: false });
  return { add, like, remove };
}

// 无限滚动：累积分页，filter 变化自动重置。url 用 /titles 或 /search。
export function useInfinite(url: string, params: Record<string, unknown>) {
  const key = JSON.stringify(params);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Title[]>([]);
  const [total, setTotal] = useState(0);
  const mounted = useRef(false);

  const { loading, data, send } = useWatcher(
    () => alova.Get<Paged<Title>>(url, { params: { ...params, page, size: 30 } }),
    [page],
    { immediate: true, initialData: { list: [], total: 0, page: 1, size: 30 } as Paged<Title> },
  );

  // 每次请求成功 data 会更新 → 第 1 页替换、其余追加
  // 注意：Go 的 nil slice 会序列化成 null，无数据的分类返回 list:null，需兜底
  useEffect(() => {
    if (!data) {
      return;
    }
    const list = data.list ?? [];
    setTotal(data.total ?? 0);
    setItems((prev) => (page === 1 ? list : [...prev, ...list]));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // filter 变化：清空并回到第 1 页（首次挂载跳过）
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setItems([]);
    setTotal(0);
    if (page !== 1) {
      setPage(1);
    } else {
      void send();
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLast = total > 0 && items.length >= total;
  const loadMore = useCallback(() => setPage((p) => p + 1), []);
  return { items, total, loading, isLast, loadMore };
}

// 分类页：页码翻页（非累积）。显式监听各筛选字段（基本类型），任一变化或翻页都重新请求；
// cacheFor:0 关掉 alova 默认 GET 缓存，避免「总数/列表固定不变」。
export function usePagedTitles(params: Record<string, unknown>, page: number, size = 30) {
  return useWatcher(
    () => alova.Get<Paged<Title>>("/titles", { params: { ...params, page, size }, cacheFor: 0 }),
    [params.kind, params.genre, params.tag, params.adult, params.region, params.year, params.sort, page],
    { immediate: true, initialData: { list: [], total: 0, page: 1, size } as Paged<Title> },
  );
}

export function useLikeTitle() {
  return useRequest(
    (v: { titleId: number; on: boolean }) =>
      v.on ? alova.Post(`/titles/${v.titleId}/like`) : alova.Delete(`/titles/${v.titleId}/like`),
    { immediate: false },
  );
}

export function useSubscriptions(enabled: boolean) {
  return useRequest(
    () => alova.Get<Paged<{ id: number; title: Title }>>("/me/subscriptions"),
    { immediate: enabled, initialData: emptyPage },
  );
}

export function useNotifOps() {
  const markRead = useRequest((id: number) => alova.Post(`/me/notifications/${id}/read`), {
    immediate: false,
  });
  const markAll = useRequest(() => alova.Post("/me/notifications/read-all"), { immediate: false });
  return { markRead, markAll };
}
