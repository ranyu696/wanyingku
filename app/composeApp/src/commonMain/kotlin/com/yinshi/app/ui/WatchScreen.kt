package com.yinshi.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.yinshi.app.data.Api
import com.yinshi.app.data.DetailResp
import com.yinshi.app.data.Episode
import com.yinshi.app.data.ProgressReq
import com.yinshi.app.data.Session
import com.yinshi.app.player.VideoPlayer
import com.yinshi.app.theme.AppButton
import com.yinshi.app.theme.AppChip
import com.yinshi.app.theme.AppText
import com.yinshi.app.theme.AppTheme
import com.yinshi.app.theme.ButtonVariant
import kotlinx.coroutines.launch

// 选集分段标签（集数多时）
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EpisodeRangeTabs(pages: Int, current: Int, size: Int, total: Int, onPick: (Int) -> Unit) {
    if (pages <= 1) return
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        for (p in 0 until pages) {
            val a = p * size + 1
            val b = minOf((p + 1) * size, total)
            AppChip(text = "$a-$b", selected = p == current, onClick = { onPick(p) })
        }
    }
}

// 独立播放页：详情页点「播放/某一集」才进来，这里才有播放器。
// startEpisodeIdx>=0 直接播该集；否则按上次进度续播、再否则首集。
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WatchScreen(api: Api, id: Long, startEpisodeIdx: Int, onBack: () -> Unit) {
    var resp by remember { mutableStateOf<DetailResp?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var sourceIdx by remember { mutableStateOf(0) }
    var currentEp by remember { mutableStateOf<Episode?>(null) }
    var startMs by remember { mutableStateOf(0L) }
    var curSec by remember { mutableStateOf(0) }
    var marking by remember { mutableStateOf(false) }
    var introMark by remember { mutableStateOf(0) }
    var outroMark by remember { mutableStateOf(0) }
    var panelOpen by remember { mutableStateOf(false) }
    var epPage by remember { mutableStateOf(0) } // 选集分段（集数多时）
    val scope = rememberCoroutineScope()

    LaunchedEffect(id) {
        try {
            val r = api.detail(id)
            resp = r
            val eps = r?.detail?.play_sources?.getOrNull(0)?.episodes ?: emptyList()
            val prog = r?.progress
            val resumeEp = prog?.let { p -> eps.firstOrNull { it.idx == p.episode_idx } }
            val target = when {
                startEpisodeIdx in eps.indices -> eps[startEpisodeIdx]
                resumeEp != null -> resumeEp
                else -> eps.firstOrNull()
            }
            startMs = if (startEpisodeIdx < 0 && resumeEp != null && target?.id == resumeEp.id) prog?.position ?: 0L else 0L
            currentEp = target
        } catch (e: Throwable) {
            error = e.message ?: "加载失败"
        }
    }

    val d = resp?.detail
    val source = d?.play_sources?.getOrNull(sourceIdx)
    val skip = resp?.skip
    val epList = source?.episodes ?: emptyList()
    val epPageSize = 40
    val epPages = (epList.size + epPageSize - 1) / epPageSize
    val epPageCur = epPage.coerceAtMost(maxOf(0, epPages - 1))
    val epView = epList.drop(epPageCur * epPageSize).take(epPageSize)
    // 面板自动跳到当前集所在段
    val curEpIndex = epList.indexOfFirst { it.id == currentEp?.id }
    LaunchedEffect(curEpIndex, sourceIdx) {
        if (curEpIndex >= 0) epPage = curEpIndex / epPageSize
    }
    when {
        error != null -> CenterText("加载失败：$error")
        d == null -> CenterText("加载中…")
        else -> {
            val playerRatio = if (d.kind == 6) 9f / 16f else 16f / 9f // 短剧：9:16 竖屏播放
            Column(
                Modifier.fillMaxWidth()
                    .windowInsetsPadding(WindowInsets.statusBars)
                    .verticalScroll(rememberScrollState()),
            ) {
                Box(Modifier.fillMaxWidth().aspectRatio(playerRatio)) {
                    val ep = currentEp
                    if (ep != null) {
                        VideoPlayer(
                            url = ep.url,
                            modifier = Modifier.fillMaxWidth().aspectRatio(playerRatio),
                            startPositionMs = startMs,
                            onProgress = { pos, dur ->
                                if (Session.isLoggedIn) {
                                    scope.launch {
                                        try {
                                            api.saveProgress(
                                                ProgressReq(
                                                    title_id = id,
                                                    play_source_id = source?.id,
                                                    episode_id = ep.id,
                                                    episode_idx = ep.idx,
                                                    position = pos,
                                                    duration = dur,
                                                ),
                                            )
                                        } catch (_: Throwable) {
                                        }
                                    }
                                }
                            },
                            onEnded = {
                                val list = source?.episodes ?: emptyList()
                                val i = list.indexOfFirst { it.id == ep.id }
                                if (i >= 0 && i + 1 < list.size) {
                                    startMs = 0
                                    currentEp = list[i + 1]
                                }
                            },
                            introEndMs = (skip?.intro_end ?: 0) * 1000L,
                            outroStartMs = (skip?.outro_start ?: 0) * 1000L,
                            onCurrentTimeMs = { curSec = (it / 1000).toInt() },
                        )
                    }
                }

                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        AppButton("← 返回", onClick = onBack, variant = ButtonVariant.Outline)
                        AppText(
                            d.name + (currentEp?.let { " · " + it.name.ifBlank { "第${it.idx}集" } } ?: ""),
                            style = AppTheme.typography.title,
                            maxLines = 1,
                            modifier = Modifier.weight(1f).padding(start = 4.dp),
                        )
                        if ((source?.episodes?.size ?: 0) > 1) {
                            AppButton("选集", onClick = { panelOpen = true }, variant = ButtonVariant.Secondary)
                        }
                    }

                    // 线路切换
                    if (d.play_sources.size > 1) {
                        AppText("线路", style = AppTheme.typography.sectionTitle)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            d.play_sources.forEachIndexed { i, ps ->
                                val tag = when {
                                    ps.health == -1 -> " · 失效"
                                    ps.health == 1 && ps.latency_ms > 0 -> " · ${ps.latency_ms}ms"
                                    else -> ""
                                }
                                AppChip(
                                    text = ps.flag.ifBlank { "线路${i + 1}" } + tag,
                                    selected = i == sourceIdx,
                                    onClick = {
                                        sourceIdx = i
                                        startMs = 0
                                        currentEp = d.play_sources[i].episodes.firstOrNull()
                                    },
                                )
                            }
                        }
                    }

                    // 选集
                    AppText("选集（${source?.episode_count ?: 0}）", style = AppTheme.typography.sectionTitle)
                    EpisodeRangeTabs(epPages, epPageCur, epPageSize, epList.size) { epPage = it }
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        epView.forEach { ep ->
                            AppChip(
                                text = ep.name.ifBlank { "第${ep.idx}集" },
                                selected = currentEp?.id == ep.id,
                                onClick = { startMs = 0; currentEp = ep },
                            )
                        }
                    }

                    // 众包打点（播放中可标）
                    if (currentEp != null) {
                        if (!marking) {
                            AppButton(
                                text = "⏱ 标记片头片尾" + (skip?.let { "（片头${it.intro_end}s/片尾${it.outro_start}s）" } ?: ""),
                                variant = ButtonVariant.Secondary,
                                onClick = {
                                    introMark = skip?.intro_end ?: 0
                                    outroMark = skip?.outro_start ?: 0
                                    marking = true
                                },
                            )
                        } else {
                            AppText("播到片头结束/片尾开始时点对应按钮再提交，大家共享", style = AppTheme.typography.caption, color = AppTheme.colors.textSecondary)
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                AppChip("片头结束=此刻${if (introMark > 0) " ($introMark s)" else ""}", false, { introMark = curSec })
                                AppChip("片尾开始=此刻${if (outroMark > 0) " ($outroMark s)" else ""}", false, { outroMark = curSec })
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                AppButton("提交", onClick = {
                                    if (Session.isLoggedIn) {
                                        scope.launch {
                                            try {
                                                api.submitSkip(id, introMark, outroMark)
                                                resp = api.detail(id)
                                            } catch (_: Throwable) {
                                            }
                                            marking = false
                                        }
                                    } else {
                                        marking = false
                                    }
                                })
                                AppButton("取消", variant = ButtonVariant.Secondary, onClick = { marking = false })
                            }
                        }
                    }
                }
            }

            // 选集浮层：快速切集
            if (panelOpen) {
                Dialog(onDismissRequest = { panelOpen = false }) {
                    Column(
                        Modifier.clip(RoundedCornerShape(12.dp))
                            .background(AppTheme.colors.surface)
                            .heightIn(max = 480.dp)
                            .padding(16.dp)
                            .verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        AppText("选集（${source?.episodes?.size ?: 0}）", style = AppTheme.typography.sectionTitle)
                        EpisodeRangeTabs(epPages, epPageCur, epPageSize, epList.size) { epPage = it }
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            epView.forEach { ep ->
                                AppChip(
                                    text = ep.name.ifBlank { "第${ep.idx}集" },
                                    selected = currentEp?.id == ep.id,
                                    onClick = { startMs = 0; currentEp = ep; panelOpen = false },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
