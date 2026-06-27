package com.yinshi.app.ui

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.yinshi.app.data.Api
import com.yinshi.app.data.CollectionPreview
import com.yinshi.app.data.HomeData
import com.yinshi.app.data.Session
import com.yinshi.app.data.Title
import com.yinshi.app.theme.AppButton
import com.yinshi.app.theme.AppText
import com.yinshi.app.theme.AppTheme
import com.yinshi.app.theme.ButtonVariant
import com.yinshi.app.ui.components.BrandLogo
import com.yinshi.app.ui.components.HomeSkeleton
import com.yinshi.app.ui.components.PosterCard
import kotlinx.coroutines.launch

@Composable
fun HomeScreen(api: Api, onOpen: (Long) -> Unit, onOpenCollection: (String, String) -> Unit) {
    var data by remember { mutableStateOf<HomeData?>(null) }
    var recommend by remember { mutableStateOf<List<Title>>(emptyList()) }
    var collections by remember { mutableStateOf<List<CollectionPreview>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        try {
            data = api.home()
        } catch (e: Throwable) {
            error = e.message ?: "加载失败"
        }
        collections = try {
            api.collections()
        } catch (_: Throwable) {
            emptyList()
        }
    }

    // 为你推荐：登录后按题材偏好召回；登出清空
    LaunchedEffect(Session.token) {
        recommend = if (Session.isLoggedIn) {
            try {
                api.recommend()
            } catch (_: Throwable) {
                emptyList()
            }
        } else {
            emptyList()
        }
    }

    val home = data
    Column(Modifier.fillMaxSize()) {
        BrandBar()
        Box(Modifier.fillMaxWidth().weight(1f)) {
            when {
                error != null -> CenterText("连接后端失败：$error\n确认 Go 服务在跑，且模拟器用 10.0.2.2")
                home == null -> HomeSkeleton()
                else -> {
            val banner = home.banners?.firstOrNull()
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                if (banner != null) {
                    item {
                        Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f)) {
                            AsyncImage(
                                model = banner.backdrop ?: banner.poster,
                                contentDescription = banner.name,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize(),
                            )
                            AppText(
                                banner.name,
                                style = AppTheme.typography.title,
                                modifier = Modifier.align(Alignment.BottomStart).padding(16.dp),
                            )
                        }
                    }
                }
                item {
                    Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                        AppButton(
                            text = "🎲 今天看点啥",
                            variant = ButtonVariant.Outline,
                            onClick = {
                                scope.launch {
                                    val t = try {
                                        api.randomTitle()
                                    } catch (_: Throwable) {
                                        null
                                    }
                                    if (t != null) onOpen(t.id)
                                }
                            },
                        )
                    }
                }
                if (recommend.isNotEmpty()) {
                    item {
                        Column {
                            AppText(
                                "✨ 为你推荐",
                                style = AppTheme.typography.sectionTitle,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                            )
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 16.dp),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                items(recommend, key = { it.id }) { t ->
                                    PosterCard(
                                        title = t,
                                        onClick = { onOpen(t.id) },
                                        modifier = Modifier.width(120.dp),
                                    )
                                }
                            }
                        }
                    }
                }
                collections.forEach { col ->
                    if (col.list.isNotEmpty()) {
                        item {
                            Column {
                                Row(
                                    Modifier.fillMaxWidth()
                                        .clickable { onOpenCollection(col.key, col.title) }
                                        .padding(horizontal = 16.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    AppText(col.title, style = AppTheme.typography.sectionTitle, modifier = Modifier.weight(1f))
                                    AppText("全部 ›", style = AppTheme.typography.caption, color = AppTheme.colors.textSecondary)
                                }
                                LazyRow(
                                    contentPadding = PaddingValues(horizontal = 16.dp),
                                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                                ) {
                                    items(col.list, key = { it.id }) { t ->
                                        PosterCard(
                                            title = t,
                                            onClick = { onOpen(t.id) },
                                            modifier = Modifier.width(120.dp),
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
                home.sections.orEmpty().forEach { section ->
                    item {
                        Column {
                            AppText(
                                section.title,
                                style = AppTheme.typography.sectionTitle,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                            )
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 16.dp),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                items(section.list, key = { it.id }) { t ->
                                    PosterCard(
                                        title = t,
                                        onClick = { onOpen(t.id) },
                                        modifier = Modifier.width(120.dp),
                                    )
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
}

// 顶部品牌栏：左对齐 logo（万影库）
@Composable
private fun BrandBar() {
    Row(
        Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BrandLogo(height = 26.dp)
    }
}

@Composable
fun CenterText(text: String) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        AppText(text, color = AppTheme.colors.textSecondary, modifier = Modifier.padding(24.dp))
    }
}
