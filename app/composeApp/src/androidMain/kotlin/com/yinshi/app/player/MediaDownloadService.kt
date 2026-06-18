package com.yinshi.app.player

import android.app.Notification
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.offline.DownloadService
import androidx.media3.exoplayer.scheduler.Scheduler
import com.yinshi.app.R

// Media3 下载前台服务。getScheduler()=null：不做开机/退出后续传，仅在服务存活时下载（够用、少依赖）。
// 通知频道由父类构造函数用 CHANNEL_ID + download_channel_name 自动建好。
@UnstableApi
class MediaDownloadService : DownloadService(
    FOREGROUND_NOTIFICATION_ID,
    DEFAULT_FOREGROUND_NOTIFICATION_UPDATE_INTERVAL,
    CHANNEL_ID,
    R.string.download_channel_name,
    0,
) {
    override fun getDownloadManager(): DownloadManager = DownloadUtil.getDownloadManager(this)

    override fun getScheduler(): Scheduler? = null

    override fun getForegroundNotification(downloads: List<Download>, notMetRequirements: Int): Notification {
        val active = downloads.count { it.state == Download.STATE_DOWNLOADING }
        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle("正在缓存视频")
            .setContentText(if (active > 0) "进行中 $active 个" else "处理中…")
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val FOREGROUND_NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "yinshi_downloads"
    }
}
