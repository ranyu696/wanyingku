export interface Title {
  id: number;
  slug?: string;
  kind: number;
  name: string;
  original_name?: string;
  season?: number;
  year: number;
  overview?: string;
  director?: string;
  actors?: string;
  area?: string;
  poster?: string;
  poster_blurhash?: string;
  backdrop?: string;
  backdrop_blurhash?: string;
  vote_average: number;
  vote_count: number;
  douban_rating?: number;
  douban_votes?: number;
  popularity: number;
  like_count?: number;
  source_count: number;
  latest_episode: number;
  total_episodes: number;
  serial_complete: boolean;
  adult?: boolean; // 成人内容：海报默认打码
  genre_ids: number[];
}

export interface Episode {
  id: number;
  play_source_id: number;
  title_id: number;
  idx: number;
  name: string;
  url: string;
}

export interface PlaySource {
  id: number;
  title_id: number;
  source_id: number;
  flag: string;
  lang: string;
  episode_count: number;
  health?: number; // 1正常 0未知 -1死链
  latency_ms?: number;
  episodes: Episode[];
  source?: { id: number; name: string };
}

export interface Genre {
  id: number;
  name: string;
}

export interface Collection {
  key: string;
  title: string;
  desc: string;
  list: Title[];
}

export interface Comment {
  id: number;
  title_id: number;
  content: string;
  like_count: number;
  is_liked: boolean;
  created_at: string;
  user?: { id: number; nickname: string; avatar: string };
}

export interface Progress {
  play_source_id?: number;
  episode_id?: number;
  episode_idx: number;
  position: number;
  duration: number;
}

export interface TitleDetail extends Title {
  genres: Genre[];
  aliases: string[];
  play_sources: PlaySource[];
  seasons?: Title[];
}

export interface DetailResp {
  detail: TitleDetail;
  is_favorite?: boolean;
  is_subscribed?: boolean;
  is_liked?: boolean;
  progress?: Progress;
  skip?: { intro_end: number; outro_start: number };
}

export interface Paged<T> {
  list: T[];
  total: number;
  page: number;
  size: number;
}

export interface HomeSection {
  title: string;
  kind: number;
  list: Title[];
}

export interface HomeData {
  banners: Title[] | null;
  sections: HomeSection[] | null;
}

export interface User {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  role: number;
}

export interface AuthResult {
  token: string;
  user: User;
}

export interface RequestItem {
  id: number;
  name: string;
  year: number;
  kind: number;
  status: number;
  vote_count: number;
  note: string;
  is_voted?: boolean;
  created_at: string;
}

export const REQ_STATUS: Record<number, string> = {
  0: "待处理",
  1: "处理中",
  2: "已满足",
  3: "已拒绝",
};

export interface NotificationItem {
  id: number;
  kind: number;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export const KIND_LABELS: Record<number, string> = {
  1: "电影",
  2: "电视剧",
  3: "综艺",
  4: "动漫",
  5: "纪录片",
  6: "短剧",
  7: "体育",
};
