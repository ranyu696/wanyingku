package com.wanyingku.tv.ui.browse

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.wanyingku.tv.Graph
import com.wanyingku.tv.data.Genre
import com.wanyingku.tv.data.KIND_LABELS
import com.wanyingku.tv.data.Repository
import com.wanyingku.tv.data.Title
import com.wanyingku.tv.ui.appViewModel
import com.wanyingku.tv.ui.components.CenterMessage
import com.wanyingku.tv.ui.components.Chip
import com.wanyingku.tv.ui.components.PosterCard
import kotlinx.coroutines.launch

private val KINDS = listOf(0 to "全部") + KIND_LABELS.toList()
private val SORTS = listOf("popular" to "热门", "newest" to "最新", "rating" to "高分", "latest" to "近更")

class BrowseViewModel(private val repo: Repository) : ViewModel() {
    var kind by mutableStateOf(0); private set
    var genre by mutableStateOf(0L); private set
    var sort by mutableStateOf("popular"); private set
    var genres by mutableStateOf<List<Genre>>(emptyList()); private set
    var items by mutableStateOf<List<Title>>(emptyList()); private set
    var loading by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set

    private var page = 1
    private var end = false

    init { loadGenres(); reload() }

    fun selectKind(k: Int) { if (k == kind) return; kind = k; genre = 0; loadGenres(); reload() }
    fun selectGenre(g: Long) { if (g == genre) return; genre = g; reload() }
    fun selectSort(s: String) { if (s == sort) return; sort = s; reload() }

    private fun loadGenres() {
        viewModelScope.launch {
            runCatching { repo.genres(kind.takeIf { it > 0 }) }.onSuccess { genres = it }
        }
    }

    private fun reload() { page = 1; end = false; items = emptyList(); loadMore() }

    fun loadMore() {
        if (loading || end) return
        loading = true
        error = null
        viewModelScope.launch {
            runCatching {
                repo.titles(
                    kind = kind.takeIf { it > 0 },
                    genre = genre.takeIf { it > 0 },
                    sort = sort,
                    page = page,
                    size = 30,
                )
            }.onSuccess { p ->
                items = items + p.list
                end = p.list.isEmpty() || items.size >= p.total
                page++
            }.onFailure { error = it.message }
            loading = false
        }
    }
}

@Composable
fun BrowseScreen(onTitle: (Long) -> Unit) {
    val vm = appViewModel { BrowseViewModel(Graph.repository) }

    Column(Modifier.fillMaxSize().padding(top = 16.dp)) {
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(horizontal = 24.dp, vertical = 6.dp),
        ) {
            items(KINDS, key = { it.first }) { (k, label) ->
                Chip(label, selected = vm.kind == k, onClick = { vm.selectKind(k) })
            }
        }
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(horizontal = 24.dp, vertical = 6.dp),
        ) {
            items(SORTS, key = { it.first }) { (s, label) ->
                Chip(label, selected = vm.sort == s, onClick = { vm.selectSort(s) })
            }
        }
        if (vm.genres.isNotEmpty()) {
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(horizontal = 24.dp, vertical = 6.dp),
            ) {
                item { Chip("全部题材", selected = vm.genre == 0L, onClick = { vm.selectGenre(0L) }) }
                items(vm.genres, key = { it.id }) { g ->
                    Chip(g.name, selected = vm.genre == g.id, onClick = { vm.selectGenre(g.id) })
                }
            }
        }

        when {
            vm.items.isEmpty() && vm.loading -> com.wanyingku.tv.ui.components.Loading()
            vm.items.isEmpty() && vm.error != null -> CenterMessage(vm.error!!)
            vm.items.isEmpty() -> CenterMessage("暂无内容")
            else -> LazyVerticalGrid(
                columns = GridCells.Fixed(6),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                contentPadding = PaddingValues(24.dp),
                modifier = Modifier.fillMaxSize(),
            ) {
                items(vm.items.size) { i ->
                    if (i >= vm.items.size - 6) LaunchedEffect(vm.items.size) { vm.loadMore() }
                    PosterCard(vm.items[i], onTitle)
                }
            }
        }
    }
}
