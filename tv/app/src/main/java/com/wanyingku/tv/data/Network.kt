package com.wanyingku.tv.data

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.wanyingku.tv.BuildConfig
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNamingStrategy
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit

object Network {
    @OptIn(ExperimentalSerializationApi::class)
    val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
        explicitNulls = false
        // 驼峰 ↔ 蛇形：vote_average / title_id / is_favorite 等自动映射，省去逐字段注解。
        namingStrategy = JsonNamingStrategy.SnakeCase
    }

    fun create(tokenStore: TokenStore): Api {
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC else HttpLoggingInterceptor.Level.NONE
        }
        val client = OkHttpClient.Builder()
            .addInterceptor { chain ->
                val req = chain.request().newBuilder().apply {
                    tokenStore.token?.let { header("Authorization", "Bearer $it") }
                }.build()
                val res = chain.proceed(req)
                if (res.code == 401) tokenStore.clear() // 令牌失效：与 Web 一致，清登录态
                res
            }
            .addInterceptor(logging)
            .build()

        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(Api::class.java)
    }
}

// 图床地址支持 ?w= 缩放（仅自有 /api/v1/img/）。卡片取小图省带宽。
fun String?.poster(width: Int = 400): String? {
    if (this.isNullOrBlank()) return null
    return if (contains("/api/v1/img/")) "$this?w=$width" else this
}
