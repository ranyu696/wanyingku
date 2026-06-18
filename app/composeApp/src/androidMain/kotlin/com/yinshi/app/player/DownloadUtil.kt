package com.yinshi.app.player

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.cache.Cache
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.NoOpCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.scheduler.Requirements
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import java.io.File
import java.util.concurrent.Executors
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
private data class DoneMeta(val show: String = "", val episode: String = "")

private val doneJson = Json { ignoreUnknownKeys = true }
private const val DONE_CHANNEL = "yinshi_dl_done"

// 下载 + 播放共享同一份 SimpleCache：下载过的分片，播放时直接命中缓存（离线可播）。
@UnstableApi
object DownloadUtil {
    private const val DIR = "downloads"
    private var cache: Cache? = null
    private var manager: DownloadManager? = null

    private fun httpFactory() = DefaultHttpDataSource.Factory()
        .setUserAgent("yinshi")
        .setAllowCrossProtocolRedirects(true)

    @Synchronized
    fun getCache(context: Context): Cache =
        cache ?: SimpleCache(
            File(context.applicationContext.filesDir, DIR),
            NoOpCacheEvictor(),
            StandaloneDatabaseProvider(context.applicationContext),
        ).also { cache = it }

    @Synchronized
    fun getDownloadManager(context: Context): DownloadManager =
        manager ?: run {
            val ctx = context.applicationContext
            // 读持久化的「仅 Wi-Fi」偏好（与 Downloads.setWifiOnly 同一份 SharedPreferences）
            val wifiOnly = ctx.getSharedPreferences("downloads", Context.MODE_PRIVATE).getBoolean("wifi_only", false)
            DownloadManager(
                ctx,
                StandaloneDatabaseProvider(ctx),
                getCache(ctx),
                DefaultDataSource.Factory(ctx, httpFactory()),
                Executors.newFixedThreadPool(3),
            ).apply {
                requirements = Requirements(if (wifiOnly) Requirements.NETWORK_UNMETERED else Requirements.NETWORK)
                // 下载完成弹本地通知
                addListener(object : DownloadManager.Listener {
                    override fun onDownloadChanged(downloadManager: DownloadManager, download: Download, finalException: Exception?) {
                        if (download.state == Download.STATE_COMPLETED) notifyDone(ctx, download)
                    }
                })
            }.also { manager = it }
        }

    private fun notifyDone(ctx: Context, download: Download) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        if (nm.getNotificationChannel(DONE_CHANNEL) == null) {
            nm.createNotificationChannel(NotificationChannel(DONE_CHANNEL, "下载完成", NotificationManager.IMPORTANCE_DEFAULT))
        }
        val meta = runCatching {
            doneJson.decodeFromString(DoneMeta.serializer(), download.request.data.decodeToString())
        }.getOrNull()
        val name = listOfNotNull(
            meta?.show?.takeIf { it.isNotBlank() },
            meta?.episode?.takeIf { it.isNotBlank() },
        ).joinToString(" ").ifBlank { "视频" }
        val n = Notification.Builder(ctx, DONE_CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle("缓存完成")
            .setContentText("$name 已可离线观看")
            .setAutoCancel(true)
            .build()
        nm.notify(download.request.id.hashCode(), n)
    }

    // 读穿缓存的数据源：命中缓存走本地，未命中走网络（下载完即离线可播）
    private fun cacheDataSourceFactory(context: Context): DataSource.Factory {
        val ctx = context.applicationContext
        return CacheDataSource.Factory()
            .setCache(getCache(ctx))
            .setUpstreamDataSourceFactory(DefaultDataSource.Factory(ctx, httpFactory()))
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
    }

    // 用缓存数据源构建播放器（HLS/普通流都经 DefaultMediaSourceFactory）
    fun buildPlayer(context: Context): ExoPlayer =
        ExoPlayer.Builder(context)
            .setMediaSourceFactory(DefaultMediaSourceFactory(cacheDataSourceFactory(context)))
            .build()
}
