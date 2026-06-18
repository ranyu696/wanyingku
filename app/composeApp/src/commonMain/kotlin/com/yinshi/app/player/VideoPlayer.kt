package com.yinshi.app.player

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

// 多平台播放器入口。Android 用 Media3/ExoPlayer 播 m3u8（见 androidMain 的 actual）。
// 以后加 iOS 时，在 iosMain 补一个 AVPlayer 的 actual 即可，commonMain 调用方不变。
// startPositionMs：起播位置（续播）。onProgress：每隔几秒回调当前位置/总时长（用于进度回传）。
// 注意：@Composable expect 不要写默认值——Compose 插件会给带默认值的 expect 生成 $default 掩码，
// 而 actual 不能重复默认值，导致 expect/actual 签名对不上。调用方（DetailScreen）显式传齐 5 个参数。
@Composable
expect fun VideoPlayer(
    url: String,
    modifier: Modifier,
    startPositionMs: Long,
    onProgress: (positionMs: Long, durationMs: Long) -> Unit,
    onEnded: () -> Unit,
    introEndMs: Long, // 片头结束(ms)，0=无
    outroStartMs: Long, // 片尾开始(ms)，0=无
    onCurrentTimeMs: (Long) -> Unit, // 1s 上报当前位置(用于打点)
)
