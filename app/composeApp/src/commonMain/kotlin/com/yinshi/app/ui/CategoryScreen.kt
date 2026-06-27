package com.yinshi.app.ui

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed as gridItemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.yinshi.app.data.Api
import com.yinshi.app.data.Genre
import com.yinshi.app.data.Title
import com.yinshi.app.theme.AppChip
import com.yinshi.app.theme.AppText
import com.yinshi.app.theme.AppTheme
import com.yinshi.app.ui.components.GridSkeleton
import com.yinshi.app.ui.components.PosterCard

private val KINDS = listOf(0 to "全部", 1 to "电影", 2 to "剧集", 3 to "综艺", 4 to "动漫", 5 to "纪录片", 6 to "短剧")
private val SORTS = listOf("popular" to "🔥热门", "latest" to "🆕最新", "rating" to "⭐高分", "like" to "👍最赞")

@Composable
fun CategoryScreen(api: Api, onOpen: (Long) -> Unit) {
    var kind by remember { mutableStateOf(0) }
    var sort by remember { mutableStateOf("popular") }
    var tag by remember { mutableStateOf("") }
    var genre by remember { mutableStateOf(0) }
    var tagList by remember { mutableStateOf<List<String>>(emptyList()) }
    var genreList by remember { mutableStateOf<List<Genre>>(emptyList()) }
    var list by remember { mutableStateOf<List<Title>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }

    LaunchedEffect(kind) {
        tagList = try {
            api.tags(kind)
        } catch (_: Throwable) {
            emptyList()
        }
        genreList = try {
            api.genres(kind)
        } catch (_: Throwable) {
            emptyList()
        }
    }
    LaunchedEffect(kind, sort, tag, genre) {
        loading = true
        list = try {
            api.titles(
                kind = kind,
                sort = sort,
                tag = tag.ifBlank { null },
                genre = genre.takeIf { it > 0 },
                page = 1,
                size = 40,
            ).list
        } catch (_: Throwable) {
            emptyList()
        }
        loading = false
    }

    Column(Modifier.fillMaxSize()) {
        AppText(
            "分类 · 排行",
            style = AppTheme.typography.title,
            modifier = Modifier.padding(start = 16.dp, top = 12.dp, bottom = 8.dp),
        )

        // 题材
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(KINDS, key = { it.first }) { (k, label) ->
                AppChip(text = label, selected = kind == k, onClick = { kind = k; tag = ""; genre = 0 })
            }
        }
        // 题材（TMDB genres）
        if (genreList.isNotEmpty()) {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(top = 8.dp),
            ) {
                item(key = "g-all") { AppChip(text = "全部题材", selected = genre == 0, onClick = { genre = 0 }) }
                items(genreList, key = { it.id }) { g ->
                    AppChip(text = g.name, selected = genre == g.id.toInt(), onClick = { genre = g.id.toInt() })
                }
            }
        }
        // 标签（来自 vod_class）
        if (tagList.isNotEmpty()) {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(top = 8.dp),
            ) {
                item(key = "all") { AppChip(text = "全部", selected = tag == "", onClick = { tag = "" }) }
                items(tagList, key = { it }) { tg ->
                    AppChip(text = tg, selected = tag == tg, onClick = { tag = tg })
                }
            }
        }
        // 排序（= 排行榜维度）
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(top = 8.dp),
        ) {
            items(SORTS, key = { it.first }) { (s, label) ->
                AppChip(text = label, selected = sort == s, onClick = { sort = s })
            }
        }

        // 排行维度（非「最新」）且够 3 部时，TOP3 走领奖台，其余网格带名次
        val ranked = sort != "latest" && list.size >= 3
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
            when {
                loading && list.isEmpty() -> GridSkeleton()
                list.isEmpty() ->
                    AppText("暂无内容", color = AppTheme.colors.textSecondary, modifier = Modifier.padding(top = 40.dp))
                else -> {
                    val rest = if (ranked) list.drop(3) else list
                    LazyVerticalGrid(
                        columns = GridCells.Adaptive(110.dp),
                        contentPadding = PaddingValues(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        if (ranked) {
                            item(span = { GridItemSpan(maxLineSpan) }) { Podium(list.take(3), onOpen) }
                        }
                        gridItemsIndexed(rest, key = { _, t -> t.id }) { index, t ->
                            PosterCard(
                                title = t,
                                onClick = { onOpen(t.id) },
                                rank = if (ranked) index + 4 else null,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                    }
                }
            }
        }
    }
}

private val MEDALS = listOf("🥇", "🥈", "🥉")

// 领奖台：第 2 名居左、第 1 名居中（更宽 + 品牌色描边）、第 3 名居右，底对齐凑出台阶感
@Composable
private fun Podium(top: List<Title>, onOpen: (Long) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
        AppText("🏆 排行榜 · TOP 3", style = AppTheme.typography.sectionTitle, modifier = Modifier.padding(bottom = 12.dp))
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            listOf(1, 0, 2).forEach { i ->
                val t = top.getOrNull(i)
                if (t == null) {
                    Box(Modifier.weight(1f))
                } else {
                    PodiumItem(
                        rank = i + 1,
                        title = t,
                        big = i == 0,
                        onClick = { onOpen(t.id) },
                        modifier = Modifier.weight(if (i == 0) 1.25f else 1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun PodiumItem(rank: Int, title: Title, big: Boolean, onClick: () -> Unit, modifier: Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        AppText(MEDALS[rank - 1], style = AppTheme.typography.title)
        Box(
            Modifier.fillMaxWidth().aspectRatio(2f / 3f).clip(RoundedCornerShape(8.dp))
                .then(if (big) Modifier.border(2.dp, AppTheme.colors.primary, RoundedCornerShape(8.dp)) else Modifier)
                .clickable(onClick = onClick),
        ) {
            AsyncImage(
                model = title.poster,
                contentDescription = title.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }
        AppText(
            title.name,
            style = AppTheme.typography.label,
            maxLines = 1,
            modifier = Modifier.padding(top = 6.dp),
        )
    }
}
