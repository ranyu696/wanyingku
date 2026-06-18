package com.yinshi.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
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

        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
            when {
                loading && list.isEmpty() -> GridSkeleton()
                list.isEmpty() ->
                    AppText("暂无内容", color = AppTheme.colors.textSecondary, modifier = Modifier.padding(top = 40.dp))
                else -> LazyVerticalGrid(
                    columns = GridCells.Adaptive(110.dp),
                    contentPadding = PaddingValues(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    gridItems(list, key = { it.id }) { t ->
                        PosterCard(title = t, onClick = { onOpen(t.id) }, modifier = Modifier.fillMaxWidth())
                    }
                }
            }
        }
    }
}
