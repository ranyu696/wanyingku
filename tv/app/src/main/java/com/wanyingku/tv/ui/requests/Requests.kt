package com.wanyingku.tv.ui.requests

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.tv.material3.Button
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.wanyingku.tv.Graph
import com.wanyingku.tv.data.KIND_LABELS
import com.wanyingku.tv.data.REQ_STATUS
import com.wanyingku.tv.data.Repository
import com.wanyingku.tv.data.RequestItem
import com.wanyingku.tv.ui.appViewModel
import com.wanyingku.tv.ui.components.CenterMessage
import com.wanyingku.tv.ui.components.Chip
import com.wanyingku.tv.ui.components.Loading
import com.wanyingku.tv.ui.components.M3Dark
import androidx.compose.material3.Button as M3Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface as M3Surface
import androidx.compose.material3.Text as M3Text
import androidx.compose.material3.TextButton
import kotlinx.coroutines.launch

class RequestsViewModel(private val repo: Repository) : ViewModel() {
    var items by mutableStateOf<List<RequestItem>>(emptyList()); private set
    var loading by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    val loggedIn get() = repo.isLoggedIn

    var showCreate by mutableStateOf(false); private set
    var submitting by mutableStateOf(false); private set
    var createError by mutableStateOf<String?>(null); private set

    private var page = 1
    private var end = false

    init { loadMore() }

    fun openCreate() { createError = null; showCreate = true }
    fun closeCreate() { showCreate = false }

    fun submit(name: String, year: Int, kind: Int, note: String) {
        if (name.isBlank()) { createError = "请输入片名"; return }
        submitting = true
        createError = null
        viewModelScope.launch {
            runCatching { repo.createRequest(name, year, kind, note) }
                .onSuccess { items = listOf(it) + items; showCreate = false }
                .onFailure { createError = it.message ?: "提交失败" }
            submitting = false
        }
    }

    fun loadMore() {
        if (loading || end) return
        loading = true
        error = null
        viewModelScope.launch {
            runCatching { repo.requests(page = page, size = 30) }
                .onSuccess { p ->
                    items = items + p.list
                    end = p.list.isEmpty() || items.size >= p.total
                    page++
                }
                .onFailure { error = it.message }
            loading = false
        }
    }

    fun toggleVote(r: RequestItem) {
        viewModelScope.launch {
            runCatching { if (r.isVoted) repo.unvote(r.id) else repo.vote(r.id) }
                .onSuccess { res ->
                    items = items.map { if (it.id == r.id) it.copy(voteCount = res.voteCount, isVoted = res.isVoted) else it }
                }
        }
    }
}

@Composable
fun RequestsScreen(onLogin: () -> Unit) {
    val vm = appViewModel { RequestsViewModel(Graph.repository) }

    if (vm.showCreate) CreateDialog(vm)

    Column(Modifier.fillMaxSize().padding(top = 24.dp)) {
        Row(
            Modifier.fillMaxWidth().padding(start = 48.dp, end = 48.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("求片广场", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.weight(1f))
            Button(onClick = { if (vm.loggedIn) vm.openCreate() else onLogin() }) { Text("＋ 我要求片") }
        }
        when {
            vm.items.isEmpty() && vm.loading -> Loading()
            vm.items.isEmpty() && vm.error != null -> CenterMessage(vm.error!!)
            vm.items.isEmpty() -> CenterMessage("还没有人求片")
            else -> LazyColumn(contentPadding = PaddingValues(horizontal = 48.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(vm.items.size, key = { vm.items[it].id }) { i ->
                    if (i >= vm.items.size - 5) LaunchedEffect(vm.items.size) { vm.loadMore() }
                    RequestRow(vm.items[i], onVote = { r -> if (vm.loggedIn) vm.toggleVote(r) else onLogin() })
                }
            }
        }
    }
}

private val KIND_OPTIONS = listOf(0 to "不限") + KIND_LABELS.toList()

@Composable
private fun CreateDialog(vm: RequestsViewModel) {
    var name by remember { mutableStateOf("") }
    var year by remember { mutableStateOf("") }
    var kind by remember { mutableStateOf(0) }
    var note by remember { mutableStateOf("") }

    Dialog(onDismissRequest = { vm.closeCreate() }) {
        M3Dark {
            M3Surface(shape = RoundedCornerShape(16.dp), color = Color(0xFF1C1C26)) {
                Column(Modifier.width(560.dp).padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    M3Text("我要求片", style = androidx.compose.material3.MaterialTheme.typography.titleLarge)
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { M3Text("片名（必填）") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(
                        value = year,
                        onValueChange = { s -> year = s.filter { it.isDigit() }.take(4) },
                        label = { M3Text("年份（选填）") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(KIND_OPTIONS, key = { it.first }) { (k, label) ->
                            Chip(label, selected = kind == k, onClick = { kind = k })
                        }
                    }
                    OutlinedTextField(value = note, onValueChange = { note = it }, label = { M3Text("备注（选填）") }, modifier = Modifier.fillMaxWidth())
                    vm.createError?.let { M3Text(it, color = androidx.compose.material3.MaterialTheme.colorScheme.error) }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.End)) {
                        TextButton(onClick = { vm.closeCreate() }) { M3Text("取消") }
                        M3Button(onClick = { vm.submit(name, year.toIntOrNull() ?: 0, kind, note) }, enabled = !vm.submitting) {
                            M3Text(if (vm.submitting) "提交中…" else "提交")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RequestRow(r: RequestItem, onVote: (RequestItem) -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            val k = KIND_LABELS[r.kind]?.let { "[$it] " } ?: ""
            Text("$k${r.name}${if (r.year > 0) " (${r.year})" else ""}", style = MaterialTheme.typography.titleSmall)
            if (r.note.isNotBlank()) Text(r.note, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Text(REQ_STATUS[r.status] ?: "", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
        Button(onClick = { onVote(r) }) { Text(if (r.isVoted) "已顶 ${r.voteCount}" else "顶 ${r.voteCount}") }
    }
}
