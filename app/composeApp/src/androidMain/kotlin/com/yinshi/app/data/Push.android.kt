package com.yinshi.app.data

import android.content.Context
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

// 复用一个 Api 实例做令牌注册（避免每次新建 HttpClient）
private val pushApi by lazy { Api() }

private fun pushPrefs() = AppContextHolder.context.getSharedPreferences("push", Context.MODE_PRIVATE)

actual fun isPushEnabled(): Boolean = pushPrefs().getBoolean("enabled", true)

actual fun setPushEnabled(enabled: Boolean) {
    pushPrefs().edit().putBoolean("enabled", enabled).apply()
    FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
        if (token == null) return@addOnSuccessListener
        CoroutineScope(Dispatchers.IO).launch {
            runCatching {
                if (enabled && Session.isLoggedIn) {
                    pushApi.registerPushToken(token)
                } else {
                    pushApi.unregisterPushToken(token)
                }
            }
        }
    }
}

actual fun syncPushToken() {
    if (!Session.isLoggedIn || !isPushEnabled()) return
    FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
        if (token != null && Session.isLoggedIn) {
            CoroutineScope(Dispatchers.IO).launch {
                runCatching { pushApi.registerPushToken(token) }
            }
        }
    }
}
