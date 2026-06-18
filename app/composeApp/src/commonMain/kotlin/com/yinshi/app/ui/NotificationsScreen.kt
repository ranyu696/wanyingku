package com.yinshi.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import com.yinshi.app.data.Api
import com.yinshi.app.data.NotificationItem
import com.yinshi.app.theme.AppButton
import com.yinshi.app.theme.AppText
import com.yinshi.app.theme.AppTheme
import com.yinshi.app.theme.ButtonVariant
import kotlinx.coroutines.launch

@Composable
fun NotificationsScreen(api: Api, onBack: () -> Unit) {
    var list by remember { mutableStateOf<List<NotificationItem>>(emptyList()) }
    var readIds by remember { mutableStateOf<Set<Long>>(emptySet()) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        list = try {
            api.notifications()
        } catch (_: Throwable) {
            emptyList()
        }
    }

    Column(
        Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars).padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 12.dp)) {
            AppButton("← 返回", onClick = onBack, variant = ButtonVariant.Outline)
            Box(Modifier.weight(1f).padding(start = 12.dp)) {
                AppText("通知", style = AppTheme.typography.title)
            }
            AppButton(
                "全部已读",
                variant = ButtonVariant.Secondary,
                onClick = {
                    readIds = list.map { it.id }.toSet()
                    scope.launch {
                        try {
                            api.markAllNotificationsRead()
                        } catch (_: Throwable) {
                        }
                    }
                },
            )
        }

        if (list.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                AppText("还没有通知", color = AppTheme.colors.textSecondary, modifier = Modifier.padding(top = 40.dp))
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
                items(list, key = { it.id }) { n ->
                    val read = n.is_read || readIds.contains(n.id)
                    NotificationCard(n, read) {
                        if (!read) {
                            readIds = readIds + n.id
                            scope.launch {
                                try {
                                    api.markNotificationRead(n.id)
                                } catch (_: Throwable) {
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationCard(n: NotificationItem, read: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(AppTheme.colors.surface)
            .clickable(onClick = onClick)
            .padding(14.dp),
        verticalAlignment = Alignment.Top,
    ) {
        // 未读小红点
        Box(
            Modifier.padding(top = 5.dp, end = 10.dp).size(8.dp).clip(CircleShape)
                .background(if (read) AppTheme.colors.surface else AppTheme.colors.primary),
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            AppText(
                n.title.ifBlank { "通知" },
                color = if (read) AppTheme.colors.textSecondary else AppTheme.colors.text,
            )
            if (n.body.isNotBlank()) {
                AppText(n.body, style = AppTheme.typography.caption, color = AppTheme.colors.textSecondary)
            }
        }
    }
}
