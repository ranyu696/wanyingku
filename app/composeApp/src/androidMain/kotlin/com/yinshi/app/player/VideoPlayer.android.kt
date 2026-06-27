package com.yinshi.app.player

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.ActivityInfo
import android.media.AudioManager
import android.view.WindowInsets
import android.view.WindowInsetsController
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.movableContentOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.media3.cast.CastPlayer
import androidx.media3.cast.SessionAvailabilityListener
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.ui.PlayerView
import androidx.mediarouter.media.MediaRouteSelector
import androidx.mediarouter.media.MediaRouter
import com.google.android.gms.cast.CastMediaControlIntent
import com.google.android.gms.cast.framework.CastContext
import kotlin.math.abs
import kotlinx.coroutines.delay

private val BRAND = Color(0xFFFF3D5A)

private fun Context.findActivity(): Activity? {
    var c: Context? = this
    while (c is ContextWrapper) {
        if (c is Activity) return c
        c = c.baseContext
    }
    return null
}

private fun fmt(ms: Long): String {
    if (ms <= 0) return "00:00"
    val s = ms / 1000
    val m = s / 60
    val sec = s % 60
    return if (m >= 60) "${m / 60}:${(m % 60).toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}"
    else "${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}"
}

private fun speedLabel(s: Float): String = if (s % 1f == 0f) s.toInt().toString() else s.toString()

@Composable
private fun CtrlBtn(text: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier.clip(RoundedCornerShape(12.dp)).background(Color(0x66000000))
            .clickable(onClick = onClick).padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        BasicText(text, style = TextStyle(color = Color.White, fontSize = 13.sp))
    }
}

// Android 实现：Media3/ExoPlayer 播 m3u8（HLS）。播放走共享缓存数据源 → 下载过的可离线播。
// 自定义控件：单击显隐、双击左右 ∓10s、横拖进度、左竖拖亮度/右竖拖音量、倍速、锁屏、横屏全屏。
@UnstableApi
@Composable
actual fun VideoPlayer(
    url: String,
    modifier: Modifier,
    startPositionMs: Long,
    onProgress: (positionMs: Long, durationMs: Long) -> Unit,
    onEnded: () -> Unit,
    introEndMs: Long,
    outroStartMs: Long,
    onCurrentTimeMs: (Long) -> Unit,
) {
    val context = LocalContext.current
    val activity = remember { context.findActivity() }
    val audio = remember { context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager }
    val exo = remember { DownloadUtil.buildPlayer(context) }
    // 投屏（Chromecast）：无 Google Play 服务时 CastContext 为 null，整段优雅降级
    val castContext = remember { runCatching { CastContext.getSharedInstance(context.applicationContext) }.getOrNull() }
    val castPlayer = remember(castContext) { castContext?.let { CastPlayer(it) } }
    val mediaRouter = remember { runCatching { MediaRouter.getInstance(context.applicationContext) }.getOrNull() }
    val castSelector = remember {
        MediaRouteSelector.Builder()
            .addControlCategory(
                CastMediaControlIntent.categoryForCast(CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID),
            )
            .build()
    }
    var casting by remember { mutableStateOf(false) }
    var castDevice by remember { mutableStateOf("") }
    var pickerOpen by remember { mutableStateOf(false) }
    val curUrl by rememberUpdatedState(url)
    val progress by rememberUpdatedState(onProgress)
    val ended by rememberUpdatedState(onEnded)
    val curTime by rememberUpdatedState(onCurrentTimeMs)

    var cur by remember { mutableStateOf(0L) }
    var duration by remember { mutableStateOf(0L) }
    var isPlaying by remember { mutableStateOf(true) }
    var controls by remember { mutableStateOf(true) }
    var speed by remember { mutableStateOf(1f) }
    var speedMenu by remember { mutableStateOf(false) }
    var dragging by remember { mutableStateOf(false) }
    var seekTarget by remember { mutableStateOf(-1L) }
    var overlayInfo by remember { mutableStateOf<String?>(null) }
    var fullscreen by remember { mutableStateOf(false) }
    var locked by remember { mutableStateOf(false) }
    var lockHint by remember { mutableStateOf(false) }

    DisposableEffect(exo) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) ended()
                if (playbackState == Player.STATE_READY) duration = exo.duration.coerceAtLeast(0L)
            }

            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
            }
        }
        exo.addListener(listener)
        onDispose { exo.removeListener(listener) }
    }
    // 投屏接管：连上设备→暂停本地、把当前 url+进度推给 CastPlayer；断开→回本地续播
    DisposableEffect(castPlayer) {
        val cp = castPlayer ?: return@DisposableEffect onDispose { }
        val l = object : SessionAvailabilityListener {
            override fun onCastSessionAvailable() {
                casting = true
                castDevice = castContext?.sessionManager?.currentCastSession?.castDevice?.friendlyName ?: ""
                exo.pause()
                cp.setMediaItem(
                    MediaItem.Builder().setUri(curUrl).setMimeType(MimeTypes.APPLICATION_M3U8).build(),
                    exo.currentPosition,
                )
                cp.playWhenReady = true
                cp.prepare()
            }

            override fun onCastSessionUnavailable() {
                casting = false
                val pos = cp.currentPosition
                if (pos > 0) exo.seekTo(pos)
                exo.play()
            }
        }
        cp.setSessionAvailabilityListener(l)
        onDispose {
            cp.setSessionAvailabilityListener(null)
            cp.release()
        }
    }
    DisposableEffect(url) {
        exo.setMediaItem(MediaItem.fromUri(url))
        exo.prepare()
        if (startPositionMs > 0) exo.seekTo(startPositionMs)
        exo.playWhenReady = true
        onDispose { }
    }
    LaunchedEffect(speed) { exo.setPlaybackSpeed(speed) }
    LaunchedEffect(exo) {
        while (true) {
            delay(5000)
            val pos = exo.currentPosition
            val dur = exo.duration
            if (pos > 0 && dur > 0) progress(pos, dur)
        }
    }
    LaunchedEffect(exo) {
        while (true) {
            delay(1000)
            cur = exo.currentPosition
            if (duration <= 0) duration = exo.duration.coerceAtLeast(0L)
            curTime(cur)
        }
    }
    LaunchedEffect(controls, isPlaying, dragging) {
        if (controls && isPlaying && !dragging) {
            delay(3500)
            controls = false
        }
    }
    LaunchedEffect(overlayInfo, dragging) {
        if (overlayInfo != null && !dragging) {
            delay(700)
            overlayInfo = null
        }
    }
    // 全屏：横屏 + 沉浸式系统栏（minSdk 30，直接用平台 WindowInsetsController）
    DisposableEffect(fullscreen) {
        val a = activity
        if (a != null) {
            val ctl = a.window.insetsController
            if (fullscreen) {
                a.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                ctl?.hide(WindowInsets.Type.systemBars())
                ctl?.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            } else {
                a.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                ctl?.show(WindowInsets.Type.systemBars())
            }
        }
        onDispose { }
    }
    DisposableEffect(Unit) {
        onDispose {
            exo.release()
            activity?.let { a ->
                a.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                a.window.insetsController?.show(WindowInsets.Type.systemBars())
            }
        }
    }

    // 同一份播放表面（含 PlayerView/手势/控件）——用 movableContent 在内联与全屏 Dialog 间移动，不重建。
    val surface = remember {
        movableContentOf {
            val displayPos = if (seekTarget >= 0) seekTarget else cur
            val showIntro = !locked && introEndMs > 0 && cur in 2000L until introEndMs
            val showOutro = !locked && !showIntro && outroStartMs > 0 && cur >= outroStartMs

            Box(Modifier.fillMaxSize().background(Color.Black)) {
                AndroidView(
                    factory = { ctx -> PlayerView(ctx).apply { player = exo; useController = false } },
                    modifier = Modifier.fillMaxSize(),
                )

                if (locked) {
                    Box(
                        Modifier.fillMaxSize().pointerInput(Unit) {
                            detectTapGestures { lockHint = !lockHint }
                        },
                        contentAlignment = Alignment.CenterStart,
                    ) {
                        if (lockHint) {
                            CtrlBtn("🔓 解锁", Modifier.padding(start = 20.dp)) { locked = false; lockHint = false }
                        }
                    }
                } else {
                    // 手势层
                    Box(
                        Modifier.fillMaxSize()
                            .pointerInput(Unit) {
                                detectTapGestures(
                                    onTap = { controls = !controls },
                                    onDoubleTap = { offset ->
                                        val forward = offset.x > size.width / 2
                                        val target = (exo.currentPosition + if (forward) 10_000 else -10_000)
                                            .coerceIn(0L, duration.coerceAtLeast(0L))
                                        exo.seekTo(target)
                                        overlayInfo = if (forward) "⏩ +10s" else "⏪ -10s"
                                    },
                                )
                            }
                            .pointerInput(duration) {
                                var mode = 0 // 0未定 1横(进度) 2竖(亮度/音量)
                                var leftSide = false
                                detectDragGestures(
                                    onDragStart = { off ->
                                        dragging = true
                                        mode = 0
                                        leftSide = off.x < size.width / 2
                                        seekTarget = exo.currentPosition
                                    },
                                    onDragEnd = {
                                        if (mode == 1 && seekTarget >= 0 && duration > 0) exo.seekTo(seekTarget)
                                        dragging = false
                                        seekTarget = -1
                                        overlayInfo = null
                                    },
                                    onDragCancel = {
                                        dragging = false
                                        seekTarget = -1
                                        overlayInfo = null
                                    },
                                    onDrag = { change, dragAmount ->
                                        change.consume()
                                        if (mode == 0) mode = if (abs(dragAmount.x) > abs(dragAmount.y)) 1 else 2
                                        if (mode == 1) {
                                            val perPx = if (size.width > 0) 90_000f / size.width else 0f
                                            val base = if (seekTarget >= 0) seekTarget else exo.currentPosition
                                            seekTarget = (base + (dragAmount.x * perPx).toLong())
                                                .coerceIn(0L, duration.coerceAtLeast(0L))
                                            overlayInfo = "${fmt(seekTarget)} / ${fmt(duration)}"
                                        } else {
                                            val frac = if (size.height > 0) -dragAmount.y / size.height else 0f
                                            if (leftSide && activity != null) {
                                                val lp = activity.window.attributes
                                                var b = (if (lp.screenBrightness < 0f) 0.5f else lp.screenBrightness) + frac
                                                b = b.coerceIn(0.02f, 1f)
                                                lp.screenBrightness = b
                                                activity.window.attributes = lp
                                                overlayInfo = "☀ ${(b * 100).toInt()}%"
                                            } else if (audio != null) {
                                                val max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
                                                val nv = (audio.getStreamVolume(AudioManager.STREAM_MUSIC) +
                                                    (frac * max * 2).toInt()).coerceIn(0, max)
                                                audio.setStreamVolume(AudioManager.STREAM_MUSIC, nv, 0)
                                                overlayInfo = if (max > 0) "🔊 ${nv * 100 / max}%" else "🔊"
                                            }
                                        }
                                    },
                                )
                            },
                    )

                    if (controls) {
                        Box(
                            Modifier.fillMaxSize().background(Color(0x33000000)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Box(
                                Modifier.size(64.dp).clip(CircleShape).background(Color(0x66000000))
                                    .clickable { if (exo.isPlaying) exo.pause() else exo.play() },
                                contentAlignment = Alignment.Center,
                            ) {
                                BasicText(if (isPlaying) "❚❚" else "▶", style = TextStyle(color = Color.White, fontSize = 24.sp))
                            }
                        }
                        Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                BasicText(
                                    "${fmt(displayPos)} / ${fmt(duration)}",
                                    style = TextStyle(color = Color.White, fontSize = 12.sp),
                                )
                                Box(Modifier.weight(1f))
                                CtrlBtn("🔒", Modifier.padding(start = 8.dp)) { locked = true; controls = false; lockHint = false }
                                CtrlBtn("${speedLabel(speed)}x", Modifier.padding(start = 8.dp)) { speedMenu = !speedMenu }
                                CtrlBtn(if (fullscreen) "退出" else "全屏", Modifier.padding(start = 8.dp)) { fullscreen = !fullscreen }
                                if (castContext != null) {
                                    CtrlBtn(if (casting) "📺✓" else "📺", Modifier.padding(start = 8.dp)) { pickerOpen = true }
                                }
                            }
                            Box(Modifier.fillMaxWidth().padding(top = 6.dp).height(3.dp).background(Color(0x55FFFFFF))) {
                                val f = if (duration > 0) (displayPos.toFloat() / duration).coerceIn(0f, 1f) else 0f
                                Box(Modifier.fillMaxWidth(f).height(3.dp).background(BRAND))
                            }
                        }
                        if (speedMenu) {
                            Column(Modifier.align(Alignment.BottomEnd).padding(bottom = 52.dp, end = 12.dp)) {
                                listOf(2f, 1.5f, 1.25f, 1f, 0.75f, 0.5f).forEach { s ->
                                    Box(
                                        Modifier.padding(vertical = 2.dp).clip(RoundedCornerShape(10.dp))
                                            .background(Color(0xCC000000))
                                            .clickable { speed = s; speedMenu = false }
                                            .padding(horizontal = 16.dp, vertical = 8.dp),
                                    ) {
                                        BasicText(
                                            "${speedLabel(s)}x",
                                            style = TextStyle(color = if (s == speed) BRAND else Color.White, fontSize = 14.sp),
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                overlayInfo?.let {
                    Box(
                        Modifier.align(Alignment.Center).clip(RoundedCornerShape(8.dp))
                            .background(Color(0xCC000000)).padding(horizontal = 16.dp, vertical = 8.dp),
                    ) {
                        BasicText(it, style = TextStyle(color = Color.White, fontSize = 15.sp))
                    }
                }

                if (showIntro) {
                    SkipPill("跳过片头", Modifier.align(Alignment.BottomEnd).padding(bottom = 40.dp, end = 16.dp)) {
                        exo.seekTo(introEndMs)
                    }
                } else if (showOutro) {
                    SkipPill("下一集 ▶", Modifier.align(Alignment.BottomEnd).padding(bottom = 40.dp, end = 16.dp)) { ended() }
                }

                if (casting && castPlayer != null) {
                    CastingOverlay(castDevice, castPlayer) {
                        mediaRouter?.unselect(MediaRouter.UNSELECT_REASON_STOPPED)
                    }
                }
            }
        }
    }

    if (fullscreen) {
        Dialog(
            onDismissRequest = { fullscreen = false },
            properties = DialogProperties(usePlatformDefaultWidth = false, dismissOnBackPress = true),
        ) {
            Box(Modifier.fillMaxSize().background(Color.Black)) { surface() }
        }
    } else {
        Box(modifier) { surface() }
    }

    if (pickerOpen) {
        CastPicker(
            mediaRouter = mediaRouter,
            selector = castSelector,
            casting = casting,
            onStop = {
                mediaRouter?.unselect(MediaRouter.UNSELECT_REASON_STOPPED)
                pickerOpen = false
            },
            onDismiss = { pickerOpen = false },
        )
    }
}

@Composable
private fun SkipPill(text: String, modifier: Modifier, onClick: () -> Unit) {
    Box(
        modifier
            .clip(RoundedCornerShape(20.dp))
            .background(Color(0xCC000000))
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        BasicText(text, style = TextStyle(color = Color.White, fontSize = 14.sp))
    }
}
