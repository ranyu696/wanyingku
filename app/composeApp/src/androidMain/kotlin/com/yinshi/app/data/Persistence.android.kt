package com.yinshi.app.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStoreFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import java.io.File

// 全局 App Context（在 MainActivity.onCreate 里赋值）
object AppContextHolder {
    lateinit var context: Context
}

private val KEY_TOKEN = stringPreferencesKey("token")
private val KEY_USER = stringPreferencesKey("user")

private val dataStore: DataStore<Preferences> by lazy {
    PreferenceDataStoreFactory.create {
        AppContextHolder.context.preferencesDataStoreFile("session")
    }
}

actual suspend fun persistSession(token: String?, userJson: String?) {
    dataStore.edit { prefs ->
        if (token == null) prefs.remove(KEY_TOKEN) else prefs[KEY_TOKEN] = token
        if (userJson == null) prefs.remove(KEY_USER) else prefs[KEY_USER] = userJson
    }
}

actual suspend fun loadSession(): SessionData {
    val prefs = dataStore.data.first()
    return SessionData(prefs[KEY_TOKEN], prefs[KEY_USER])
}

private fun cacheDir(): File =
    File(AppContextHolder.context.cacheDir, "apicache").apply { mkdirs() }

actual suspend fun cachePut(key: String, value: String) {
    withContext(Dispatchers.IO) {
        runCatching { File(cacheDir(), key.hashCode().toString()).writeText(value) }
    }
}

actual suspend fun cacheGet(key: String): String? = withContext(Dispatchers.IO) {
    runCatching {
        val f = File(cacheDir(), key.hashCode().toString())
        if (f.exists()) f.readText() else null
    }.getOrNull()
}
