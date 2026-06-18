package com.yinshi.app.data

// 一条下载（一集）。state: 0排队/下载中 1已完成 2失败 3移除中
data class DownloadInfo(
    val url: String,
    val show: String,
    val episode: String,
    val poster: String?,
    val percent: Int,
    val state: Int,
    val bytes: Long,
)

// 下载控制入口（Android 用 Media3 DownloadService，见 androidMain 的 actual）。
expect object Downloads {
    suspend fun start(url: String, show: String, episode: String, poster: String?)
    suspend fun remove(url: String)
    suspend fun all(): List<DownloadInfo>
    suspend fun find(url: String): DownloadInfo?
    suspend fun setWifiOnly(enabled: Boolean)
    suspend fun isWifiOnly(): Boolean
    suspend fun markWatched(url: String)
    suspend fun watched(): Set<String>
}
