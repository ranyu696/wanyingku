package com.yinshi.app.data

import kotlinx.serialization.Serializable

// 与 Go 后端 JSON 对齐。后端统一信封：{code, message, data}
@Serializable
data class Envelope<T>(val code: Int = 0, val message: String? = null, val data: T? = null)

@Serializable
data class Paged<T>(
    val list: List<T> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val size: Int = 0,
)

@Serializable
data class Title(
    val id: Long,
    val kind: Int = 0,
    val name: String = "",
    val season: Int = 0,
    val year: Int = 0,
    val overview: String? = null,
    val director: String? = null,
    val actors: String? = null,
    val area: String? = null,
    val poster: String? = null,
    val backdrop: String? = null,
    val vote_average: Double = 0.0,
    val douban_rating: Double = 0.0,
    val source_count: Int = 0,
    val latest_episode: Int = 0,
    val serial_complete: Boolean = false,
)

@Serializable
data class HomeSection(val title: String = "", val kind: Int = 0, val list: List<Title> = emptyList())

@Serializable
data class HomeData(
    val banners: List<Title>? = null,
    val sections: List<HomeSection>? = null,
)

@Serializable
data class Episode(val id: Long, val idx: Int = 0, val name: String = "", val url: String = "")

@Serializable
data class PlaySource(
    val id: Long,
    val flag: String = "",
    val lang: String = "",
    val episode_count: Int = 0,
    val health: Int = 0, // 1正常 0未知 -1死链
    val latency_ms: Int = 0,
    val episodes: List<Episode> = emptyList(),
)

@Serializable
data class TitleDetail(
    val id: Long,
    val kind: Int = 0,
    val name: String = "",
    val season: Int = 0,
    val year: Int = 0,
    val overview: String? = null,
    val director: String? = null,
    val actors: String? = null,
    val area: String? = null,
    val poster: String? = null,
    val backdrop: String? = null,
    val vote_average: Double = 0.0,
    val douban_rating: Double = 0.0,
    val like_count: Int = 0,
    val play_sources: List<PlaySource> = emptyList(),
    val seasons: List<Title> = emptyList(),
)

@Serializable
data class Progress(
    val play_source_id: Long? = null,
    val episode_id: Long? = null,
    val episode_idx: Int = 0,
    val position: Long = 0,
    val duration: Long = 0,
)

@Serializable
data class SkipInfo(val intro_end: Int = 0, val outro_start: Int = 0)

@Serializable
data class DetailResp(
    val detail: TitleDetail,
    val is_favorite: Boolean = false,
    val is_subscribed: Boolean = false,
    val is_liked: Boolean = false,
    val progress: Progress? = null,
    val skip: SkipInfo? = null,
)

@Serializable
data class User(
    val id: Long,
    val username: String = "",
    val nickname: String = "",
    val avatar: String = "",
    val role: Int = 0,
)

@Serializable
data class AuthResult(val token: String, val user: User? = null)

@Serializable
data class FavoriteItem(val id: Long, val title: Title? = null)

@Serializable
data class HistoryItem(
    val id: Long,
    val title: Title? = null,
    val episode_idx: Int = 0,
    val position: Long = 0,
)

@Serializable
data class RequestItem(
    val id: Long,
    val name: String = "",
    val year: Int = 0,
    val kind: Int = 0,
    val status: Int = 0,
    val vote_count: Int = 0,
    val is_voted: Boolean = false,
)

@Serializable
data class VoteResp(val vote_count: Int = 0, val is_voted: Boolean = false)

@Serializable
data class CommentUser(val id: Long = 0, val nickname: String = "", val avatar: String = "")

@Serializable
data class Comment(
    val id: Long,
    val title_id: Long = 0,
    val content: String = "",
    val like_count: Int = 0,
    val is_liked: Boolean = false,
    val created_at: String = "",
    val user: CommentUser? = null,
)

@Serializable
data class NotificationItem(
    val id: Long,
    val kind: Int = 0,
    val title: String = "",
    val body: String = "",
    val is_read: Boolean = false,
    val created_at: String = "",
)

@Serializable
data class Genre(val id: Long = 0, val name: String = "")

// 精选合集预览（/collections 返回，每个带 12 部预览）
@Serializable
data class CollectionPreview(
    val key: String = "",
    val title: String = "",
    val desc: String = "",
    val list: List<Title> = emptyList(),
)

// 某合集分页（/collections/:key 返回）
@Serializable
data class CollectionPage(
    val title: String = "",
    val desc: String = "",
    val list: List<Title> = emptyList(),
    val total: Int = 0,
)
