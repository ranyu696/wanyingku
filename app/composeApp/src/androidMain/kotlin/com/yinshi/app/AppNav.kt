package com.yinshi.app

import android.content.Intent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.unit.dp
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import coil3.ImageLoader
import coil3.compose.setSingletonImageLoaderFactory
import coil3.network.ktor3.KtorNetworkFetcherFactory
import com.yinshi.app.data.Api
import com.yinshi.app.data.SessionManager
import com.yinshi.app.data.platform
import com.yinshi.app.theme.AppBackground
import com.yinshi.app.theme.AppText
import com.yinshi.app.theme.AppTheme
import com.yinshi.app.theme.ThemeController
import com.yinshi.app.theme.ThemeMode
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
import com.yinshi.app.ui.RequestsScreen
import com.yinshi.app.ui.SearchScreen
import com.yinshi.app.ui.WatchScreen
import kotlinx.serialization.Serializable

// ---- 路由 key（具体 key 加 @Serializable，返回栈可跨进程死亡留存）----
sealed interface TabKey : NavKey {
    val label: String
    val icon: String
}

@Serializable data object HomeKey : TabKey {
    override val label get() = "首页"
    override val icon get() = "🏠"
}

@Serializable data object CategoryKey : TabKey {
    override val label get() = "分类"
    override val icon get() = "🗂"
}

@Serializable data object SearchKey : TabKey {
    override val label get() = "搜索"
    override val icon get() = "🔍"
}

@Serializable data object MineKey : TabKey {
    override val label get() = "我的"
    override val icon get() = "👤"
}

private val TABS = listOf(HomeKey, CategoryKey, SearchKey, MineKey)

@Serializable data class DetailKey(val id: Long) : NavKey
@Serializable data class PersonKey(val name: String) : NavKey
@Serializable data class CollectionKey(val key: String, val title: String) : NavKey
@Serializable data class WatchKey(val id: Long, val episodeIdx: Int) : NavKey
@Serializable data object LoginKey : NavKey
@Serializable data object RequestsKey : NavKey
@Serializable data object NotificationsKey : NavKey
@Serializable data object DownloadsKey : NavKey
@Serializable data class PlayerKey(val url: String, val title: String) : NavKey

// 覆盖层转场：进栈从右滑入、出栈向右滑出（tab 根屏走 NavDisplay 默认淡入淡出）
private const val ANIM = 320
private val OverlayAnim: Map<String, Any> =
    NavDisplay.transitionSpec {
        (slideInHorizontally(tween(ANIM)) { it } + fadeIn(tween(ANIM))) togetherWith
            (slideOutHorizontally(tween(ANIM)) { -it / 6 } + fadeOut(tween(ANIM)))
    } + NavDisplay.popTransitionSpec {
        (slideInHorizontally(tween(ANIM)) { -it / 6 } + fadeIn(tween(ANIM))) togetherWith
            (slideOutHorizontally(tween(ANIM)) { it } + fadeOut(tween(ANIM)))
    } + NavDisplay.predictivePopTransitionSpec {
        (slideInHorizontally(tween(ANIM)) { -it / 6 } + fadeIn(tween(ANIM))) togetherWith
            (slideOutHorizontally(tween(ANIM)) { it } + fadeOut(tween(ANIM)))
    }

// 深链总线：MainActivity 解析 intent 后写入，AppRoot 观察后入栈。
object DeepLinkBus {
    var pending by mutableStateOf<NavKey?>(null)
}

// 解析 wanyingku://detail/<id> 、 wanyingku://play/<id>
fun parseDeepLink(intent: Intent?): NavKey? {
    val data = intent?.data ?: return null
    if (data.scheme != "wanyingku") return null
    val id = data.lastPathSegment?.toLongOrNull()
    return when (data.host) {
        "detail" -> id?.let { DetailKey(it) }
        "play", "watch" -> id?.let { WatchKey(it, -1) }
        else -> null
    }
}

// 顶部状态栏内边距：四个 tab 屏用（覆盖层各屏自带 inset 处理）
@Composable
private fun TopInset(content: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars)) { content() }
}

@Composable
fun AppRoot() {
    setSingletonImageLoaderFactory { ctx ->
        ImageLoader.Builder(ctx).components { add(KtorNetworkFetcherFactory()) }.build()
    }
    val api = remember { Api() }

    // 启动回填：主题模式 + 登录态（重启免登录）+ 已登录则同步推送令牌
    LaunchedEffect(Unit) {
        platform.prefGet("theme_mode")?.let { saved ->
            runCatching { ThemeController.set(ThemeMode.valueOf(saved)) }
        }
        SessionManager.restore()
        platform.syncPushToken()
    }

    AppTheme {
        AppBackground {
            val backStack = rememberNavBackStack(HomeKey)
            val push: (NavKey) -> Unit = { backStack.add(it) }
            val pop: () -> Unit = { if (backStack.size > 1) backStack.removeAt(backStack.lastIndex) }
            val top = backStack.lastOrNull()

            // 深链：把 wanyingku://detail/123 等推入返回栈（首页在底，返回即回首页）
            val pendingLink = DeepLinkBus.pending
            LaunchedEffect(pendingLink) {
                if (pendingLink != null) {
                    if (backStack.lastOrNull() != pendingLink) backStack.add(pendingLink)
                    DeepLinkBus.pending = null
                }
            }

            Column(Modifier.fillMaxSize()) {
                NavDisplay(
                    backStack = backStack,
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    onBack = { pop() },
                    transitionSpec = { fadeIn(tween(200)) togetherWith fadeOut(tween(200)) },
                    popTransitionSpec = { fadeIn(tween(200)) togetherWith fadeOut(tween(200)) },
                    predictivePopTransitionSpec = { fadeIn(tween(200)) togetherWith fadeOut(tween(200)) },
                    entryProvider = entryProvider {
                        entry<HomeKey> {
                            TopInset {
                                HomeScreen(
                                    api,
                                    onOpen = { push(DetailKey(it)) },
                                    onOpenCollection = { key, title -> push(CollectionKey(key, title)) },
                                )
                            }
                        }
                        entry<CategoryKey> { TopInset { CategoryScreen(api, onOpen = { push(DetailKey(it)) }) } }
                        entry<SearchKey> { TopInset { SearchScreen(api, onOpen = { push(DetailKey(it)) }) } }
                        entry<MineKey> {
                            TopInset {
                                MineScreen(
                                    api,
                                    onOpen = { push(DetailKey(it)) },
                                    onLogin = { push(LoginKey) },
                                    onRequests = { push(RequestsKey) },
                                    onNotifications = { push(NotificationsKey) },
                                    onDownloads = { push(DownloadsKey) },
                                )
                            }
                        }
                        entry<DetailKey>(metadata = OverlayAnim) { key ->
                            DetailScreen(
                                api,
                                key.id,
                                onBack = pop,
                                onOpen = { push(DetailKey(it)) },
                                onOpenPerson = { push(PersonKey(it)) },
                                onOpenWatch = { id, ep -> push(WatchKey(id, ep)) },
                            )
                        }
                        entry<WatchKey>(metadata = OverlayAnim) { key -> WatchScreen(api, key.id, key.episodeIdx, onBack = pop) }
                        entry<PersonKey>(metadata = OverlayAnim) { key -> PersonScreen(api, key.name, onBack = pop, onOpen = { push(DetailKey(it)) }) }
                        entry<CollectionKey>(metadata = OverlayAnim) { key ->
                            CollectionScreen(api, key.key, key.title, onBack = pop, onOpen = { push(DetailKey(it)) })
                        }
                        entry<LoginKey>(metadata = OverlayAnim) { LoginScreen(api, onClose = pop) }
                        entry<RequestsKey>(metadata = OverlayAnim) { RequestsScreen(api, onBack = pop) }
                        entry<NotificationsKey>(metadata = OverlayAnim) { NotificationsScreen(api, onBack = pop) }
                        entry<DownloadsKey>(metadata = OverlayAnim) {
                            DownloadsScreen(onBack = pop, onPlay = { url, title -> push(PlayerKey(url, title)) })
                        }
                        entry<PlayerKey>(metadata = OverlayAnim) { key -> PlayerScreen(key.url, key.title, onBack = pop) }
                    },
                )
                // 仅在 tab 根屏显示底部导航；进覆盖层（详情/播放…）即全屏隐藏
                if (top is TabKey) {
                    BottomBar(current = top, onSelect = { tab -> backStack.clear(); backStack.add(tab) })
                }
            }
        }
    }
}

@Composable
private fun BottomBar(current: TabKey, onSelect: (TabKey) -> Unit) {
    Column(
        Modifier.fillMaxWidth()
            .background(AppTheme.colors.surface)
            .windowInsetsPadding(WindowInsets.navigationBars),
    ) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(AppTheme.colors.border))
        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
            TABS.forEach { t ->
                val selected = t == current
                Column(
                    Modifier.weight(1f).clickable { onSelect(t) }
                        .alpha(if (selected) 1f else 0.55f)
                        .padding(vertical = 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    AppText(t.icon, style = AppTheme.typography.sectionTitle)
                    AppText(
                        t.label,
                        style = AppTheme.typography.caption,
                        color = if (selected) AppTheme.colors.primary else AppTheme.colors.text,
                    )
                }
            }
        }
    }
}
