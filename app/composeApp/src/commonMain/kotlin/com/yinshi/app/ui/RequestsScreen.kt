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
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.yinshi.app.data.Api
import com.yinshi.app.data.RequestItem
import com.yinshi.app.data.Session
import com.yinshi.app.theme.AppButton
import com.yinshi.app.theme.AppChip
import com.yinshi.app.theme.AppText
import com.yinshi.app.theme.AppTextField
import com.yinshi.app.theme.AppTheme
import com.yinshi.app.theme.ButtonVariant
import kotlinx.coroutines.launch

private val STATUS = listOf(-1 to "全部", 0 to "待处理", 1 to "处理中", 2 to "已满足")
private val STATUS_LABEL = mapOf(0 to "待处理", 1 to "处理中", 2 to "已满足", 3 to "已拒绝")

@Composable
fun RequestsScreen(api: Api, onBack: () -> Unit) {
    var status by remember { mutableStateOf(-1) }
    var list by remember { mutableStateOf<List<RequestItem>>(emptyList()) }
    var ov by remember { mutableStateOf<Map<Long, Pair<Boolean, Int>>>(emptyMap()) }
    var showDialog by remember { mutableStateOf(false) }
    var reloadKey by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(status, reloadKey) {
        list = try {
            api.requests(status)
        } catch (_: Throwable) {
            emptyList()
        }
        ov = emptyMap()
    }

    fun vote(r: RequestItem, curVoted: Boolean, curCount: Int) {
        if (!Session.isLoggedIn) return
        val on = !curVoted
        ov = ov + (r.id to (on to (curCount + if (on) 1 else -1)))
        scope.launch {
            try {
                val res = api.voteRequest(r.id, on)
                if (res != null) ov = ov + (r.id to (res.is_voted to res.vote_count))
            } catch (_: Throwable) {
                ov = ov + (r.id to (curVoted to curCount)) // 回滚
            }
        }
    }

    Column(
        Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars).padding(horizontal = 16.dp),
    ) {
        Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            AppButton("← 返回", onClick = onBack, variant = ButtonVariant.Outline)
            Box(Modifier.weight(1f).padding(start = 12.dp)) {
                AppText("求片广场", style = AppTheme.typography.title)
            }
            AppButton("我要求片", onClick = { showDialog = true })
        }
        if (!Session.isLoggedIn) {
            AppText("登录后可投票与求片", style = AppTheme.typography.caption, color = AppTheme.colors.textDisabled, modifier = Modifier.padding(bottom = 6.dp))
        }

        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 8.dp)) {
            items(STATUS, key = { it.first }) { (v, label) ->
                AppChip(text = label, selected = status == v, onClick = { status = v })
            }
        }

        if (list.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                AppText("还没有求片，来发起第一个吧", color = AppTheme.colors.textSecondary, modifier = Modifier.padding(top = 40.dp))
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
                items(list, key = { it.id }) { r ->
                    val o = ov[r.id]
                    val voted = o?.first ?: r.is_voted
                    val count = o?.second ?: r.vote_count
                    RequestRow(r, voted, count, onVote = { vote(r, voted, count) })
                }
            }
        }
    }

    if (showDialog) {
        CreateRequestDialog(
            onDismiss = { showDialog = false },
            onSubmit = { name, year ->
                scope.launch {
                    try {
                        api.createRequest(name, year)
                        showDialog = false
                        reloadKey += 1
                    } catch (_: Throwable) {
                    }
                }
            },
        )
    }
}

@Composable
private fun RequestRow(r: RequestItem, voted: Boolean, count: Int, onVote: () -> Unit) {
    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(AppTheme.shapes.md))
            .background(AppTheme.colors.surface)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            AppText(if (r.year > 0) "${r.name} (${r.year})" else r.name, style = AppTheme.typography.label, maxLines = 1)
            AppText(STATUS_LABEL[r.status] ?: "", style = AppTheme.typography.caption, color = AppTheme.colors.textSecondary)
        }
        AppButton(
            text = "顶 $count",
            variant = if (voted) ButtonVariant.Primary else ButtonVariant.Outline,
            onClick = onVote,
            modifier = Modifier.width(84.dp),
        )
    }
}

@Composable
private fun CreateRequestDialog(onDismiss: () -> Unit, onSubmit: (String, Int?) -> Unit) {
    var name by remember { mutableStateOf("") }
    var year by remember { mutableStateOf("") }
    Dialog(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth()
                .clip(RoundedCornerShape(AppTheme.shapes.lg))
                .background(AppTheme.colors.surface)
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            AppText("我要求片", style = AppTheme.typography.sectionTitle)
            AppTextField(name, { name = it }, "片名", Modifier.fillMaxWidth())
            AppTextField(year, { year = it }, "年份（可选）", Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AppButton("取消", onClick = onDismiss, variant = ButtonVariant.Secondary, modifier = Modifier.weight(1f))
                AppButton(
                    "提交",
                    onClick = { if (name.isNotBlank()) onSubmit(name.trim(), year.toIntOrNull()) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}
