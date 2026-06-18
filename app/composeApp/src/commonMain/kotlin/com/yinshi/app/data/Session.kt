package com.yinshi.app.data

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

// 登录态（内存版）。Compose 读 token/user 会自动重组。
// TODO 持久化：加 androidx.datastore（多平台）把 token 落盘，App 启动时回填。
object Session {
    var token by mutableStateOf<String?>(null)
        private set
    var user by mutableStateOf<User?>(null)
        private set

    val isLoggedIn: Boolean get() = token != null

    fun login(result: AuthResult) {
        token = result.token
        user = result.user
    }

    fun logout() {
        token = null
        user = null
    }

    fun restore(token: String?, user: User?) {
        this.token = token
        this.user = user
    }
}
