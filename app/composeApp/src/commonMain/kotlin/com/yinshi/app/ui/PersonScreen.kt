package com.yinshi.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.yinshi.app.data.Api
import com.yinshi.app.data.Title
import com.yinshi.app.theme.AppButton
import com.yinshi.app.theme.AppChip
import com.yinshi.app.theme.AppText
import com.yinshi.app.theme.AppTheme
import com.yinshi.app.theme.ButtonVariant
import com.yinshi.app.ui.components.PosterCard

private fun isDirector(t: Title, name: String) = t.director?.contains(name) == true
private fun isActor(t: Title, name: String) = t.actors?.contains(name) == true

@Composable
fun PersonScreen(api: Api, name: String, onBack: () -> Unit, onOpen: (Long) -> Unit) {
    var all by remember { mutableStateOf<List<Title>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var role by remember { mutableStateOf(0) } // 0全部 1导演 2主演
    var sortByYear by remember { mutableStateOf(false) }

    LaunchedEffect(name) {
        loading = true
        all = try {
            api.people(name)
        } catch (_: Throwable) {
            emptyList()
        }
        loading = false
    }

    val dirCount = all.count { isDirector(it, name) }
    val actCount = all.count { isActor(it, name) }
    val list = all
        .filter {
            when (role) {
                1 -> isDirector(it, name)
                2 -> isActor(it, name)
                else -> true
            }
        }
        .let { if (sortByYear) it.sortedByDescending { t -> t.year } else it }

    Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars).padding(horizontal = 16.dp)) {
        Row(
            Modifier.fillMaxWidth().padding(vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AppButton("← 返回", onClick = onBack, variant = ButtonVariant.Outline)
        }

        // 头部：首字头像 + 名字 + 作品数
        Row(
            Modifier.fillMaxWidth().padding(bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier.size(52.dp).clip(CircleShape).background(AppTheme.colors.primary),
                contentAlignment = Alignment.Center,
            ) {
                AppText(name.take(1), style = AppTheme.typography.title)
            }
            Column(Modifier.padding(start = 12.dp)) {
                AppText(name, style = AppTheme.typography.title)
                AppText(
                    "共 ${all.size} 部作品",
                    style = AppTheme.typography.caption,
                    color = AppTheme.colors.textSecondary,
                )
            }
        }

        // 角色筛选 + 年份排序
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 8.dp)) {
            item(key = "all") { AppChip(text = "全部 ${all.size}", selected = role == 0, onClick = { role = 0 }) }
            if (dirCount > 0) {
                item(key = "dir") { AppChip(text = "导演 $dirCount", selected = role == 1, onClick = { role = 1 }) }
            }
            if (actCount > 0) {
                item(key = "act") { AppChip(text = "主演 $actCount", selected = role == 2, onClick = { role = 2 }) }
            }
            item(key = "sort") {
                AppChip(
                    text = if (sortByYear) "📅 年份" else "🔥 热度",
                    selected = sortByYear,
                    onClick = { sortByYear = !sortByYear },
                )
            }
        }

        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
            when {
                loading && all.isEmpty() ->
                    AppText("加载中…", color = AppTheme.colors.textSecondary, modifier = Modifier.padding(top = 40.dp))
                list.isEmpty() ->
                    AppText("没有找到 ta 的作品", color = AppTheme.colors.textSecondary, modifier = Modifier.padding(top = 40.dp))
                else -> LazyVerticalGrid(
                    columns = GridCells.Adaptive(110.dp),
                    contentPadding = PaddingValues(bottom = 24.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    items(list, key = { it.id }) { t ->
                        PosterCard(title = t, onClick = { onOpen(t.id) }, modifier = Modifier.fillMaxWidth())
                    }
                }
            }
        }
    }
}
