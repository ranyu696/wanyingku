package com.wanyingku.tv.data

import kotlinx.serialization.Serializable

// Go 统一响应信封 {code,message,data}。code != 0 视为业务错误。
@Serializable
data class ApiResp<T>(val code: Int = 0, val message: String? = null, val data: T? = null)

@Serializable
data class Paged<T>(
    val list: List<T> = emptyList(),
    val total: Long = 0,
    val page: Int = 1,
    val size: Int = 24,
)

// 动作型接口的占位返回体（{ok:true} / {} / null 都接得住）。
@Serializable
class Ok

@Serializable
data class Title(
    val id: Long = 0,
    val slug: String? = null,
    val kind: Int = 0,
    val name: String = "",
    val originalName: String? = null,
    val season: Int = 0,
    val year: Int = 0,
    val overview: String? = null,
    val director: String? = null,
    val actors: String? = null,
    val area: String? = null,
    val poster: String? = null,
    val posterBlurhash: String? = null,
    val backdrop: String? = null,
    val backdropBlurhash: String? = null,
    val voteAverage: Double = 0.0,
    val voteCount: Int = 0,
    val doubanRating: Double = 0.0,
    val doubanVotes: Int = 0,
    val popularity: Double = 0.0,
    val likeCount: Int = 0,
    val sourceCount: Int = 0,
    val latestEpisode: Int = 0,
    val totalEpisodes: Int = 0,
    val serialComplete: Boolean = false,
    val adult: Boolean = false,
    val genreIds: List<Long> = emptyList(),
)

@Serializable
data class Genre(val id: Long = 0, val name: String = "")

@Serializable
data class SourceRef(val id: Int = 0, val name: String = "")

@Serializable
data class Episode(
    val id: Long = 0,
    val playSourceId: Long = 0,
    val titleId: Long = 0,
    val idx: Int = 0,
    val name: String = "",
    val url: String = "",
)

@Serializable
data class PlaySource(
    val id: Long = 0,
    val titleId: Long = 0,
    val sourceId: Int = 0,
    val flag: String = "",
    val lang: String = "",
    val quality: String? = null,
    val episodeCount: Int = 0,
    val health: Int = 0, // 1 正常 0 未知 -1 死链
    val latencyMs: Int = 0,
    val episodes: List<Episode> = emptyList(),
    val source: SourceRef? = null,
) {
    val displayName: String get() = source?.name?.ifBlank { "线路" } ?: "线路"
    val dead: Boolean get() = health == -1
}

// 详情：扁平的 Title 字段 + 题材/别名/播放源/季。
@Serializable
data class TitleDetail(
    val id: Long = 0,
    val slug: String? = null,
    val kind: Int = 0,
    val name: String = "",
    val originalName: String? = null,
    val season: Int = 0,
    val year: Int = 0,
    val overview: String? = null,
    val director: String? = null,
    val actors: String? = null,
    val area: String? = null,
    val poster: String? = null,
    val posterBlurhash: String? = null,
    val backdrop: String? = null,
    val backdropBlurhash: String? = null,
    val voteAverage: Double = 0.0,
    val voteCount: Int = 0,
    val doubanRating: Double = 0.0,
    val doubanVotes: Int = 0,
    val likeCount: Int = 0,
    val latestEpisode: Int = 0,
    val totalEpisodes: Int = 0,
    val serialComplete: Boolean = false,
    val adult: Boolean = false,
    val genreIds: List<Long> = emptyList(),
    val genres: List<Genre> = emptyList(),
    val aliases: List<String> = emptyList(),
    val playSources: List<PlaySource> = emptyList(),
    val seasons: List<Title> = emptyList(),
)

@Serializable
data class Progress(
    val playSourceId: Long? = null,
    val episodeId: Long? = null,
    val episodeIdx: Int = 0,
    val position: Int = 0,
    val duration: Int = 0,
)

@Serializable
data class Skip(val introEnd: Int = 0, val outroStart: Int = 0)

@Serializable
data class DetailResp(
    val detail: TitleDetail = TitleDetail(),
    val isFavorite: Boolean = false,
    val isSubscribed: Boolean = false,
    val isLiked: Boolean = false,
    val progress: Progress? = null,
    val skip: Skip? = null,
)

@Serializable
data class HomeSection(
    val title: String = "",
    val kind: Int = 0,
    val sort: String? = null,
    val list: List<Title> = emptyList(),
)

@Serializable
data class HomeData(
    val banners: List<Title>? = null,
    val sections: List<HomeSection>? = null,
)

@Serializable
data class Collection(
    val key: String = "",
    val title: String = "",
    val desc: String = "",
    val list: List<Title> = emptyList(),
)

@Serializable
data class User(
    val id: Long = 0,
    val username: String = "",
    val nickname: String = "",
    val avatar: String = "",
    val role: Int = 0,
)

@Serializable
data class AuthResult(val token: String = "", val user: User = User())

@Serializable
data class Comment(
    val id: Long = 0,
    val titleId: Long = 0,
    val content: String = "",
    val likeCount: Int = 0,
    val isLiked: Boolean = false,
    val createdAt: String = "",
    val user: User? = null,
)

@Serializable
data class Favorite(
    val id: Long = 0,
    val titleId: Long = 0,
    val createdAt: String = "",
    val title: Title? = null,
)

@Serializable
data class WatchHistory(
    val id: Long = 0,
    val titleId: Long = 0,
    val playSourceId: Long? = null,
    val episodeId: Long? = null,
    val episodeIdx: Int = 0,
    val position: Int = 0,
    val duration: Int = 0,
    val updatedAt: String = "",
    val title: Title? = null,
)

@Serializable
data class Subscription(
    val id: Long = 0,
    val titleId: Long = 0,
    val lastNotifiedEpisode: Int = 0,
    val createdAt: String = "",
    val title: Title? = null,
)

@Serializable
data class Notification(
    val id: Long = 0,
    val kind: Int = 0,
    val title: String = "",
    val body: String = "",
    val isRead: Boolean = false,
    val createdAt: String = "",
)

@Serializable
data class RequestItem(
    val id: Long = 0,
    val name: String = "",
    val year: Int = 0,
    val kind: Int = 0,
    val note: String = "",
    val status: Int = 0,
    val titleId: Long? = null,
    val voteCount: Int = 0,
    val isVoted: Boolean = false,
    val createdAt: String = "",
)

@Serializable
data class VoteResp(val voteCount: Int = 0, val isVoted: Boolean = false)

@Serializable
data class UnreadResp(val unread: Long = 0)

// ---- 请求体（SnakeCase 策略：title_id / intro_end 等自动映射）----
@Serializable
data class LoginBody(val username: String, val password: String)

@Serializable
data class RegisterBody(val username: String, val password: String, val nickname: String)

@Serializable
data class IdBody(val titleId: Long)

@Serializable
data class ProgressBody(
    val titleId: Long,
    val playSourceId: Long? = null,
    val episodeId: Long? = null,
    val episodeIdx: Int,
    val position: Int,
    val duration: Int,
)

@Serializable
data class CommentBody(val titleId: Long, val content: String)

@Serializable
data class SkipBody(val introEnd: Int, val outroStart: Int)

@Serializable
data class NewRequestBody(val name: String, val year: Int, val kind: Int, val note: String)

// 业务错误码标签
val KIND_LABELS = mapOf(
    1 to "电影", 2 to "电视剧", 3 to "综艺", 4 to "动漫",
    5 to "纪录片", 6 to "短剧", 7 to "体育",
)

val REQ_STATUS = mapOf(0 to "待处理", 1 to "处理中", 2 to "已满足", 3 to "已拒绝")

class ApiException(message: String) : Exception(message)
