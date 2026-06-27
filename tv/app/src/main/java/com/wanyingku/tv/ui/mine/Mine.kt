package com.wanyingku.tv.ui.mine

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.tv.material3.Button
import androidx.tv.material3.Card
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.wanyingku.tv.Graph
import com.wanyingku.tv.data.Favorite
import com.wanyingku.tv.data.Notification
import com.wanyingku.tv.data.REQ_STATUS
import com.wanyingku.tv.data.Repository
import com.wanyingku.tv.data.RequestItem
import com.wanyingku.tv.data.Subscription
import com.wanyingku.tv.data.Title
import com.wanyingku.tv.data.WatchHistory
import com.wanyingku.tv.ui.appViewModel
import com.wanyingku.tv.ui.components.CenterMessage
import com.wanyingku.tv.ui.components.Chip
import com.wanyingku.tv.ui.components.Loading
import com.wanyingku.tv.ui.components.PosterCard
import kotlinx.coroutines.launch

enum class MineTab(val label: String) { FAV("收藏"), HISTORY("历史"), SUB("订阅"), NOTIF("通知"), REQ("我的求片") }

class MineViewModel(private val repo: Repository) : ViewModel() {
    val user get() = repo.user
    var tab by mutableStateOf(MineTab.FAV); private set
    var loading by mutableStateOf(false); private set
    var favorites by mutableStateOf<List<Favorite>>(emptyList()); private set
    var history by mutableStateOf<List<WatchHistory>>(emptyList()); private set
    var subs by mutableStateOf<List<Subscription>>(emptyList()); private set
    var notifs by mutableStateOf<List<Notification>>(emptyList()); private set
    var requests by mutableStateOf<List<RequestItem>>(emptyList()); private set

    init { loadCurrent() }

    fun select(t: MineTab) { if (t == tab) return; tab = t; loadCurrent() }

    fun loadCurrent() {
        viewModelScope.launch {
            loading = true
            runCatching {
                when (tab) {
                    MineTab.FAV -> favorites = repo.favorites().list
                    MineTab.HISTORY -> history = repo.history().list
                    MineTab.SUB -> subs = repo.subscriptions().list
                    MineTab.NOTIF -> notifs = repo.notifications().list
                    MineTab.REQ -> requests = repo.myRequests().list
                }
            }
            loading = false
        }
    }

    fun markRead(id: Long) {
        viewModelScope.launch { runCatching { repo.markRead(id) }; loadCurrent() }
    }

    fun logout() = repo.logout()
}

@Composable
fun MineScreen(onTitle: (Long) -> Unit, onLogin: () -> Unit) {
    val vm = appViewModel { MineViewModel(Graph.repository) }
    val user by vm.user.collectAsStateWithLifecycle()

    if (user == null) {
        Column(Modifier.fillMaxSize().padding(48.dp), verticalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterVertically), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("登录后可同步收藏、观看历史与订阅", style = MaterialTheme.typography.titleMedium)
            Button(onClick = onLogin) { Text("去登录 / 注册") }
        }
        return
    }

    Column(Modifier.fillMaxSize().padding(top = 24.dp)) {
        Row(Modifier.padding(horizontal = 48.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(user!!.nickname.ifBlank { user!!.username }, style = MaterialTheme.typography.headlineSmall)
            Button(onClick = { vm.logout() }) { Text("退出登录") }
        }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(horizontal = 48.dp, vertical = 12.dp)) {
            items(MineTab.entries.toList()) { t -> Chip(t.label, selected = vm.tab == t, onClick = { vm.select(t) }) }
        }

        if (vm.loading) Loading()
        else when (vm.tab) {
            MineTab.FAV -> TitleGrid(vm.favorites.mapNotNull { it.title }, onTitle, "暂无收藏")
            MineTab.SUB -> TitleGrid(vm.subs.mapNotNull { it.title }, onTitle, "暂无订阅")
            MineTab.HISTORY -> TitleGrid(vm.history.mapNotNull { it.title }, onTitle, "暂无观看历史")
            MineTab.NOTIF -> NotifList(vm.notifs, onRead = vm::markRead)
            MineTab.REQ -> RequestList(vm.requests)
        }
    }
}

@Composable
private fun TitleGrid(items: List<Title>, onTitle: (Long) -> Unit, empty: String) {
    if (items.isEmpty()) { CenterMessage(empty); return }
    LazyVerticalGrid(
        columns = GridCells.Fixed(6),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(horizontal = 48.dp, vertical = 8.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        items(items.size) { i -> PosterCard(items[i], onTitle) }
    }
}

@Composable
private fun NotifList(items: List<Notification>, onRead: (Long) -> Unit) {
    if (items.isEmpty()) { CenterMessage("暂无通知"); return }
    LazyColumn(contentPadding = PaddingValues(horizontal = 48.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items(items, key = { it.id }) { n ->
            Card(onClick = { if (!n.isRead) onRead(n.id) }, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (!n.isRead) com.wanyingku.tv.ui.components.Badge("未读")
                        Text(n.title, style = MaterialTheme.typography.titleSmall)
                    }
                    if (n.body.isNotBlank()) Text(n.body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
    }
}

@Composable
private fun RequestList(items: List<RequestItem>) {
    if (items.isEmpty()) { CenterMessage("还没有求片记录"); return }
    LazyColumn(contentPadding = PaddingValues(horizontal = 48.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items(items, key = { it.id }) { r ->
            Row(Modifier.fillMaxWidth().background(Color(0xFF1C1C26), MaterialTheme.shapes.medium).padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("${r.name}${if (r.year > 0) " (${r.year})" else ""}", style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                Text("👍 ${r.voteCount}", style = MaterialTheme.typography.labelLarge)
                Text(REQ_STATUS[r.status] ?: "", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}
