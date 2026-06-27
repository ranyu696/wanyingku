package com.wanyingku.tv.data

import kotlinx.coroutines.flow.StateFlow

// 业务取数层：拆 Go 信封（code!=0 抛 ApiException），登录态托管。
class Repository(private val api: Api, private val tokenStore: TokenStore) {

    val user: StateFlow<User?> get() = tokenStore.user
    val isLoggedIn: Boolean get() = tokenStore.isLoggedIn

    // 记住上次线路（按 flag）
    fun preferredLineFlag(): String? = tokenStore.lineFlag
    fun rememberLine(flag: String) { if (flag.isNotBlank()) tokenStore.lineFlag = flag }

    private fun <T> ApiResp<T>.unwrap(): T {
        if (code != 0) throw ApiException(message ?: "请求失败")
        return data ?: throw ApiException(message ?: "无数据")
    }

    private fun ApiResp<*>.check() {
        if (code != 0) throw ApiException(message ?: "请求失败")
    }

    // ---- 浏览 ----
    suspend fun home() = api.home().unwrap()
    suspend fun titles(
        kind: Int? = null, genre: Long? = null, year: Int? = null, region: String? = null,
        tag: String? = null, sort: String? = null, adult: Int? = null, page: Int = 1, size: Int = 24,
    ) = api.titles(kind, genre, year, region, tag, sort, adult, page, size).unwrap()

    suspend fun detail(id: Long) = api.title(id).unwrap()
    suspend fun related(id: Long, limit: Int = 12) = api.related(id, limit).unwrap()
    suspend fun collections() = api.collections().unwrap()
    suspend fun collection(key: String, page: Int = 1, size: Int = 30) = api.collection(key, page, size).unwrap()
    suspend fun search(q: String, kind: Int? = null, sort: String? = null, page: Int = 1, size: Int = 24) =
        api.search(q, kind, sort, page, size).unwrap()

    suspend fun hotSearches(limit: Int = 10) = api.hotSearches(limit).unwrap()
    suspend fun genres(kind: Int? = null) = api.genres(kind).unwrap()
    suspend fun requests(status: Int = -1, page: Int = 1, size: Int = 24) = api.requests(status, page, size).unwrap()
    suspend fun comments(id: Long, page: Int = 1, size: Int = 20) = api.comments(id, page, size).unwrap()

    // ---- 鉴权 ----
    suspend fun login(username: String, password: String): User {
        val res = api.login(LoginBody(username.trim(), password)).unwrap()
        tokenStore.save(res)
        return res.user
    }

    suspend fun register(username: String, password: String, nickname: String): User {
        val res = api.register(RegisterBody(username.trim(), password, nickname.trim())).unwrap()
        tokenStore.save(res)
        return res.user
    }

    fun logout() = tokenStore.clear()

    // ---- 我的 ----
    suspend fun favorites(page: Int = 1) = api.favorites(page).unwrap()
    suspend fun addFavorite(id: Long) = api.addFavorite(IdBody(id)).check()
    suspend fun removeFavorite(id: Long) = api.removeFavorite(id).check()
    suspend fun history(page: Int = 1) = api.history(page).unwrap()
    suspend fun saveProgress(b: ProgressBody) = api.saveProgress(b).check()
    suspend fun deleteHistory(id: Long) = api.deleteHistory(id).check()
    suspend fun recommend(limit: Int = 12) = api.recommend(limit).unwrap()
    suspend fun subscriptions(page: Int = 1) = api.subscriptions(page).unwrap()
    suspend fun subscribe(id: Long) = api.subscribe(IdBody(id)).check()
    suspend fun unsubscribe(id: Long) = api.unsubscribe(id).check()
    suspend fun notifications(page: Int = 1) = api.notifications(page).unwrap()
    suspend fun unread() = api.unread().unwrap().unread
    suspend fun markRead(id: Long) = api.markRead(id).check()
    suspend fun markAllRead() = api.markAllRead().check()
    suspend fun myRequests(page: Int = 1) = api.myRequests(page).unwrap()

    // ---- 互动 ----
    suspend fun createRequest(name: String, year: Int, kind: Int, note: String) =
        api.createRequest(NewRequestBody(name.trim(), year, kind, note.trim())).unwrap()

    suspend fun vote(id: Long) = api.vote(id).unwrap()
    suspend fun unvote(id: Long) = api.unvote(id).unwrap()
    suspend fun addComment(titleId: Long, content: String) = api.addComment(CommentBody(titleId, content.trim())).unwrap()
    suspend fun likeTitle(id: Long, on: Boolean) = (if (on) api.likeTitle(id) else api.unlikeTitle(id)).check()
    suspend fun submitSkip(id: Long, introEnd: Int, outroStart: Int) =
        api.submitSkip(id, SkipBody(introEnd, outroStart)).check()
}
