package com.yinshi.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.yinshi.app.data.Api
import com.yinshi.app.data.Comment
import com.yinshi.app.data.DetailResp
import com.yinshi.app.data.DownloadInfo
import com.yinshi.app.data.Downloads
import com.yinshi.app.data.LinePref
import com.yinshi.app.data.Session
import com.yinshi.app.data.Title
import com.yinshi.app.theme.AppButton
import com.yinshi.app.theme.AppChip
import com.yinshi.app.theme.AppText
import com.yinshi.app.theme.AppTextField
import com.yinshi.app.theme.AppTheme
import com.yinshi.app.theme.ButtonVariant
import com.yinshi.app.ui.components.PosterCard
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private fun splitNames(s: String): List<String> =
    s.split(',', '，', '、', '/', ' ').map { it.trim() }.filter { it.isNotBlank() }.take(10)

// 演职员头像底色：按名字取色
private val AV_COLORS = listOf(
    Color(0xFFE8506E), Color(0xFF7C5CFF), Color(0xFF2BB673), Color(0xFFF5A623),
    Color(0xFF3AA0FF), Color(0xFFD6517D), Color(0xFF26A69A), Color(0xFF8D6E63),
)

private fun colorOf(s: String): Color = AV_COLORS[s.sumOf { it.code } % AV_COLORS.size]

// SectionTitle 分区标题：左侧品牌色竖条 + 粗体，拉开内容层级
@Composable
private fun SectionTitle(text: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(top = 6.dp),
    ) {
        Box(
            Modifier.size(width = 3.dp, height = 16.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(AppTheme.colors.primary),
        )
        AppText(text, style = AppTheme.typography.sectionTitle, modifier = Modifier.padding(start = 8.dp))
    }
}

// CommentRow 单条评论：昵称 + 内容 + 点赞（无状态，点赞后由上层重拉刷新）。
@Composable
private fun CommentRow(c: Comment, onToggleLike: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        AppText(
            c.user?.nickname?.takeIf { it.isNotBlank() } ?: "用户",
            style = AppTheme.typography.caption,
            color = AppTheme.colors.textSecondary,
        )
        AppText(c.content)
        AppChip(
            text = "👍" + if (c.like_count > 0) " ${c.like_count}" else "",
            selected = c.is_liked,
            onClick = onToggleLike,
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DetailScreen(
    api: Api,
    id: Long,
    onBack: () -> Unit,
    onOpen: (Long) -> Unit,
    onOpenPerson: (String) -> Unit,
    onOpenWatch: (Long, Int) -> Unit,
) {
    var resp by remember { mutableStateOf<DetailResp?>(null) }
    var related by remember { mutableStateOf<List<Title>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var sourceIdx by remember { mutableStateOf(0) }
    var isFav by remember { mutableStateOf(false) }
    var isSub by remember { mutableStateOf(false) }
    var isLiked by remember { mutableStateOf(false) }
    var likeCount by remember { mutableStateOf(0) }
    var comments by remember { mutableStateOf<List<Comment>>(emptyList()) }
    var commentText by remember { mutableStateOf("") }
    var posting by remember { mutableStateOf(false) }
    var dlMap by remember { mutableStateOf<Map<String, DownloadInfo>>(emptyMap()) }
    var epPage by remember { mutableStateOf(0) } // 选集分段（集数多时）
    val scope = rememberCoroutineScope()

    LaunchedEffect(id) {
        try {
            resp = api.detail(id)
            sourceIdx = LinePref.pick(resp?.detail?.play_sources ?: emptyList(), LinePref.get())
            isFav = resp?.is_favorite == true
            isSub = resp?.is_subscribed == true
            isLiked = resp?.is_liked == true
            likeCount = resp?.detail?.like_count ?: 0
        } catch (e: Throwable) {
            error = e.message ?: "加载失败"
        }
        related = try {
            api.related(id)
        } catch (_: Throwable) {
            emptyList()
        }
        comments = try {
            api.comments(id)
        } catch (_: Throwable) {
            emptyList()
        }
    }

    // 轮询全部下载状态 → 按 url 建表，供选集标记 + 本集/全集按钮共用
    LaunchedEffect(Unit) {
        while (true) {
            dlMap = try {
                Downloads.all().associateBy { it.url }
            } catch (_: Throwable) {
                emptyMap()
            }
            delay(2000)
        }
    }

    val d = resp?.detail
    when {
        error != null -> CenterText("加载失败：$error")
        d == null -> CenterText("加载中…")
        else -> {
            val source = d.play_sources.getOrNull(sourceIdx)
            val hasSource = (source?.episodes?.size ?: 0) > 0
            Column(
                Modifier.fillMaxWidth()
                    .windowInsetsPadding(WindowInsets.statusBars)
                    .verticalScroll(rememberScrollState()),
            ) {
                // 详情页无播放器：封面 + 播放按钮，点了去独立播放页（续播/首集）
                Box(
                    Modifier.fillMaxWidth().aspectRatio(16f / 9f).clickable(enabled = hasSource) {
                        onOpenWatch(id, -1)
                    },
                ) {
                    AsyncImage(
                        model = d.backdrop ?: d.poster,
                        contentDescription = d.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                    if (hasSource) {
                        Box(
                            Modifier.fillMaxSize().background(Color(0x33000000)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Box(
                                Modifier.size(64.dp).clip(CircleShape).background(Color(0x8C000000)),
                                contentAlignment = Alignment.Center,
                            ) {
                                AppText("▶", style = AppTheme.typography.title)
                            }
                        }
                    }
                }

                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        AppButton("← 返回", onClick = onBack, variant = ButtonVariant.Outline)
                        AppButton(
                            text = if (isFav) "♥ 已收藏" else "♡ 收藏",
                            variant = if (isFav) ButtonVariant.Primary else ButtonVariant.Secondary,
                            onClick = {
                                if (Session.isLoggedIn) {
                                    val target = !isFav
                                    isFav = target
                                    scope.launch {
                                        try {
                                            if (target) api.addFavorite(id) else api.removeFavorite(id)
                                        } catch (_: Throwable) {
                                            isFav = !target
                                        }
                                    }
                                }
                            },
                        )
                        AppButton(
                            text = if (isSub) "🔔 已追更" else "🔕 追更",
                            variant = if (isSub) ButtonVariant.Primary else ButtonVariant.Secondary,
                            onClick = {
                                if (Session.isLoggedIn) {
                                    val target = !isSub
                                    isSub = target
                                    scope.launch {
                                        try {
                                            if (target) api.subscribe(id) else api.unsubscribe(id)
                                        } catch (_: Throwable) {
                                            isSub = !target
                                        }
                                    }
                                }
                            },
                        )
                        AppButton(
                            text = "👍 赞" + if (likeCount > 0) " $likeCount" else "",
                            variant = if (isLiked) ButtonVariant.Primary else ButtonVariant.Secondary,
                            onClick = {
                                if (Session.isLoggedIn) {
                                    val target = !isLiked
                                    isLiked = target
                                    likeCount += if (target) 1 else -1
                                    scope.launch {
                                        try {
                                            api.likeTitle(id, target)
                                        } catch (_: Throwable) {
                                            isLiked = !target
                                            likeCount += if (target) -1 else 1
                                        }
                                    }
                                }
                            },
                        )
                    }

                    AppText(d.name, style = AppTheme.typography.title)
                    val meta = listOfNotNull(
                        d.year.takeIf { it > 0 }?.toString(),
                        d.area?.takeIf { it.isNotBlank() },
                        d.vote_average.takeIf { it > 0 }?.let { "★$it" },
                    ).joinToString(" · ")
                    if (meta.isNotEmpty()) AppText(meta, color = AppTheme.colors.textSecondary)

                    // 简介
                    d.overview?.takeIf { it.isNotBlank() }?.let {
                        SectionTitle("简介")
                        AppText(it, color = AppTheme.colors.textSecondary)
                    }

                    // 演职员：头像横排（点 → 作品页）
                    val cast = buildList {
                        d.director?.takeIf { it.isNotBlank() }?.let { splitNames(it).forEach { n -> add(n to "导演") } }
                        d.actors?.takeIf { it.isNotBlank() }?.let { splitNames(it).forEach { n -> add(n to "主演") } }
                    }.distinctBy { it.first }.take(16)
                    if (cast.isNotEmpty()) {
                        SectionTitle("演职员")
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            contentPadding = PaddingValues(vertical = 4.dp),
                        ) {
                            items(cast, key = { it.first }) { (name, role) ->
                                Column(
                                    Modifier.width(60.dp).clickable { onOpenPerson(name) },
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                ) {
                                    Box(
                                        Modifier.size(52.dp).clip(CircleShape).background(colorOf(name)),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        AppText(name.take(1), color = Color.White, style = AppTheme.typography.title)
                                    }
                                    AppText(
                                        name,
                                        style = AppTheme.typography.caption,
                                        maxLines = 1,
                                        modifier = Modifier.padding(top = 4.dp),
                                    )
                                    AppText(
                                        role,
                                        style = AppTheme.typography.caption,
                                        color = AppTheme.colors.textSecondary,
                                    )
                                }
                            }
                        }
                    }

                    // 选季（多季系列）：点季卡切到该季详情
                    if (d.seasons.size > 1) {
                        SectionTitle("选季 · 共 ${d.seasons.size} 季")
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            contentPadding = PaddingValues(vertical = 4.dp),
                        ) {
                            items(d.seasons, key = { it.id }) { s ->
                                val active = s.id == id
                                Column(Modifier.width(84.dp).clickable(enabled = !active) { onOpen(s.id) }) {
                                    Box(
                                        Modifier.fillMaxWidth().aspectRatio(2f / 3f).clip(RoundedCornerShape(8.dp))
                                            .then(
                                                if (active) {
                                                    Modifier.border(2.dp, AppTheme.colors.primary, RoundedCornerShape(8.dp))
                                                } else {
                                                    Modifier
                                                },
                                            ),
                                    ) {
                                        AsyncImage(
                                            model = s.poster,
                                            contentDescription = s.name,
                                            contentScale = ContentScale.Crop,
                                            modifier = Modifier.fillMaxSize(),
                                        )
                                    }
                                    AppText(
                                        if (s.season > 0) "第${s.season}季" else "第1季",
                                        style = AppTheme.typography.caption,
                                        color = if (active) AppTheme.colors.primary else AppTheme.colors.text,
                                        maxLines = 1,
                                        modifier = Modifier.padding(top = 4.dp),
                                    )
                                }
                            }
                        }
                    }

                    // 线路切换（带健康/延迟）
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
                                        scope.launch { LinePref.set(ps.flag) }
                                    },
                                )
                            }
                        }
                    }

                    // 选集（两列列表，带集名 + 缓存标记，点一集 → 播放页；集数多时分段）
                    SectionTitle("选集 · 共 ${source?.episode_count ?: 0} 集")
                    val epList = source?.episodes ?: emptyList()
                    val epPageSize = 40
                    val epPages = (epList.size + epPageSize - 1) / epPageSize
                    val epPageCur = epPage.coerceAtMost(maxOf(0, epPages - 1))
                    if (epPages > 1) {
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            contentPadding = PaddingValues(vertical = 4.dp),
                        ) {
                            items(epPages) { p ->
                                val a = p * epPageSize + 1
                                val b = minOf((p + 1) * epPageSize, epList.size)
                                AppChip(text = "$a-$b", selected = p == epPageCur, onClick = { epPage = p })
                            }
                        }
                    }
                    epList.drop(epPageCur * epPageSize).take(epPageSize).chunked(2).forEachIndexed { rowIdx, pair ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            pair.forEachIndexed { colIdx, ep ->
                                val idx = epPageCur * epPageSize + rowIdx * 2 + colIdx
                                val mark = when (dlMap[ep.url]?.state) {
                                    1 -> "✓ "
                                    0 -> "⬇ "
                                    else -> ""
                                }
                                Row(
                                    Modifier.weight(1f).clip(RoundedCornerShape(8.dp))
                                        .background(AppTheme.colors.surfaceVariant)
                                        .clickable { onOpenWatch(id, idx) }
                                        .padding(horizontal = 12.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    AppText(
                                        "${idx + 1}",
                                        style = AppTheme.typography.caption,
                                        color = AppTheme.colors.textSecondary,
                                        modifier = Modifier.padding(end = 8.dp),
                                    )
                                    AppText(mark + ep.name.ifBlank { "第${ep.idx}集" }, maxLines = 1)
                                }
                            }
                            if (pair.size == 1) {
                                Box(Modifier.weight(1f))
                            }
                        }
                    }

                    // 离线缓存：首集 + 全集
                    val eps = source?.episodes ?: emptyList()
                    val dlEp = eps.firstOrNull()
                    if (dlEp != null) {
                        val info = dlMap[dlEp.url]
                        AppButton(
                            text = when {
                                info?.state == 1 -> "✓ 已缓存首集 · 点击删除"
                                info?.state == 2 -> "⚠ 失败 · 重试首集"
                                info != null -> "缓存中 ${info.percent}% · 点击取消"
                                else -> "⬇ 缓存首集"
                            },
                            variant = if (info?.state == 1) ButtonVariant.Primary else ButtonVariant.Secondary,
                            onClick = {
                                scope.launch {
                                    try {
                                        if (info != null && info.state != 2) {
                                            Downloads.remove(dlEp.url)
                                        } else {
                                            Downloads.start(dlEp.url, d.name, dlEp.name, d.poster)
                                        }
                                    } catch (_: Throwable) {
                                    }
                                }
                            },
                        )
                        if (eps.size > 1) {
                            val cached = eps.count { dlMap[it.url] != null }
                            val allCached = cached >= eps.size
                            AppButton(
                                text = if (allCached) "🗑 清空全集缓存（${eps.size}）" else "⬇ 缓存全集（${cached}/${eps.size}）",
                                variant = ButtonVariant.Secondary,
                                onClick = {
                                    scope.launch {
                                        try {
                                            if (allCached) {
                                                eps.forEach { Downloads.remove(it.url) }
                                            } else {
                                                eps.filter { dlMap[it.url] == null }
                                                    .forEach { Downloads.start(it.url, d.name, it.name, d.poster) }
                                            }
                                        } catch (_: Throwable) {
                                        }
                                    }
                                },
                            )
                        }
                    }

                    // 看了还看
                    if (related.isNotEmpty()) {
                        SectionTitle("看了还看")
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(vertical = 4.dp)) {
                            items(related, key = { it.id }) { t ->
                                PosterCard(title = t, onClick = { onOpen(t.id) }, modifier = Modifier.width(120.dp))
                            }
                        }
                    }

                    // 评论
                    SectionTitle("评论（${comments.size}）")
                    if (Session.isLoggedIn) {
                        AppTextField(
                            value = commentText,
                            onValueChange = { commentText = it },
                            placeholder = "写条评论…",
                            modifier = Modifier.fillMaxWidth(),
                        )
                        AppButton(
                            text = if (posting) "发送中…" else "发表",
                            onClick = {
                                val content = commentText.trim()
                                if (content.isNotEmpty() && !posting) {
                                    posting = true
                                    scope.launch {
                                        try {
                                            api.addComment(id, content)
                                            commentText = ""
                                            comments = api.comments(id)
                                        } catch (_: Throwable) {
                                        }
                                        posting = false
                                    }
                                }
                            },
                        )
                    } else {
                        AppText("登录后可评论", color = AppTheme.colors.textSecondary)
                    }
                    comments.forEach { c ->
                        CommentRow(c) {
                            if (Session.isLoggedIn) {
                                scope.launch {
                                    try {
                                        api.likeComment(c.id, !c.is_liked)
                                        comments = api.comments(id)
                                    } catch (_: Throwable) {
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
