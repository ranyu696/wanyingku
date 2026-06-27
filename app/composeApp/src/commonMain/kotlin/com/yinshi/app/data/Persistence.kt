package com.yinshi.app.data

import kotlinx.serialization.json.Json

data class SessionData(val token: String?, val userJson: String?)

// 持久化 / 缓存 / 推送等平台能力已收敛到 [Platform] 接口（见 Platform.kt + androidMain/AndroidPlatform）。

// 记住上次线路：全局存一个线路 flag，下次打开有同名线路就自动选中（没有则回退首条）
object LinePref {
    private const val KEY = "last_source_flag"

    suspend fun get(): String? = platform.prefGet(KEY)

    suspend fun set(flag: String) {
        if (flag.isNotBlank()) platform.prefSet(KEY, flag)
    }

    fun pick(sources: List<PlaySource>, pref: String?): Int =
        sources.indexOfFirst { it.flag.isNotBlank() && it.flag == pref }.takeIf { it >= 0 } ?: 0
}

private val sessionJson = Json { ignoreUnknownKeys = true }

// 登录态 + 持久化的统一入口
object SessionManager {
    suspend fun signIn(result: AuthResult) {
        Session.login(result)
        platform.persistSession(result.token, result.user?.let { sessionJson.encodeToString(User.serializer(), it) })
    }

    suspend fun signOut() {
        Session.logout()
        platform.persistSession(null, null)
    }

    // App 启动时回填（重启免登录）
    suspend fun restore() {
        val s = platform.loadSession()
        if (s.token != null) {
            val user = s.userJson?.let {
                runCatching { sessionJson.decodeFromString(User.serializer(), it) }.getOrNull()
            }
            Session.restore(s.token, user)
        }
    }
}
