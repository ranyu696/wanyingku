package com.wanyingku.tv.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.json.Json

// JWT + 当前用户的本地持久化。token 供 OkHttp 拦截器同步读取，user 以 StateFlow 暴露给 UI。
class TokenStore(context: Context) {
    private val prefs = context.getSharedPreferences("wanyingku", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    @Volatile
    var token: String? = prefs.getString(KEY_TOKEN, null)
        private set

    private val _user = MutableStateFlow(loadUser())
    val user: StateFlow<User?> = _user

    val isLoggedIn: Boolean get() = token != null

    // 记住上次线路（按 flag，全局一个）：详情/播放默认选中同名线路
    var lineFlag: String?
        get() = prefs.getString(KEY_LINE_FLAG, null)
        set(value) {
            prefs.edit().putString(KEY_LINE_FLAG, value).apply()
        }

    private fun loadUser(): User? =
        prefs.getString(KEY_USER, null)?.let { runCatching { json.decodeFromString<User>(it) }.getOrNull() }

    fun save(auth: AuthResult) {
        token = auth.token
        prefs.edit()
            .putString(KEY_TOKEN, auth.token)
            .putString(KEY_USER, json.encodeToString(User.serializer(), auth.user))
            .apply()
        _user.value = auth.user
    }

    fun clear() {
        token = null
        prefs.edit().remove(KEY_TOKEN).remove(KEY_USER).apply()
        _user.value = null
    }

    private companion object {
        const val KEY_TOKEN = "yinshi_token"
        const val KEY_USER = "yinshi_user"
        const val KEY_LINE_FLAG = "yinshi_line_flag"
    }
}
