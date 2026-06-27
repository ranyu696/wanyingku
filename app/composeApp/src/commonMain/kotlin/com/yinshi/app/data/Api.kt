package com.yinshi.app.data

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json

// 后端地址：
//  - Android 模拟器访问宿主机 localhost 用 10.0.2.2
//  - 真机请改成你电脑的局域网 IP，例如 http://192.168.1.10:8080/api/v1
const val BASE_URL = "https://api.wanyingku.com/api/v1"

class Api(private val baseUrl: String = BASE_URL) {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        explicitNulls = false
    }
    private val client = HttpClient {
        install(ContentNegotiation) { json(json) }
        // 自动带 JWT：登录后 Session.token 有值就加 Authorization 头
        defaultRequest {
            Session.token?.let { header(HttpHeaders.Authorization, "Bearer $it") }
        }
    }

    // 读穿缓存：在线则取网络并缓存原始 JSON；离线则读回上次缓存；无缓存才抛错
    private suspend fun cached(key: String, fetch: suspend () -> String): String =
        try {
            fetch().also { platform.cachePut(key, it) }
        } catch (e: Throwable) {
            platform.cacheGet(key) ?: throw e
        }

    // ---- 公开 ----
    suspend fun home(): HomeData =
        json.decodeFromString<Envelope<HomeData>>(
            cached("home") { client.get("$baseUrl/home").bodyAsText() },
        ).data ?: HomeData()

    suspend fun titles(
        kind: Int? = null,
        sort: String = "popular",
        tag: String? = null,
        genre: Int? = null,
        page: Int = 1,
        size: Int = 30,
    ): Paged<Title> =
        client.get("$baseUrl/titles") {
            if (kind != null && kind > 0) parameter("kind", kind)
            if (!tag.isNullOrBlank()) parameter("tag", tag)
            if (genre != null && genre > 0) parameter("genre", genre)
            parameter("sort", sort)
            parameter("page", page)
            parameter("size", size)
        }.body<Envelope<Paged<Title>>>().data ?: Paged()

    suspend fun tags(kind: Int): List<String> =
        client.get("$baseUrl/tags") { parameter("kind", kind) }
            .body<Envelope<List<String>>>().data ?: emptyList()

    suspend fun genres(kind: Int): List<Genre> =
        client.get("$baseUrl/genres") { parameter("kind", kind) }
            .body<Envelope<List<Genre>>>().data ?: emptyList()

    suspend fun collections(): List<CollectionPreview> =
        json.decodeFromString<Envelope<List<CollectionPreview>>>(
            cached("collections") { client.get("$baseUrl/collections").bodyAsText() },
        ).data ?: emptyList()

    suspend fun collectionTitles(key: String): CollectionPage =
        client.get("$baseUrl/collections/$key") { parameter("size", 60) }
            .body<Envelope<CollectionPage>>().data ?: CollectionPage()

    suspend fun randomTitle(kind: Int? = null): Title? =
        client.get("$baseUrl/titles/random") {
            if (kind != null && kind > 0) parameter("kind", kind)
        }.body<Envelope<Title>>().data

    // semantic=true 时走 AI 语义召回（后端无 key 会自动降级为关键词）
    suspend fun search(q: String, semantic: Boolean = false): Paged<Title> =
        client.get("$baseUrl/search") {
            parameter("q", q)
            parameter("size", 30)
            if (semantic) parameter("mode", "semantic")
        }.body<Envelope<Paged<Title>>>().data ?: Paged()

    suspend fun hotSearches(): List<String> =
        client.get("$baseUrl/search/hot").body<Envelope<List<String>>>().data ?: emptyList()

    // 作品评论（公开，登录则带 is_liked）
    suspend fun comments(titleId: Long): List<Comment> =
        client.get("$baseUrl/titles/$titleId/comments") { parameter("size", 50) }
            .body<Envelope<Paged<Comment>>>().data?.list ?: emptyList()

    suspend fun detail(id: Long): DetailResp? =
        json.decodeFromString<Envelope<DetailResp>>(
            cached("detail_$id") { client.get("$baseUrl/titles/$id").bodyAsText() },
        ).data

    // ---- 鉴权 ----
    suspend fun login(username: String, password: String): AuthResult? =
        client.post("$baseUrl/auth/login") {
            contentType(ContentType.Application.Json)
            setBody(LoginReq(username, password))
        }.body<Envelope<AuthResult>>().data

    suspend fun register(username: String, password: String, nickname: String): AuthResult? =
        client.post("$baseUrl/auth/register") {
            contentType(ContentType.Application.Json)
            setBody(RegisterReq(username, password, nickname))
        }.body<Envelope<AuthResult>>().data

    // ---- 需登录 ----
    suspend fun favorites(): List<FavoriteItem> =
        client.get("$baseUrl/me/favorites").body<Envelope<Paged<FavoriteItem>>>().data?.list ?: emptyList()

    // 订阅(追更)列表，复用 {id,title} 形状
    suspend fun subscriptions(): List<FavoriteItem> =
        client.get("$baseUrl/me/subscriptions").body<Envelope<Paged<FavoriteItem>>>().data?.list ?: emptyList()

    // 为你推荐（个性化片单，冷启动后端自动降级热门）
    suspend fun recommend(limit: Int = 18): List<Title> =
        client.get("$baseUrl/me/recommend") { parameter("limit", limit) }
            .body<Envelope<List<Title>>>().data ?: emptyList()

    suspend fun addComment(titleId: Long, content: String): Comment? =
        client.post("$baseUrl/comments") {
            contentType(ContentType.Application.Json)
            setBody(CommentReq(titleId, content))
        }.body<Envelope<Comment>>().data

    suspend fun deleteComment(id: Long) {
        client.delete("$baseUrl/comments/$id")
    }

    suspend fun likeComment(id: Long, on: Boolean) {
        if (on) client.post("$baseUrl/comments/$id/like") else client.delete("$baseUrl/comments/$id/like")
    }

    suspend fun likeTitle(id: Long, on: Boolean) {
        if (on) client.post("$baseUrl/titles/$id/like") else client.delete("$baseUrl/titles/$id/like")
    }

    // ---- 通知 ----
    suspend fun notifications(): List<NotificationItem> =
        client.get("$baseUrl/me/notifications").body<Envelope<Paged<NotificationItem>>>().data?.list ?: emptyList()

    suspend fun unreadCount(): Int =
        client.get("$baseUrl/me/notifications/unread").body<Envelope<UnreadResp>>().data?.unread ?: 0

    suspend fun markNotificationRead(id: Long) {
        client.post("$baseUrl/me/notifications/$id/read")
    }

    suspend fun markAllNotificationsRead() {
        client.post("$baseUrl/me/notifications/read-all")
    }

    // 注册本机 FCM 令牌（登录后/拿到 token 时调用）
    suspend fun registerPushToken(token: String, platform: String = "android") {
        client.post("$baseUrl/me/push-token") {
            contentType(ContentType.Application.Json)
            setBody(PushTokenReq(token, platform))
        }
    }

    // 注销本机令牌（关闭推送/登出）
    suspend fun unregisterPushToken(token: String) {
        client.delete("$baseUrl/me/push-token") {
            contentType(ContentType.Application.Json)
            setBody(PushTokenReq(token))
        }
    }

    suspend fun history(): List<HistoryItem> =
        client.get("$baseUrl/me/history").body<Envelope<Paged<HistoryItem>>>().data?.list ?: emptyList()

    suspend fun addFavorite(titleId: Long) {
        client.post("$baseUrl/me/favorites") {
            contentType(ContentType.Application.Json)
            setBody(TitleIdReq(titleId))
        }
    }

    suspend fun removeFavorite(titleId: Long) {
        client.delete("$baseUrl/me/favorites/$titleId")
    }

    suspend fun subscribe(titleId: Long) {
        client.post("$baseUrl/me/subscriptions") {
            contentType(ContentType.Application.Json)
            setBody(TitleIdReq(titleId))
        }
    }

    suspend fun unsubscribe(titleId: Long) {
        client.delete("$baseUrl/me/subscriptions/$titleId")
    }

    suspend fun saveProgress(req: ProgressReq) {
        client.post("$baseUrl/me/history") {
            contentType(ContentType.Application.Json)
            setBody(req)
        }
    }

    // 相关推荐（看了还看）
    suspend fun related(id: Long): List<Title> =
        client.get("$baseUrl/titles/$id/related") { parameter("limit", 12) }
            .body<Envelope<List<Title>>>().data ?: emptyList()

    // 演员/导演作品
    suspend fun people(name: String): List<Title> =
        client.get("$baseUrl/people") { parameter("name", name) }
            .body<Envelope<Paged<Title>>>().data?.list ?: emptyList()

    // 提交片头片尾打点（需登录）
    suspend fun submitSkip(id: Long, introEnd: Int, outroStart: Int) {
        client.post("$baseUrl/titles/$id/skip") {
            contentType(ContentType.Application.Json)
            setBody(SkipReq(introEnd, outroStart))
        }
    }

    // ---- 求片 ----
    suspend fun requests(status: Int = -1): List<RequestItem> =
        client.get("$baseUrl/requests") {
            if (status >= 0) parameter("status", status)
            parameter("size", 50)
        }.body<Envelope<Paged<RequestItem>>>().data?.list ?: emptyList()

    suspend fun createRequest(name: String, year: Int?) {
        client.post("$baseUrl/requests") {
            contentType(ContentType.Application.Json)
            setBody(CreateReqReq(name, year))
        }
    }

    suspend fun voteRequest(id: Long, on: Boolean): VoteResp? =
        if (on) {
            client.post("$baseUrl/requests/$id/vote").body<Envelope<VoteResp>>().data
        } else {
            client.delete("$baseUrl/requests/$id/vote").body<Envelope<VoteResp>>().data
        }
}

@Serializable
private data class LoginReq(val username: String, val password: String)

@Serializable
private data class RegisterReq(val username: String, val password: String, val nickname: String)

@Serializable
private data class TitleIdReq(val title_id: Long)

@Serializable
private data class CommentReq(val title_id: Long, val content: String)

@Serializable
private data class PushTokenReq(val token: String, val platform: String = "android")

@Serializable
private data class UnreadResp(val unread: Int = 0)

@Serializable
private data class CreateReqReq(val name: String, val year: Int? = null)

@Serializable
private data class SkipReq(val intro_end: Int, val outro_start: Int)

@Serializable
data class ProgressReq(
    val title_id: Long,
    val play_source_id: Long? = null,
    val episode_id: Long? = null,
    val episode_idx: Int,
    val position: Long,
    val duration: Long,
)
