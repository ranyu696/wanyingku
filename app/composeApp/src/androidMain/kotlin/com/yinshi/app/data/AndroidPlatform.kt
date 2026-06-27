package com.yinshi.app.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStoreFile
import com.google.firebase.messaging.FirebaseMessaging
import com.yinshi.app.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

// 全局 App Context（在 MainActivity.onCreate 里赋值）。Downloads 等也用它。
object AppContextHolder {
    lateinit var context: Context
}

// Android 平台实现：会话/偏好（DataStore）、离线缓存（文件）、品牌图、FCM 推送。
class AndroidPlatform : Platform {
    private val context get() = AppContextHolder.context
    private val pushApi by lazy { Api() }

    private val dataStore: DataStore<Preferences> by lazy {
        PreferenceDataStoreFactory.create { context.preferencesDataStoreFile("session") }
    }

    private fun cacheDir(): File = File(context.cacheDir, "apicache").apply { mkdirs() }
    private fun pushPrefs() = context.getSharedPreferences("push", Context.MODE_PRIVATE)

    override suspend fun persistSession(token: String?, userJson: String?) {
        dataStore.edit { prefs ->
            if (token == null) prefs.remove(KEY_TOKEN) else prefs[KEY_TOKEN] = token
            if (userJson == null) prefs.remove(KEY_USER) else prefs[KEY_USER] = userJson
        }
    }

    override suspend fun loadSession(): SessionData {
        val prefs = dataStore.data.first()
        return SessionData(prefs[KEY_TOKEN], prefs[KEY_USER])
    }

    override suspend fun prefGet(key: String): String? =
        dataStore.data.first()[stringPreferencesKey(key)]

    override suspend fun prefSet(key: String, value: String) {
        dataStore.edit { it[stringPreferencesKey(key)] = value }
    }

    override suspend fun cachePut(key: String, value: String) {
        withContext(Dispatchers.IO) {
            runCatching { File(cacheDir(), key.hashCode().toString()).writeText(value) }
        }
    }

    override suspend fun cacheGet(key: String): String? = withContext(Dispatchers.IO) {
        runCatching {
            val f = File(cacheDir(), key.hashCode().toString())
            if (f.exists()) f.readText() else null
        }.getOrNull()
    }

    override fun brandLogo(light: Boolean): Any? =
        if (light) R.drawable.brand_logo_light else R.drawable.brand_logo

    override fun isPushEnabled(): Boolean = pushPrefs().getBoolean("enabled", true)

    override fun setPushEnabled(enabled: Boolean) {
        pushPrefs().edit().putBoolean("enabled", enabled).apply()
        // 未配置 Firebase（无 google-services.json）时 getInstance() 会抛，runCatching 兜住 → 推送静默失效
        runCatching {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                if (token == null) return@addOnSuccessListener
                CoroutineScope(Dispatchers.IO).launch {
                    runCatching {
                        if (enabled && Session.isLoggedIn) pushApi.registerPushToken(token)
                        else pushApi.unregisterPushToken(token)
                    }
                }
            }
        }
    }

    override fun syncPushToken() {
        if (!Session.isLoggedIn || !isPushEnabled()) return
        runCatching {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                if (token != null && Session.isLoggedIn) {
                    CoroutineScope(Dispatchers.IO).launch {
                        runCatching { pushApi.registerPushToken(token) }
                    }
                }
            }
        }
    }

    private companion object {
        val KEY_TOKEN = stringPreferencesKey("token")
        val KEY_USER = stringPreferencesKey("user")
    }
}
