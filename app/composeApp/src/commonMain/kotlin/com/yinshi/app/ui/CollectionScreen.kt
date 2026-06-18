package com.yinshi.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
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
import com.yinshi.app.data.CollectionPage
import com.yinshi.app.theme.AppButton
import com.yinshi.app.theme.AppText
import com.yinshi.app.theme.AppTheme
import com.yinshi.app.theme.ButtonVariant
import com.yinshi.app.ui.components.PosterCard

@Composable
fun CollectionScreen(
    api: Api,
    collKey: String,
    headerTitle: String,
    onBack: () -> Unit,
    onOpen: (Long) -> Unit,
) {
    var page by remember { mutableStateOf<CollectionPage?>(null) }
    LaunchedEffect(collKey) {
        page = try {
            api.collectionTitles(collKey)
        } catch (_: Throwable) {
            null
        }
    }
    val list = page?.list ?: emptyList()

    Column(
        Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars).padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 8.dp)) {
            AppButton("← 返回", onClick = onBack, variant = ButtonVariant.Outline)
            Box(Modifier.weight(1f).padding(start = 12.dp)) {
                AppText(page?.title?.takeIf { it.isNotBlank() } ?: headerTitle, style = AppTheme.typography.title)
            }
        }
        page?.desc?.takeIf { it.isNotBlank() }?.let {
            AppText(
                it + (page?.total?.takeIf { n -> n > 0 }?.let { n -> "（$n）" } ?: ""),
                style = AppTheme.typography.caption,
                color = AppTheme.colors.textSecondary,
                modifier = Modifier.padding(bottom = 8.dp),
            )
        }
        if (list.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                AppText("暂无内容", color = AppTheme.colors.textSecondary, modifier = Modifier.padding(top = 40.dp))
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Adaptive(110.dp),
                contentPadding = PaddingValues(vertical = 8.dp),
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
