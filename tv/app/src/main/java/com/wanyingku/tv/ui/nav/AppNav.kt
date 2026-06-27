package com.wanyingku.tv.ui.nav

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import com.wanyingku.tv.R
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.Person
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.tv.material3.Icon
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.wanyingku.tv.ui.browse.BrowseScreen
import com.wanyingku.tv.ui.detail.DetailScreen
import com.wanyingku.tv.ui.home.HomeScreen
import com.wanyingku.tv.ui.login.LoginScreen
import com.wanyingku.tv.ui.mine.MineScreen
import com.wanyingku.tv.ui.player.PlayerScreen
import com.wanyingku.tv.ui.requests.RequestsScreen
import com.wanyingku.tv.ui.search.SearchScreen

object Routes {
    const val HOME = "home"
    const val BROWSE = "browse"
    const val SEARCH = "search"
    const val REQUESTS = "requests"
    const val MINE = "mine"
    const val LOGIN = "login"
    fun detail(id: Long) = "detail/$id"
    fun player(id: Long, line: Int, ep: Int) = "player/$id?line=$line&ep=$ep"
}

private data class RailItem(val route: String, val label: String, val icon: ImageVector)

private val RAIL = listOf(
    RailItem(Routes.HOME, "首页", Icons.Default.Home),
    RailItem(Routes.BROWSE, "浏览", Icons.Default.GridView),
    RailItem(Routes.SEARCH, "搜索", Icons.Default.Search),
    RailItem(Routes.REQUESTS, "求片", Icons.Default.Campaign),
    RailItem(Routes.MINE, "我的", Icons.Default.Person),
)

@Composable
fun AppNav() {
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    val route = backStack?.destination?.route
    val showRail = route in RAIL.map { it.route }

    val open: (Long) -> Unit = { nav.navigate(Routes.detail(it)) }
    val play: (Long, Int, Int) -> Unit = { id, line, ep -> nav.navigate(Routes.player(id, line, ep)) }
    val login: () -> Unit = { nav.navigate(Routes.LOGIN) }
    val back: () -> Unit = { nav.popBackStack() }

    Row(Modifier.fillMaxSize()) {
        if (showRail) {
            NavRail(current = route) { dest ->
                if (dest != route) nav.navigate(dest) {
                    popUpTo(Routes.HOME) { saveState = true }
                    launchSingleTop = true
                    restoreState = true
                }
            }
        }
        NavHost(navController = nav, startDestination = Routes.HOME, modifier = Modifier.fillMaxSize()) {
            composable(Routes.HOME) { HomeScreen(onTitle = open) }
            composable(Routes.BROWSE) { BrowseScreen(onTitle = open) }
            composable(Routes.SEARCH) { SearchScreen(onTitle = open) }
            composable(Routes.REQUESTS) { RequestsScreen(onLogin = login) }
            composable(Routes.MINE) { MineScreen(onTitle = open, onLogin = login) }
            composable(Routes.LOGIN) { LoginScreen(onDone = back) }

            longArg("detail/{id}") { id -> DetailScreen(id = id, onPlay = play, onTitle = open, onBack = back, onLogin = login) }

            composable(
                route = "player/{id}?line={line}&ep={ep}",
                arguments = listOf(
                    navArgument("id") { type = NavType.LongType },
                    navArgument("line") { type = NavType.IntType; defaultValue = 0 },
                    navArgument("ep") { type = NavType.IntType; defaultValue = 0 },
                ),
            ) { entry ->
                PlayerScreen(
                    id = entry.arguments!!.getLong("id"),
                    lineIdx = entry.arguments!!.getInt("line"),
                    epIdx = entry.arguments!!.getInt("ep"),
                    onBack = back,
                )
            }
        }
    }
}

private fun NavGraphBuilder.longArg(route: String, content: @Composable (Long) -> Unit) {
    composable(route, arguments = listOf(navArgument("id") { type = NavType.LongType })) { entry ->
        content(entry.arguments!!.getLong("id"))
    }
}

@Composable
private fun NavRail(current: String?, onSelect: (String) -> Unit) {
    Column(
        Modifier.fillMaxHeight().width(170.dp).padding(vertical = 24.dp, horizontal = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Image(
            painter = painterResource(R.drawable.wyk_logo),
            contentDescription = "万影库",
            contentScale = ContentScale.Fit,
            modifier = Modifier.padding(start = 6.dp, bottom = 20.dp).width(140.dp).height(36.dp),
        )
        RAIL.forEach { item ->
            val selected = item.route == current
            Surface(onClick = { onSelect(item.route) }, modifier = Modifier.width(146.dp)) {
                Row(Modifier.padding(horizontal = 14.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(
                        item.icon,
                        contentDescription = item.label,
                        modifier = Modifier.size(22.dp),
                        tint = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        item.label,
                        style = MaterialTheme.typography.titleSmall,
                        color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
        }
    }
}
