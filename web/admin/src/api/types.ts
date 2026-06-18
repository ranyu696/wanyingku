export interface Source {
  id: number;
  name: string;
  api_url: string;
  api_type: number;
  enabled: boolean;
  weight: number;
  sync_interval_min: number;
  last_sync_at?: string;
  note?: string;
}

export interface SourceItem {
  id: number;
  source_id: number;
  name: string;
  year: number;
  type_name: string;
  remarks: string;
  title_id?: number;
  match_confidence: number;
  needs_review: boolean;
}

export interface RequestItem {
  id: number;
  name: string;
  year: number;
  kind: number;
  status: number;
  vote_count: number;
  note: string;
  title_id?: number;
  created_at: string;
}

export interface Stats {
  titles: number;
  sources: number;
  source_items: number;
  needs_review: number;
  requests_pending: number;
  by_kind: Array<{ kind: number; count: number }>;
}

export interface SourceHealth {
  id: number;
  name: string;
  enabled: boolean;
  weight: number;
  last_sync_at?: string;
  lines: number;
  alive: number;
  dead: number;
  unknown: number;
  avg_latency?: number;
  last_checked?: string;
  titles: number;
}

export interface Paged<T> {
  list: T[];
  total: number;
  page: number;
  size: number;
}

export interface AuthResult {
  token: string;
  user: { id: number; username: string; nickname: string; role: number };
}

export interface Title {
  id: number;
  name: string;
  original_name?: string;
  year: number;
  kind: number;
  tmdb_id?: number;
  poster?: string;
  overview?: string;
  vote_average: number;
  source_count: number;
  latest_episode: number;
  total_episodes: number;
  match_status: number;
  status: number;
  updated_at: string;
}

export interface User {
  id: number;
  username: string;
  nickname: string;
  role: number;
  status: number;
  created_at: string;
}

export const MATCH_LABELS: Record<number, string> = {
  0: "未匹配",
  1: "TMDB",
  2: "模糊",
  3: "向量",
  4: "LLM",
  5: "人工",
};

export const KIND_LABELS: Record<number, string> = {
  1: "电影",
  2: "电视剧",
  3: "综艺",
  4: "动漫",
  5: "纪录片",
  6: "短剧",
  7: "体育",
};

export const REQ_STATUS: Record<number, string> = {
  0: "待处理",
  1: "处理中",
  2: "已满足",
  3: "已拒绝",
};
