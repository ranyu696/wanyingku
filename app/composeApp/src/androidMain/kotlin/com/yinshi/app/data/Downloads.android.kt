package com.yinshi.app.data

import android.content.Context
import android.net.Uri
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadRequest
import androidx.media3.exoplayer.offline.DownloadService
import androidx.media3.exoplayer.scheduler.Requirements
import com.yinshi.app.player.DownloadUtil
import com.yinshi.app.player.MediaDownloadService
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
private data class DownloadMeta(val show: String = "", val episode: String = "", val poster: String? = null)

private val metaJson = Json { ignoreUnknownKeys = true }

const val DL_PREFS = "downloads"
const val DL_KEY_WIFI = "wifi_only"
const val DL_KEY_WATCHED = "watched_urls"

@UnstableApi
actual object Downloads {
    private val ctx get() = AppContextHolder.context
    private fun prefs() = ctx.getSharedPreferences(DL_PREFS, Context.MODE_PRIVATE)

    actual suspend fun start(url: String, show: String, episode: String, poster: String?) {
        val meta = metaJson.encodeToString(DownloadMeta.serializer(), DownloadMeta(show, episode, poster))
        val builder = DownloadRequest.Builder(url, Uri.parse(url)).setData(meta.encodeToByteArray())
        if (url.contains(".m3u8")) builder.setMimeType(MimeTypes.APPLICATION_M3U8)
        DownloadService.sendAddDownload(ctx, MediaDownloadService::class.java, builder.build(), false)
    }

    actual suspend fun remove(url: String) {
        DownloadService.sendRemoveDownload(ctx, MediaDownloadService::class.java, url, false)
    }

    actual suspend fun all(): List<DownloadInfo> {
        val out = mutableListOf<DownloadInfo>()
        DownloadUtil.getDownloadManager(ctx).downloadIndex.getDownloads().use { cursor ->
            while (cursor.moveToNext()) out.add(cursor.download.toInfo())
        }
        return out
    }

    actual suspend fun find(url: String): DownloadInfo? =
        DownloadUtil.getDownloadManager(ctx).downloadIndex.getDownload(url)?.toInfo()

    actual suspend fun setWifiOnly(enabled: Boolean) {
        prefs().edit().putBoolean(DL_KEY_WIFI, enabled).apply()
        DownloadUtil.getDownloadManager(ctx).requirements =
            Requirements(if (enabled) Requirements.NETWORK_UNMETERED else Requirements.NETWORK)
    }

    actual suspend fun isWifiOnly(): Boolean = prefs().getBoolean(DL_KEY_WIFI, false)

    actual suspend fun markWatched(url: String) {
        val cur = prefs().getStringSet(DL_KEY_WATCHED, emptySet()) ?: emptySet()
        prefs().edit().putStringSet(DL_KEY_WATCHED, cur + url).apply()
    }

    actual suspend fun watched(): Set<String> =
        prefs().getStringSet(DL_KEY_WATCHED, emptySet()) ?: emptySet()

    private fun Download.toInfo(): DownloadInfo {
        val meta = runCatching {
            metaJson.decodeFromString(DownloadMeta.serializer(), request.data.decodeToString())
        }.getOrNull()
        val pct = if (percentDownloaded.isNaN()) 0 else percentDownloaded.toInt()
        val st = when (state) {
            Download.STATE_COMPLETED -> 1
            Download.STATE_FAILED -> 2
            Download.STATE_REMOVING -> 3
            else -> 0
        }
        return DownloadInfo(
            url = request.id,
            show = meta?.show?.ifBlank { "未命名" } ?: "未命名",
            episode = meta?.episode ?: "",
            poster = meta?.poster,
            percent = pct,
            state = st,
            bytes = bytesDownloaded,
        )
    }
}
