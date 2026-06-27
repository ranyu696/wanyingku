package com.wanyingku.tv.ui.player

import android.view.ViewGroup
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.viewModelScope
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.wanyingku.tv.Graph
import com.wanyingku.tv.data.Episode
import com.wanyingku.tv.data.PlaySource
import com.wanyingku.tv.data.ProgressBody
import com.wanyingku.tv.data.Repository
import com.wanyingku.tv.ui.Loadable
import com.wanyingku.tv.ui.appViewModel
import com.wanyingku.tv.ui.components.CenterMessage
import com.wanyingku.tv.ui.components.Chip
import com.wanyingku.tv.ui.components.Loading
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

data class PlayData(
    val titleId: Long,
    val lines: List<PlaySource>, // 全部可播放线路
    val startLine: Int,
    val startIndex: Int,
    val startPosMs: Long,
    val introEnd: Int,
    val outroStart: Int,
)

class PlayerViewModel(private val repo: Repository) : ViewModel() {
    var state by mutableStateOf(Loadable<PlayData>()); private set
    private val loggedIn get() = repo.isLoggedIn

    fun load(id: Long, lineIdx: Int, epIdx: Int) {
        if (!state.loading && state.data != null) return
        viewModelScope.launch {
            runCatching {
                val resp = repo.detail(id)
                val playable = resp.detail.playSources.filter { it.episodes.isNotEmpty() }
                if (playable.isEmpty()) throw IllegalStateException("暂无可播放线路")
                // 详情页传入的是原始 playSources 下标，映射到「可播放」列表
                val chosen = resp.detail.playSources.getOrNull(lineIdx)
                val startLine = (chosen?.let { playable.indexOf(it) } ?: -1).takeIf { it >= 0 } ?: 0
                val eps = playable[startLine].episodes
                val start = epIdx.coerceIn(0, eps.lastIndex)
                val p = resp.progress
                val startPos = if (p != null && p.playSourceId == playable[startLine].id && p.episodeIdx == eps[start].idx)
                    p.position.toLong() * 1000 else 0L
                PlayData(id, playable, startLine, start, startPos, resp.skip?.introEnd ?: 0, resp.skip?.outroStart ?: 0)
            }.onSuccess { state = Loadable.ok(it) }.onFailure { state = Loadable.fail(it.message) }
        }
    }

    fun rememberLine(flag: String) = repo.rememberLine(flag)

    fun save(titleId: Long, playSourceId: Long, episode: Episode?, posSec: Int, durSec: Int) {
        if (!loggedIn || posSec <= 0 || episode == null) return
        viewModelScope.launch {
            runCatching { repo.saveProgress(ProgressBody(titleId, playSourceId, episode.id, episode.idx, posSec, durSec)) }
        }
    }
}

@Composable
fun PlayerScreen(id: Long, lineIdx: Int, epIdx: Int, onBack: () -> Unit) {
    val vm = appViewModel { PlayerViewModel(Graph.repository) }
    LaunchedEffect(id, lineIdx, epIdx) { vm.load(id, lineIdx, epIdx) }
    BackHandler(onBack = onBack)

    val s = vm.state
    when {
        s.loading -> Loading()
        s.error != null -> CenterMessage(s.error!!)
        else -> Playback(vm, s.data!!)
    }
}

private fun fmt(ms: Long): String {
    if (ms <= 0) return "00:00"
    val sec = ms / 1000
    val h = sec / 3600
    val m = (sec % 3600) / 60
    val s = sec % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%02d:%02d".format(m, s)
}

@Composable
private fun Playback(vm: PlayerViewModel, data: PlayData) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    val player = remember {
        ExoPlayer.Builder(context).build().apply {
            val eps = data.lines[data.startLine].episodes
            setMediaItems(eps.map { MediaItem.fromUri(it.url) }, data.startIndex, data.startPosMs)
            prepare()
            playWhenReady = true
        }
    }

    var currentLine by remember { mutableIntStateOf(data.startLine) }
    var currentIndex by remember { mutableIntStateOf(data.startIndex) }
    var buffering by remember { mutableStateOf(true) }
    var isPlaying by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var positionMs by remember { mutableLongStateOf(0L) }
    var durationMs by remember { mutableLongStateOf(0L) }
    var controlsVisible by remember { mutableStateOf(true) }
    var controlsKey by remember { mutableIntStateOf(0) }
    var panelOpen by remember { mutableStateOf(false) }

    val line = data.lines[currentLine]
    val episodes = line.episodes

    fun showControls() { controlsVisible = true; controlsKey++ }
    fun togglePlay() { if (player.isPlaying) player.pause() else player.play() }
    fun seekBy(deltaMs: Long) {
        val to = (player.currentPosition + deltaMs).coerceIn(0, player.duration.coerceAtLeast(0))
        player.seekTo(to)
    }
    fun retry() { error = null; player.prepare(); player.play() }

    fun switchLine(i: Int) {
        if (i == currentLine) return
        val oldEps = data.lines[currentLine].episodes
        val curIdxVal = oldEps.getOrNull(player.currentMediaItemIndex)?.idx
        val pos = player.currentPosition
        val newEps = data.lines[i].episodes
        if (newEps.isEmpty()) return
        val target = newEps.indexOfFirst { it.idx == curIdxVal }.takeIf { it >= 0 } ?: 0
        val matched = newEps.getOrNull(target)?.idx == curIdxVal
        player.setMediaItems(newEps.map { MediaItem.fromUri(it.url) }, target, if (matched) pos else 0L)
        player.prepare()
        player.playWhenReady = true
        currentLine = i
        currentIndex = target
        error = null
        vm.rememberLine(data.lines[i].flag)
    }

    fun playEpisode(i: Int) {
        player.seekTo(i, 0L)
        player.playWhenReady = true
        currentIndex = i
        panelOpen = false
    }

    // 监听：缓冲、播放态、错误、切集。
    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) { buffering = state == Player.STATE_BUFFERING }
            override fun onIsPlayingChanged(playing: Boolean) { isPlaying = playing }
            override fun onPlayerError(e: PlaybackException) { error = "无法播放（${e.errorCodeName}）" }
            override fun onMediaItemTransition(item: MediaItem?, reason: Int) {
                error = null
                currentIndex = player.currentMediaItemIndex
                showControls()
            }
        }
        player.addListener(listener)
        onDispose { player.removeListener(listener) }
    }

    DisposableEffect(lifecycleOwner) {
        val obs = LifecycleEventObserver { _, e -> if (e == Lifecycle.Event.ON_STOP) player.pause() }
        lifecycleOwner.lifecycle.addObserver(obs)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(obs)
            val ln = data.lines[currentLine]
            vm.save(data.titleId, ln.id, ln.episodes.getOrNull(player.currentMediaItemIndex), (player.currentPosition / 1000).toInt(), (player.duration.coerceAtLeast(0) / 1000).toInt())
            player.release()
        }
    }

    // 1s 心跳：刷进度条 + 跳片头/片尾 + 每 15s 存进度。
    val lineRef = rememberUpdatedState(currentLine)
    LaunchedEffect(player) {
        var tick = 0
        var skippedIntroAt = -1
        while (true) {
            delay(1000)
            durationMs = player.duration.coerceAtLeast(0)
            positionMs = player.currentPosition.coerceAtLeast(0)
            if (!player.isPlaying) continue
            val ln = data.lines[lineRef.value]
            val idx = player.currentMediaItemIndex
            val posSec = (positionMs / 1000).toInt()
            if (data.introEnd > 1 && posSec in 1 until data.introEnd && skippedIntroAt != idx) {
                player.seekTo(data.introEnd.toLong() * 1000); skippedIntroAt = idx
            } else if (skippedIntroAt != idx && posSec >= data.introEnd) {
                skippedIntroAt = idx
            }
            if (data.outroStart > 1 && posSec >= data.outroStart && player.hasNextMediaItem()) {
                player.seekToNextMediaItem(); continue
            }
            if (++tick % 15 == 0) vm.save(data.titleId, ln.id, ln.episodes.getOrNull(idx), posSec, (durationMs / 1000).toInt())
        }
    }

    // 控制条 4s 自动隐藏（面板开着时不隐藏）。
    LaunchedEffect(controlsVisible, controlsKey, panelOpen) {
        if (controlsVisible && !panelOpen) { delay(4000); controlsVisible = false }
    }

    val rootFocus = remember { FocusRequester() }
    val panelFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { rootFocus.requestFocus() } }
    LaunchedEffect(panelOpen) {
        if (panelOpen) { delay(60); runCatching { panelFocus.requestFocus() } }
        else runCatching { rootFocus.requestFocus() }
    }

    val canOpenPanel = data.lines.size > 1 || episodes.size > 1

    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black)
            .focusRequester(rootFocus)
            .onKeyEvent { e ->
                if (e.type != KeyEventType.KeyDown || panelOpen) return@onKeyEvent false
                when (e.key) {
                    Key.DirectionCenter, Key.Enter, Key.MediaPlayPause -> {
                        if (error != null) retry() else togglePlay(); showControls(); true
                    }
                    Key.DirectionLeft -> { seekBy(-10_000); showControls(); true }
                    Key.DirectionRight -> { seekBy(10_000); showControls(); true }
                    Key.DirectionUp -> { if (canOpenPanel) panelOpen = true else showControls(); true }
                    Key.DirectionDown -> { showControls(); true }
                    Key.MediaNext -> { if (player.hasNextMediaItem()) player.seekToNextMediaItem(); true }
                    Key.MediaPrevious -> { if (player.hasPreviousMediaItem()) player.seekToPreviousMediaItem(); true }
                    else -> { showControls(); false }
                }
            }
            .focusable(),
    ) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                PlayerView(ctx).apply {
                    this.player = player
                    useController = false // 控制交给 Compose，避免和 D-pad 焦点打架
                    keepScreenOn = true
                    isFocusable = false
                    (this as ViewGroup).descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
                }
            },
        )

        if (buffering && error == null) {
            CircularProgressIndicator(color = Color.White, modifier = Modifier.align(Alignment.Center))
        }

        // 顶部：线路 · 集名
        if (controlsVisible && error == null) {
            val epName = episodes.getOrNull(currentIndex)?.name?.ifBlank { "第${currentIndex + 1}集" } ?: ""
            Text(
                listOfNotNull(line.displayName.takeIf { data.lines.size > 1 }, epName).joinToString(" · "),
                style = MaterialTheme.typography.titleMedium,
                color = Color.White,
                modifier = Modifier.align(Alignment.TopStart).padding(32.dp)
                    .background(Color(0x80000000), MaterialTheme.shapes.small)
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            )
        }

        // 底部：进度条 + 时间 + 操作提示
        if (controlsVisible && error == null) {
            Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(32.dp)) {
                val frac = if (durationMs > 0) (positionMs.toFloat() / durationMs).coerceIn(0f, 1f) else 0f
                Box(Modifier.fillMaxWidth().height(4.dp).background(Color(0x55FFFFFF))) {
                    Box(Modifier.fillMaxWidth(frac).height(4.dp).background(MaterialTheme.colorScheme.primary))
                }
                Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("${fmt(positionMs)} / ${fmt(durationMs)}", color = Color.White, style = MaterialTheme.typography.labelLarge)
                    Text(
                        "OK 播放/暂停   ← → 快退/快进 10s" + if (canOpenPanel) "   ↑ 线路 / 选集" else "",
                        color = Color(0xFFB6B6C2),
                        style = MaterialTheme.typography.labelMedium,
                    )
                }
            }
        }

        // 出错覆盖层
        error?.let { msg ->
            Column(
                Modifier.align(Alignment.Center).background(Color(0xCC000000), MaterialTheme.shapes.medium).padding(28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(msg, color = Color.White, style = MaterialTheme.typography.titleSmall)
                Text("按 OK 重试" + if (canOpenPanel) " · 按 ↑ 换线路/选集" else "", color = Color(0xFFB6B6C2), style = MaterialTheme.typography.labelMedium)
            }
        }

        // 线路 / 选集 抽屉
        if (panelOpen) {
            BackHandler(enabled = true) { panelOpen = false }
            val focusOnLine = data.lines.size > 1
            Box(Modifier.fillMaxSize().background(Color(0xB3000000))) {
                Column(
                    Modifier.align(Alignment.CenterEnd).fillMaxHeight().width(480.dp)
                        .background(Color(0xF21C1C26)).padding(24.dp),
                ) {
                    if (data.lines.size > 1) {
                        Text("线路（${data.lines.size}）", style = MaterialTheme.typography.titleMedium, color = Color.White, modifier = Modifier.padding(bottom = 8.dp))
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(data.lines.size) { i ->
                                val ps = data.lines[i]
                                val label = ps.displayName + (if (ps.lang.isNotBlank()) "·${ps.lang}" else "") + (if (ps.dead) "·失效" else "")
                                val m = if (focusOnLine && i == currentLine) Modifier.focusRequester(panelFocus) else Modifier
                                Chip(label, selected = i == currentLine, onClick = { switchLine(i) }, modifier = m)
                            }
                        }
                    }
                    Text("选集（${episodes.size}）", style = MaterialTheme.typography.titleMedium, color = Color.White, modifier = Modifier.padding(top = 16.dp, bottom = 8.dp))
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(4),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth().weight(1f),
                    ) {
                        items(episodes.size) { i ->
                            val m = if (!focusOnLine && i == currentIndex) Modifier.focusRequester(panelFocus) else Modifier
                            Chip(episodes[i].name.ifBlank { "第${i + 1}集" }, selected = i == currentIndex, onClick = { playEpisode(i) }, modifier = m)
                        }
                    }
                }
            }
        }
    }
}
