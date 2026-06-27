package com.yinshi.app.data

// 平台能力统一抽象：所有 Android 专属实现集中到 androidMain 的 AndroidPlatform。
// 取代原先散落在 Persistence/Brand/Push 的顶层 expect/actual 函数
// （也消除 Android Studio 对顶层 expect 函数的「Overload resolution ambiguity」误报）。
interface Platform {
    // 会话 + 轻量偏好持久化（DataStore，重启/清缓存都留存）
    suspend fun persistSession(token: String?, userJson: String?)
    suspend fun loadSession(): SessionData
    suspend fun prefGet(key: String): String?
    suspend fun prefSet(key: String, value: String)

    // 离线缓存：接口原始 JSON 落盘，断网读回
    suspend fun cachePut(key: String, value: String)
    suspend fun cacheGet(key: String): String?

    // 品牌 logo（Coil 可加载的 model）。light=true 取白底浅色版
    fun brandLogo(light: Boolean): Any?

    // FCM 推送
    fun syncPushToken()
    fun isPushEnabled(): Boolean
    fun setPushEnabled(enabled: Boolean)
}

// App 启动时由各平台赋值（Android 见 MainActivity）
lateinit var platform: Platform
