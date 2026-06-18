package com.yinshi.app.data

import kotlinx.serialization.json.Json

data class SessionData(val token: String?, val userJson: String?)

// 平台持久化（Android 用 DataStore，见 androidMain）
expect suspend fun persistSession(token: String?, userJson: String?)

expect suspend fun loadSession(): SessionData

// 离线缓存：把接口原始 JSON 存盘，断网时读回（home/detail/collections 可离线浏览）
expect suspend fun cachePut(key: String, value: String)

expect suspend fun cacheGet(key: String): String?

private val sessionJson = Json { ignoreUnknownKeys = true }

// 登录态 + 持久化的统一入口
object SessionManager {
    suspend fun signIn(result: AuthResult) {
        Session.login(result)
        persistSession(result.token, result.user?.let { sessionJson.encodeToString(User.serializer(), it) })
    }

    suspend fun signOut() {
        Session.logout()
        persistSession(null, null)
    }

    // App 启动时回填（重启免登录）
    suspend fun restore() {
        val s = loadSession()
        if (s.token != null) {
            val user = s.userJson?.let {
                runCatching { sessionJson.decodeFromString(User.serializer(), it) }.getOrNull()
            }
            Session.restore(s.token, user)
        }
    }
}
