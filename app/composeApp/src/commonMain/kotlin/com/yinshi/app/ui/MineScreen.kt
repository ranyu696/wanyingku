package com.yinshi.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.unit.dp
import com.yinshi.app.data.Api
import com.yinshi.app.data.Session
import com.yinshi.app.data.SessionManager
import com.yinshi.app.data.Title
import com.yinshi.app.data.isPushEnabled
import com.yinshi.app.data.setPushEnabled
import kotlinx.coroutines.launch
import com.yinshi.app.theme.AppButton
import com.yinshi.app.theme.AppText
import com.yinshi.app.theme.AppTheme
import com.yinshi.app.theme.ButtonVariant
import com.yinshi.app.ui.components.PosterCard

@Composable
fun MineScreen(
    api: Api,
    onOpen: (Long) -> Unit,
    onLogin: () -> Unit,
    onRequests: () -> Unit,
    onNotifications: () -> Unit,
    onDownloads: () -> Unit,
) {
    if (!Session.isLoggedIn) {
        Column(
            Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(Modifier.fillMaxWidth().padding(top = 80.dp), contentAlignment = Alignment.Center) {
                AppText("登录后同步收藏、历史、订阅更新", color = AppTheme.colors.textSecondary)
            }
            AppButton("登录 / 注册", onClick = onLogin, modifier = Modifier.fillMaxWidth())
            AppButton("求片广场", onClick = onRequests, variant = ButtonVariant.Secondary, modifier = Modifier.fillMaxWidth())
            AppButton("⬇ 我的下载", onClick = onDownloads, variant = ButtonVariant.Secondary, modifier = Modifier.fillMaxWidth())
        }
        return
    }

    var favs by remember { mutableStateOf<List<Title>>(emptyList()) }
    var hist by remember { mutableStateOf<List<Title>>(emptyList()) }
    var subs by remember { mutableStateOf<List<Title>>(emptyList()) }
    var unread by remember { mutableStateOf(0) }
    var pushOn by remember { mutableStateOf(isPushEnabled()) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Session.token) {
        try {
            favs = api.favorites().mapNotNull { it.title }
        } catch (_: Throwable) {
        }
        try {
            hist = api.history().mapNotNull { it.title }
        } catch (_: Throwable) {
        }
        try {
            subs = api.subscriptions().mapNotNull { it.title }
        } catch (_: Throwable) {
        }
        unread = try {
            api.unreadCount()
        } catch (_: Throwable) {
            0
        }
    }

    Column(Modifier.fillMaxSize().padding(top = 8.dp)) {
        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                AppText(Session.user?.nickname?.ifBlank { Session.user?.username ?: "" } ?: "", style = AppTheme.typography.title)
                AppText("已登录", style = AppTheme.typography.caption, color = AppTheme.colors.textSecondary)
            }
            AppButton(
                text = "🔔" + if (unread > 0) " $unread" else "",
                onClick = onNotifications,
                variant = if (unread > 0) ButtonVariant.Primary else ButtonVariant.Secondary,
                modifier = Modifier.padding(end = 8.dp),
            )
            AppButton("求片", onClick = onRequests, variant = ButtonVariant.Secondary, modifier = Modifier.padding(end = 8.dp))
            AppButton("退出", onClick = { scope.launch { SessionManager.signOut() } }, variant = ButtonVariant.Outline)
        }

        AppButton(
            "⬇ 我的下载",
            onClick = onDownloads,
            variant = ButtonVariant.Secondary,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        )

        // 推送开关：关掉即注销本机令牌
        AppButton(
            text = if (pushOn) "🔔 更新推送：开" else "🔕 更新推送：关",
            onClick = {
                val target = !pushOn
                pushOn = target
                setPushEnabled(target)
            },
            variant = if (pushOn) ButtonVariant.Secondary else ButtonVariant.Outline,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        )

        PosterRow(title = "继续观看", titles = hist, onOpen = onOpen, emptyHint = "还没有观看记录")
        PosterRow(title = "我的追更", titles = subs, onOpen = onOpen, emptyHint = "还没有追更")
        PosterRow(title = "我的收藏", titles = favs, onOpen = onOpen, emptyHint = "还没有收藏")
    }
}

@Composable
private fun PosterRow(title: String, titles: List<Title>, onOpen: (Long) -> Unit, emptyHint: String) {
    Column(Modifier.padding(top = 12.dp)) {
        AppText(title, style = AppTheme.typography.sectionTitle, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
        if (titles.isEmpty()) {
            AppText(emptyHint, color = AppTheme.colors.textSecondary, modifier = Modifier.padding(horizontal = 16.dp))
        } else {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(titles, key = { it.id }) { t ->
                    PosterCard(title = t, onClick = { onOpen(t.id) }, modifier = Modifier.width(120.dp))
                }
            }
        }
    }
}
