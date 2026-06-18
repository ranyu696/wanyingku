package com.yinshi.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.yinshi.app.data.DownloadInfo
import com.yinshi.app.data.Downloads
import com.yinshi.app.theme.AppButton
import com.yinshi.app.theme.AppChip
import com.yinshi.app.theme.AppText
import com.yinshi.app.theme.AppTheme
import com.yinshi.app.theme.ButtonVariant
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun DownloadsScreen(onBack: () -> Unit, onPlay: (url: String, title: String) -> Unit) {
    var list by remember { mutableStateOf<List<DownloadInfo>>(emptyList()) }
    var expanded by remember { mutableStateOf<Set<String>>(emptySet()) }
    var wifiOnly by remember { mutableStateOf(false) }
    var watched by remember { mutableStateOf<Set<String>>(emptySet()) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) { wifiOnly = try { Downloads.isWifiOnly() } catch (_: Throwable) { false } }
    LaunchedEffect(Unit) { watched = try { Downloads.watched() } catch (_: Throwable) { emptySet() } }
    LaunchedEffect(Unit) {
        while (true) {
            list = try {
                Downloads.all()
            } catch (_: Throwable) {
                emptyList()
            }
            delay(1500)
        }
    }

    // 起播并标记为已看
    fun play(d: DownloadInfo) {
        watched = watched + d.url
        scope.launch { try { Downloads.markWatched(d.url) } catch (_: Throwable) {} }
        onPlay(d.url, "${d.show} ${d.episode}".trim())
    }

    val groups = list.groupBy { it.show }.toList()

    Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars).padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 8.dp)) {
            AppButton("← 返回", onClick = onBack, variant = ButtonVariant.Outline)
            Box(Modifier.weight(1f).padding(start = 12.dp)) {
                AppText("我的下载", style = AppTheme.typography.title)
            }
        }
        // 仅 Wi-Fi 下载开关
        Row(modifier = Modifier.padding(bottom = 8.dp)) {
            AppChip(
                text = if (wifiOnly) "📶 仅 Wi-Fi 下载：开" else "📶 仅 Wi-Fi 下载：关",
                selected = wifiOnly,
                onClick = {
                    val target = !wifiOnly
                    wifiOnly = target
                    scope.launch { try { Downloads.setWifiOnly(target) } catch (_: Throwable) { wifiOnly = !target } }
                },
            )
        }

        if (groups.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                AppText(
                    "还没有缓存的视频\n在详情页点「缓存本集 / 缓存全集」即可离线观看",
                    color = AppTheme.colors.textSecondary,
                    modifier = Modifier.padding(top = 40.dp),
                )
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
                groups.forEach { (show, eps) ->
                    item(key = "h_$show") {
                        GroupHeader(
                            show = show,
                            eps = eps,
                            open = expanded.contains(show),
                            onToggle = {
                                expanded = if (expanded.contains(show)) expanded - show else expanded + show
                            },
                            onResume = {
                                val next = eps.firstOrNull { it.state == 1 && it.url !in watched }
                                    ?: eps.firstOrNull { it.state == 1 }
                                if (next != null) play(next)
                            },
                            onDeleteAll = {
                                scope.launch {
                                    try {
                                        eps.forEach { Downloads.remove(it.url) }
                                        list = list.filterNot { it.show == show }
                                    } catch (_: Throwable) {
                                    }
                                }
                            },
                        )
                    }
                    if (expanded.contains(show)) {
                        items(eps, key = { it.url }) { d ->
                            EpisodeRow(
                                d,
                                onPlay = if (d.state == 1) ({ play(d) }) else null,
                                onDelete = {
                                    scope.launch {
                                        try {
                                            Downloads.remove(d.url)
                                            list = list.filterNot { it.url == d.url }
                                        } catch (_: Throwable) {
                                        }
                                    }
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun GroupHeader(
    show: String,
    eps: List<DownloadInfo>,
    open: Boolean,
    onToggle: () -> Unit,
    onResume: () -> Unit,
    onDeleteAll: () -> Unit,
) {
    val done = eps.count { it.state == 1 }
    val mb = eps.sumOf { it.bytes } / 1024 / 1024
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(AppTheme.colors.surface)
            .clickable(onClick = onToggle).padding(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AsyncImage(
            model = eps.firstOrNull()?.poster,
            contentDescription = show,
            contentScale = ContentScale.Crop,
            modifier = Modifier.size(width = 48.dp, height = 70.dp).clip(RoundedCornerShape(6.dp)),
        )
        Column(Modifier.weight(1f).padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            AppText("${if (open) "▼ " else "▶ "}$show", maxLines = 1)
            AppText(
                "${eps.size} 集 · 完成 $done · ${mb}MB",
                style = AppTheme.typography.caption,
                color = AppTheme.colors.textSecondary,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp), horizontalAlignment = Alignment.End) {
            if (done > 0) {
                AppButton("▶ 续播", onClick = onResume)
            }
            AppButton("删除整剧", onClick = onDeleteAll, variant = ButtonVariant.Outline)
        }
    }
}

@Composable
private fun EpisodeRow(d: DownloadInfo, onPlay: (() -> Unit)?, onDelete: () -> Unit) {
    val status = when (d.state) {
        1 -> "▶ 点击播放 · ${d.bytes / 1024 / 1024}MB"
        2 -> "缓存失败"
        3 -> "删除中…"
        else -> "缓存中 ${d.percent}%"
    }
    Row(
        Modifier.fillMaxWidth().padding(start = 16.dp).clip(RoundedCornerShape(8.dp))
            .background(AppTheme.colors.surfaceVariant)
            .then(if (onPlay != null) Modifier.clickable(onClick = onPlay) else Modifier)
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            AppText(d.episode.ifBlank { "正片" }, maxLines = 1)
            AppText(status, style = AppTheme.typography.caption, color = AppTheme.colors.textSecondary)
            if (d.state == 0) {
                Box(Modifier.fillMaxWidth().padding(top = 2.dp).height(3.dp).background(AppTheme.colors.surface)) {
                    Box(Modifier.fillMaxWidth(d.percent / 100f).height(3.dp).background(AppTheme.colors.primary))
                }
            }
        }
        AppButton("删除", onClick = onDelete, variant = ButtonVariant.Outline)
    }
}
