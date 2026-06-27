package com.wanyingku.tv.ui.detail

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.tv.material3.Button
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import coil3.compose.AsyncImage
import com.wanyingku.tv.Graph
import com.wanyingku.tv.data.Comment
import com.wanyingku.tv.data.DetailResp
import com.wanyingku.tv.data.Repository
import com.wanyingku.tv.data.Title
import com.wanyingku.tv.data.poster
import com.wanyingku.tv.ui.Loadable
import com.wanyingku.tv.ui.appViewModel
import com.wanyingku.tv.ui.components.CenterMessage
import com.wanyingku.tv.ui.components.Chip
import com.wanyingku.tv.ui.components.Loading
import com.wanyingku.tv.ui.components.PosterCard
import kotlinx.coroutines.launch

class DetailViewModel(private val repo: Repository, val id: Long) : ViewModel() {
    var state by mutableStateOf(Loadable<DetailResp>()); private set
    var related by mutableStateOf<List<Title>>(emptyList()); private set
    var comments by mutableStateOf<List<Comment>>(emptyList()); private set
    var lineIdx by mutableStateOf(0); private set
    var isFav by mutableStateOf(false); private set
    var isSub by mutableStateOf(false); private set
    var isLiked by mutableStateOf(false); private set

    val loggedIn: Boolean get() = repo.isLoggedIn

    init { load() }

    fun load() {
        viewModelScope.launch {
            state = Loadable()
            runCatching { repo.detail(id) }
                .onSuccess { d ->
                    state = Loadable.ok(d)
                    isFav = d.isFavorite; isSub = d.isSubscribed; isLiked = d.isLiked
                    // 记住的线路偏好：默认选中同名线路
                    repo.preferredLineFlag()?.let { flag ->
                        val pi = d.detail.playSources.indexOfFirst { it.flag == flag }
                        if (pi >= 0) lineIdx = pi
                    }
                    // 续播线路覆盖偏好
                    d.progress?.playSourceId?.let { psid ->
                        val li = d.detail.playSources.indexOfFirst { it.id == psid }
                        if (li >= 0) lineIdx = li
                    }
                }
                .onFailure { state = Loadable.fail(it.message) }
            runCatching { repo.related(id) }.onSuccess { related = it }
            runCatching { repo.comments(id).list }.onSuccess { comments = it }
        }
    }

    fun setLine(i: Int) {
        lineIdx = i
        state.data?.detail?.playSources?.getOrNull(i)?.flag?.let { repo.rememberLine(it) }
    }

    // 续播位置：返回 (lineIdx, epIdx)。无进度则 (当前线路, 0)。
    fun resumeTarget(): Pair<Int, Int> {
        val d = state.data ?: return lineIdx to 0
        val p = d.progress ?: return lineIdx to 0
        val li = d.detail.playSources.indexOfFirst { it.id == p.playSourceId }.takeIf { it >= 0 } ?: lineIdx
        val ei = d.detail.playSources.getOrNull(li)?.episodes?.indexOfFirst { it.idx == p.episodeIdx }?.takeIf { it >= 0 } ?: 0
        return li to ei
    }

    fun toggleFav() = act { if (isFav) repo.removeFavorite(id) else repo.addFavorite(id); isFav = !isFav }
    fun toggleSub() = act { if (isSub) repo.unsubscribe(id) else repo.subscribe(id); isSub = !isSub }
    fun toggleLike() = act { repo.likeTitle(id, !isLiked); isLiked = !isLiked }

    private fun act(block: suspend () -> Unit) {
        viewModelScope.launch { runCatching { block() } }
    }
}

@Composable
fun DetailScreen(id: Long, onPlay: (Long, Int, Int) -> Unit, onTitle: (Long) -> Unit, onBack: () -> Unit, onLogin: () -> Unit) {
    val vm = appViewModel { DetailViewModel(Graph.repository, id) }
    BackHandler(onBack = onBack)
    val s = vm.state
    when {
        s.loading -> Loading()
        s.error != null -> CenterMessage(s.error!!)
        else -> {
            val resp = s.data!!
            val d = resp.detail
            val line = d.playSources.getOrNull(vm.lineIdx)
            val eps = line?.episodes ?: emptyList()
            val resumeEp = resp.progress?.let { p -> if (p.episodeIdx > 0) p.episodeIdx + 1 else 0 } ?: 0
            val authGuard: (() -> Unit) -> Unit = { action -> if (vm.loggedIn) action() else onLogin() }

            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 48.dp)) {
                item {
                    Box(Modifier.fillMaxWidth().height(360.dp)) {
                        AsyncImage(
                            model = (d.backdrop ?: d.poster).poster(640),
                            contentDescription = d.name,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize().background(Color(0xFF1C1C26)),
                        )
                        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0x66000000), Color(0xF20E0E14)))))
                        Column(Modifier.align(Alignment.BottomStart).padding(48.dp)) {
                            Text(d.name, style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold, color = Color.White)
                            val meta = listOfNotNull(
                                d.year.takeIf { it > 0 }?.toString(),
                                d.area?.takeIf { it.isNotBlank() },
                                d.genres.take(3).joinToString("/") { it.name }.takeIf { it.isNotBlank() },
                                d.voteAverage.takeIf { it > 0 }?.let { "★ %.1f".format(it) },
                                d.latestEpisode.takeIf { it > 0 }?.let { if (d.serialComplete) "完结 $it 集" else "更新至 $it 集" },
                            ).joinToString("  ·  ")
                            if (meta.isNotBlank()) Text(meta, style = MaterialTheme.typography.titleSmall, color = Color(0xFFDDDDE5), modifier = Modifier.padding(top = 6.dp))
                            d.overview?.takeIf { it.isNotBlank() }?.let {
                                Text(it, style = MaterialTheme.typography.bodyMedium, color = Color(0xFFC9C9D2), maxLines = 3, modifier = Modifier.padding(top = 10.dp).fillMaxWidth(0.7f))
                            }
                        }
                    }
                }

                item {
                    Row(Modifier.padding(start = 48.dp, top = 16.dp, end = 48.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Button(onClick = { val (li, ei) = vm.resumeTarget(); onPlay(id, li, ei) }) {
                            Text(if (resumeEp > 0) "▶ 续播 第${resumeEp}集" else "▶ 播放")
                        }
                        Button(onClick = { authGuard { vm.toggleFav() } }) { Text(if (vm.isFav) "♥ 已收藏" else "♡ 收藏") }
                        Button(onClick = { authGuard { vm.toggleSub() } }) { Text(if (vm.isSub) "🔔 已订阅" else "🔕 订阅") }
                        Button(onClick = { authGuard { vm.toggleLike() } }) { Text(if (vm.isLiked) "👍 已赞" else "👍 点赞") }
                    }
                }

                if (d.playSources.size > 1) {
                    item {
                        Column(Modifier.padding(top = 20.dp)) {
                            Text("线路（${d.playSources.size}）", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(start = 48.dp, bottom = 8.dp))
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(horizontal = 48.dp)) {
                                items(d.playSources.size) { i ->
                                    val ps = d.playSources[i]
                                    val label = ps.displayName + (if (ps.lang.isNotBlank()) "·${ps.lang}" else "") + (if (ps.dead) "·失效" else "")
                                    Chip(label, selected = i == vm.lineIdx, onClick = { vm.setLine(i) })
                                }
                            }
                        }
                    }
                }

                if (eps.isNotEmpty()) {
                    item {
                        Text("选集（${eps.size}）", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(start = 48.dp, top = 20.dp, bottom = 8.dp))
                    }
                    item {
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(horizontal = 48.dp, vertical = 4.dp)) {
                            items(eps.size) { i ->
                                Chip(eps[i].name.ifBlank { "第${i + 1}集" }, selected = false, onClick = { onPlay(id, vm.lineIdx, i) })
                            }
                        }
                    }
                }

                if (vm.related.isNotEmpty()) {
                    item {
                        Column(Modifier.padding(top = 20.dp)) {
                            Text("相关推荐", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(start = 48.dp, bottom = 8.dp))
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp), contentPadding = PaddingValues(horizontal = 48.dp, vertical = 8.dp)) {
                                items(vm.related, key = { it.id }) { PosterCard(it, onTitle) }
                            }
                        }
                    }
                }

                if (vm.comments.isNotEmpty()) {
                    item { Text("热门评论", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(start = 48.dp, top = 20.dp, bottom = 8.dp)) }
                    items(vm.comments, key = { it.id }) { c ->
                        Column(Modifier.padding(horizontal = 48.dp, vertical = 6.dp)) {
                            Text(c.user?.nickname?.ifBlank { "用户" } ?: "用户", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                            Text(c.content, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
                        }
                    }
                }
            }
        }
    }
}
