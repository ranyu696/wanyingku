package com.wanyingku.tv.ui.search

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wanyingku.tv.Graph
import com.wanyingku.tv.data.Repository
import com.wanyingku.tv.data.Title
import com.wanyingku.tv.ui.appViewModel
import com.wanyingku.tv.ui.components.CenterMessage
import com.wanyingku.tv.ui.components.Chip
import com.wanyingku.tv.ui.components.Loading
import com.wanyingku.tv.ui.components.M3Dark
import com.wanyingku.tv.ui.components.PosterCard
import androidx.compose.material3.Text as M3Text
import kotlinx.coroutines.launch

class SearchViewModel(private val repo: Repository) : ViewModel() {
    var query by mutableStateOf(""); private set
    var results by mutableStateOf<List<Title>>(emptyList()); private set
    var hot by mutableStateOf<List<String>>(emptyList()); private set
    var loading by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    var searched by mutableStateOf(false); private set

    private var page = 1
    private var end = false

    init {
        viewModelScope.launch { runCatching { repo.hotSearches() }.onSuccess { hot = it } }
    }

    fun onQuery(q: String) { query = q }

    fun search(q: String = query) {
        val term = q.trim()
        if (term.isEmpty()) return
        query = term
        page = 1
        end = false
        results = emptyList()
        searched = true
        loadMore()
    }

    fun loadMore() {
        if (loading || end || query.isBlank()) return
        loading = true
        error = null
        viewModelScope.launch {
            runCatching { repo.search(query, page = page, size = 30) }
                .onSuccess { p ->
                    results = results + p.list
                    end = p.list.isEmpty() || results.size >= p.total
                    page++
                }
                .onFailure { error = it.message }
            loading = false
        }
    }
}

@Composable
fun SearchScreen(onTitle: (Long) -> Unit) {
    val vm = appViewModel { SearchViewModel(Graph.repository) }

    Column(Modifier.fillMaxSize().padding(start = 24.dp, top = 24.dp, end = 24.dp)) {
        M3Dark {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = vm.query,
                    onValueChange = vm::onQuery,
                    label = { M3Text("搜索影片 / 演员") },
                    singleLine = true,
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = androidx.compose.foundation.text.KeyboardActions(onSearch = { vm.search() }),
                    modifier = Modifier.width(520.dp),
                )
                Button(onClick = { vm.search() }) { M3Text("搜索") }
            }
        }

        if (!vm.searched) {
            if (vm.hot.isNotEmpty()) {
                androidx.tv.material3.Text(
                    "热门搜索",
                    style = androidx.tv.material3.MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(top = 24.dp, bottom = 8.dp),
                )
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(vertical = 6.dp)) {
                    items(vm.hot, key = { it }) { kw -> Chip(kw, selected = false, onClick = { vm.search(kw) }) }
                }
            } else {
                CenterMessage("输入关键词开始搜索")
            }
        } else when {
            vm.results.isEmpty() && vm.loading -> Loading()
            vm.results.isEmpty() && vm.error != null -> CenterMessage(vm.error!!)
            vm.results.isEmpty() -> CenterMessage("没有找到「${vm.query}」相关内容")
            else -> LazyVerticalGrid(
                columns = GridCells.Fixed(6),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                contentPadding = PaddingValues(top = 16.dp, bottom = 24.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                items(vm.results.size) { i ->
                    if (i >= vm.results.size - 6) LaunchedEffect(vm.results.size) { vm.loadMore() }
                    PosterCard(vm.results[i], onTitle)
                }
            }
        }
    }
}
