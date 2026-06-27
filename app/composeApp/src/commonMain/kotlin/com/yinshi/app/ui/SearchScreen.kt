package com.yinshi.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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
import com.yinshi.app.data.Title
import com.yinshi.app.theme.AppChip
import com.yinshi.app.theme.AppText
import com.yinshi.app.theme.AppTextField
import com.yinshi.app.theme.AppTheme
import com.yinshi.app.ui.components.GridSkeleton
import com.yinshi.app.ui.components.PosterCard
import kotlinx.coroutines.delay

@Composable
fun SearchScreen(api: Api, onOpen: (Long) -> Unit) {
    var query by remember { mutableStateOf("") }
    var semantic by remember { mutableStateOf(false) }
    var results by remember { mutableStateOf<List<Title>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var hot by remember { mutableStateOf<List<String>>(emptyList()) }

    LaunchedEffect(Unit) {
        hot = try {
            api.hotSearches()
        } catch (_: Throwable) {
            emptyList()
        }
    }

    // 防抖搜索：停止输入 350ms 后再请求；切换语义开关也重搜
    LaunchedEffect(query, semantic) {
        val q = query.trim()
        if (q.isEmpty()) {
            results = emptyList()
            return@LaunchedEffect
        }
        delay(350)
        loading = true
        results = try {
            api.search(q, semantic = semantic).list
        } catch (e: Throwable) {
            emptyList()
        }
        loading = false
    }

    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        AppText("搜索", style = AppTheme.typography.title, modifier = Modifier.padding(vertical = 12.dp))
        AppTextField(
            value = query,
            onValueChange = { query = it },
            placeholder = "搜电影、剧集、综艺、动漫…",
            modifier = Modifier.fillMaxWidth(),
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
        ) {
            AppChip(
                text = "🧠 语义搜索",
                selected = semantic,
                onClick = { semantic = !semantic },
            )
        }
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
            when {
                query.isBlank() -> HotSearchList(hot, onPick = { query = it })
                loading && results.isEmpty() -> GridSkeleton()
                results.isEmpty() -> Hint("没找到，去『我的 → 求片』催一下")
                else -> LazyVerticalGrid(
                    columns = GridCells.Adaptive(110.dp),
                    contentPadding = PaddingValues(vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    items(results, key = { it.id }) { t ->
                        PosterCard(title = t, onClick = { onOpen(t.id) }, modifier = Modifier.fillMaxWidth())
                    }
                }
            }
        }
    }
}

@Composable
private fun Hint(text: String) {
    AppText(text, color = AppTheme.colors.textSecondary, modifier = Modifier.padding(top = 48.dp))
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun HotSearchList(hot: List<String>, onPick: (String) -> Unit) {
    if (hot.isEmpty()) {
        Hint("输入关键词开始搜索")
        return
    }
    Column(Modifier.fillMaxWidth().padding(top = 16.dp)) {
        AppText("🔥 热搜", style = AppTheme.typography.sectionTitle, modifier = Modifier.padding(bottom = 10.dp))
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            hot.forEachIndexed { i, k ->
                AppChip(text = "${i + 1}. $k", selected = i < 3, onClick = { onPick(k) })
            }
        }
    }
}
