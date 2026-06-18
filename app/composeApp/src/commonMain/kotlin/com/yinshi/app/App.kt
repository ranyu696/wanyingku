package com.yinshi.app

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.setSingletonImageLoaderFactory
import coil3.network.ktor3.KtorNetworkFetcherFactory
import com.yinshi.app.data.Api
import com.yinshi.app.data.SessionManager
import com.yinshi.app.data.syncPushToken
import com.yinshi.app.theme.AppBackground
import com.yinshi.app.theme.AppText
import com.yinshi.app.theme.AppTheme
import com.yinshi.app.ui.CategoryScreen
import com.yinshi.app.ui.CollectionScreen
import com.yinshi.app.ui.DetailScreen
import com.yinshi.app.ui.DownloadsScreen
import com.yinshi.app.ui.HomeScreen
import com.yinshi.app.ui.LoginScreen
import com.yinshi.app.ui.MineScreen
import com.yinshi.app.ui.NotificationsScreen
import com.yinshi.app.ui.PersonScreen
import com.yinshi.app.ui.PlayerScreen
import com.yinshi.app.ui.WatchScreen
import com.yinshi.app.ui.RequestsScreen
import com.yinshi.app.ui.SearchScreen

enum class Tab(val label: String) { Home("首页"), Category("分类"), Search("搜索"), Mine("我的") }

sealed interface Overlay {
    data class Detail(val id: Long) : Overlay
    data class Person(val name: String) : Overlay
    data class Collection(val key: String, val title: String) : Overlay
    data class Watch(val id: Long, val episodeIdx: Int) : Overlay
    data object Login : Overlay
    data object Requests : Overlay
    data object Notifications : Overlay
    data object Downloads : Overlay
    data class Player(val url: String, val title: String) : Overlay
}

@Composable
fun App() {
    setSingletonImageLoaderFactory { ctx ->
        ImageLoader.Builder(ctx).components { add(KtorNetworkFetcherFactory()) }.build()
    }
    val api = remember { Api() }
    var tab by remember { mutableStateOf(Tab.Home) }
    var overlay by remember { mutableStateOf<Overlay?>(null) }

    // 启动回填登录态（重启免登录）+ 已登录则同步推送令牌
    LaunchedEffect(Unit) {
        SessionManager.restore()
        syncPushToken()
    }

    val openDetail: (Long) -> Unit = { overlay = Overlay.Detail(it) }

    AppTheme {
        AppBackground {
            when (val ov = overlay) {
                is Overlay.Detail -> key(ov.id) {
                    DetailScreen(
                        api,
                        ov.id,
                        onBack = { overlay = null },
                        onOpen = openDetail,
                        onOpenPerson = { overlay = Overlay.Person(it) },
                        onOpenWatch = { tid, ep -> overlay = Overlay.Watch(tid, ep) },
                    )
                }
                is Overlay.Watch -> WatchScreen(
                    api,
                    ov.id,
                    ov.episodeIdx,
                    onBack = { overlay = Overlay.Detail(ov.id) },
                )
                is Overlay.Person -> PersonScreen(api, ov.name, onBack = { overlay = null }, onOpen = openDetail)
                is Overlay.Collection -> CollectionScreen(
                    api,
                    ov.key,
                    ov.title,
                    onBack = { overlay = null },
                    onOpen = openDetail,
                )
                Overlay.Login -> LoginScreen(api, onClose = { overlay = null })
                Overlay.Requests -> RequestsScreen(api, onBack = { overlay = null })
                Overlay.Notifications -> NotificationsScreen(api, onBack = { overlay = null })
                Overlay.Downloads -> DownloadsScreen(
                    onBack = { overlay = null },
                    onPlay = { url, title -> overlay = Overlay.Player(url, title) },
                )
                is Overlay.Player -> PlayerScreen(
                    ov.url,
                    ov.title,
                    onBack = { overlay = Overlay.Downloads },
                )
                null -> Column(Modifier.fillMaxSize()) {
                    Box(
                        Modifier.fillMaxWidth().weight(1f)
                            .windowInsetsPadding(WindowInsets.statusBars),
                    ) {
                        when (tab) {
                            Tab.Home -> HomeScreen(
                                api,
                                onOpen = openDetail,
                                onOpenCollection = { key, title -> overlay = Overlay.Collection(key, title) },
                            )
                            Tab.Category -> CategoryScreen(api, onOpen = openDetail)
                            Tab.Search -> SearchScreen(api, onOpen = openDetail)
                            Tab.Mine -> MineScreen(
                                api,
                                onOpen = openDetail,
                                onLogin = { overlay = Overlay.Login },
                                onRequests = { overlay = Overlay.Requests },
                                onNotifications = { overlay = Overlay.Notifications },
                                onDownloads = { overlay = Overlay.Downloads },
                            )
                        }
                    }
                    BottomBar(current = tab, onSelect = { tab = it })
                }
            }
        }
    }
}

@Composable
private fun BottomBar(current: Tab, onSelect: (Tab) -> Unit) {
    Row(
        Modifier.fillMaxWidth()
            .background(AppTheme.colors.surface)
            .windowInsetsPadding(WindowInsets.navigationBars)
            .padding(vertical = 10.dp),
    ) {
        Tab.entries.forEach { t ->
            val selected = t == current
            Box(
                Modifier.weight(1f).clickable { onSelect(t) }.padding(vertical = 4.dp),
                contentAlignment = Alignment.Center,
            ) {
                AppText(
                    t.label,
                    style = AppTheme.typography.label,
                    color = if (selected) AppTheme.colors.primary else AppTheme.colors.textSecondary,
                )
            }
        }
    }
}
