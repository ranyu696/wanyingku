package com.wanyingku.tv.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.tv.material3.Card
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import coil3.compose.AsyncImage
import com.wanyingku.tv.Graph
import com.wanyingku.tv.data.HomeData
import com.wanyingku.tv.data.HomeSection
import com.wanyingku.tv.data.Repository
import com.wanyingku.tv.data.Title
import com.wanyingku.tv.data.WatchHistory
import com.wanyingku.tv.data.poster
import com.wanyingku.tv.ui.Loadable
import com.wanyingku.tv.ui.appViewModel
import com.wanyingku.tv.ui.components.CenterMessage
import com.wanyingku.tv.ui.components.Loading
import com.wanyingku.tv.ui.components.PosterCard
import com.wanyingku.tv.ui.components.TitleRow
import kotlinx.coroutines.launch

class HomeViewModel(private val repo: Repository) : ViewModel() {
    var state by mutableStateOf(Loadable<HomeData>())
        private set
    var continueWatching by mutableStateOf<List<WatchHistory>>(emptyList())
        private set
    var recommend by mutableStateOf<List<Title>>(emptyList())
        private set

    init { load() }

    fun load() {
        viewModelScope.launch {
            state = Loadable()
            runCatching { repo.home() }
                .onSuccess { state = Loadable.ok(it) }
                .onFailure { state = Loadable.fail(it.message) }
            if (repo.isLoggedIn) {
                runCatching { repo.history().list }.onSuccess { continueWatching = it }
                runCatching { repo.recommend() }.onSuccess { recommend = it }
            }
        }
    }
}

@Composable
fun HomeScreen(onTitle: (Long) -> Unit) {
    val vm = appViewModel { HomeViewModel(Graph.repository) }
    val s = vm.state
    when {
        s.loading -> Loading()
        s.error != null -> CenterMessage(s.error!!)
        else -> {
            val home = s.data!!
            LazyColumn(contentPadding = PaddingValues(top = 24.dp, bottom = 48.dp)) {
                home.banners?.takeIf { it.isNotEmpty() }?.let { banners ->
                    item { BannerRow(banners, onTitle) }
                }
                if (vm.continueWatching.isNotEmpty()) {
                    item { ContinueRow(vm.continueWatching, onTitle) }
                }
                if (vm.recommend.isNotEmpty()) {
                    item { TitleRow("为你推荐", vm.recommend, onTitle) }
                }
                items(home.sections.orEmpty(), key = { it.title }) { sec -> PagedTitleRow(sec, onTitle) }
            }
        }
    }
}

// 首页榜单行：横滑到尾按 section 的 kind+sort 翻页续取（对齐 Web 无限横滑）。
@Composable
private fun PagedTitleRow(section: HomeSection, onTitle: (Long) -> Unit) {
    val repo = Graph.repository
    val scope = rememberCoroutineScope()
    var items by remember { mutableStateOf(section.list) }
    var page by remember { mutableIntStateOf(2) } // 首屏 12 条算第 1 页
    var loading by remember { mutableStateOf(false) }
    var end by remember { mutableStateOf(section.list.isEmpty()) }
    val listState = rememberLazyListState()

    val nearEnd by remember {
        derivedStateOf {
            val last = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            last >= items.size - 5
        }
    }
    LaunchedEffect(nearEnd, items.size) {
        if (nearEnd && !loading && !end) {
            loading = true
            runCatching {
                repo.titles(kind = section.kind.takeIf { it > 0 }, sort = section.sort, page = page, size = 24)
            }.onSuccess { p ->
                items = (items + p.list).distinctBy { it.id } // 去重防 LazyRow key 冲突
                end = p.list.isEmpty() || items.size >= p.total
                page += 1
            }.onFailure { end = true } // 出错即停，避免反复打 API
            loading = false
        }
    }

    if (items.isEmpty()) return
    Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        Text(section.title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(start = 48.dp, bottom = 8.dp))
        LazyRow(
            state = listState,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            contentPadding = PaddingValues(horizontal = 48.dp, vertical = 8.dp),
        ) {
            items(items, key = { it.id }) { PosterCard(it, onTitle) }
        }
    }
}

@Composable
private fun BannerRow(banners: List<Title>, onTitle: (Long) -> Unit) {
    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(horizontal = 48.dp, vertical = 8.dp),
    ) {
        items(banners, key = { it.id }) { t -> BannerCard(t, onTitle) }
    }
}

@Composable
private fun BannerCard(title: Title, onTitle: (Long) -> Unit) {
    Card(onClick = { onTitle(title.id) }, modifier = Modifier.width(520.dp)) {
        Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(Color(0xFF1C1C26))) {
            AsyncImage(
                model = (title.backdrop ?: title.poster).poster(640),
                contentDescription = title.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
            Box(
                Modifier.fillMaxSize().background(
                    Brush.verticalGradient(listOf(Color.Transparent, Color(0xCC000000))),
                ),
            )
            Column(Modifier.align(Alignment.BottomStart).padding(20.dp)) {
                Text(title.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                val meta = listOfNotNull(
                    title.year.takeIf { it > 0 }?.toString(),
                    title.area?.takeIf { it.isNotBlank() },
                    title.voteAverage.takeIf { it > 0 }?.let { "★ %.1f".format(it) },
                ).joinToString(" · ")
                if (meta.isNotBlank()) {
                    Text(meta, style = MaterialTheme.typography.bodyMedium, color = Color(0xFFDDDDE5))
                }
            }
        }
    }
}

@Composable
private fun ContinueRow(items: List<WatchHistory>, onTitle: (Long) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        Text("继续观看", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(start = 48.dp, bottom = 8.dp))
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            contentPadding = PaddingValues(horizontal = 48.dp, vertical = 8.dp),
        ) {
            items(items.filter { it.title != null }, key = { it.id }) { h ->
                Column(Modifier.width(132.dp)) {
                    PosterCard(h.title!!, onTitle)
                    val pct = if (h.duration > 0) (h.position * 100 / h.duration).coerceIn(0, 100) else 0
                    Text(
                        if (h.episodeIdx > 0) "看到第${h.episodeIdx + 1}集 ${pct}%" else "已看 ${pct}%",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(horizontal = 6.dp),
                    )
                }
            }
        }
    }
}
