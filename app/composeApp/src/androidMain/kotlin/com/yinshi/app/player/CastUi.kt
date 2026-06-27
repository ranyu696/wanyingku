package com.yinshi.app.player

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.media3.common.Player
import androidx.mediarouter.media.MediaRouteSelector
import androidx.mediarouter.media.MediaRouter

private val BRAND = Color(0xFFFF3D5A)

// 设备选择器：打开时主动扫描，列出可投屏设备，点选即连接。
@Composable
fun CastPicker(
    mediaRouter: MediaRouter?,
    selector: MediaRouteSelector,
    casting: Boolean,
    onStop: () -> Unit,
    onDismiss: () -> Unit,
) {
    var routes by remember { mutableStateOf(listOf<MediaRouter.RouteInfo>()) }
    DisposableEffect(mediaRouter) {
        val mr = mediaRouter ?: return@DisposableEffect onDispose { }
        fun refresh() {
            routes = mr.routes.filter { it.matchesSelector(selector) && !it.isDefault }
        }
        val cb = object : MediaRouter.Callback() {
            override fun onRouteAdded(router: MediaRouter, route: MediaRouter.RouteInfo) = refresh()
            override fun onRouteRemoved(router: MediaRouter, route: MediaRouter.RouteInfo) = refresh()
            override fun onRouteChanged(router: MediaRouter, route: MediaRouter.RouteInfo) = refresh()
        }
        mr.addCallback(selector, cb, MediaRouter.CALLBACK_FLAG_PERFORM_ACTIVE_SCAN)
        refresh()
        onDispose { mr.removeCallback(cb) }
    }
    Dialog(onDismissRequest = onDismiss) {
        Column(
            Modifier.clip(RoundedCornerShape(14.dp)).background(Color(0xFF16161E))
                .heightIn(max = 420.dp).padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            BasicText("选择投屏设备", style = TextStyle(color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold))
            if (routes.isEmpty()) {
                BasicText(
                    "未发现设备，确保手机与 Chromecast/电视在同一 Wi-Fi",
                    style = TextStyle(color = Color(0xFFA8A8B3), fontSize = 13.sp),
                )
            }
            routes.forEach { route ->
                val selected = route.isSelected
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp))
                        .clickable { mediaRouter?.selectRoute(route) }
                        .padding(vertical = 10.dp, horizontal = 4.dp),
                ) {
                    BasicText(
                        (if (selected) "📺 " else "") + route.name,
                        style = TextStyle(color = if (selected) BRAND else Color.White, fontSize = 14.sp),
                    )
                }
            }
            if (casting) {
                Box(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(Color(0x33FF3D5A))
                        .clickable(onClick = onStop).padding(vertical = 10.dp, horizontal = 12.dp),
                ) {
                    BasicText("⏹ 停止投屏", style = TextStyle(color = BRAND, fontSize = 14.sp))
                }
            }
        }
    }
}

// 投屏中：盖住本地播放器，显示设备名 + 远端播放/暂停/停止。
@Composable
fun CastingOverlay(device: String, player: Player, onStop: () -> Unit) {
    var playing by remember { mutableStateOf(player.isPlaying) }
    DisposableEffect(player) {
        val l = object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                playing = isPlaying
            }
        }
        player.addListener(l)
        onDispose { player.removeListener(l) }
    }
    Column(
        Modifier.fillMaxSize().background(Color(0xF2000000)),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        BasicText(
            "📺 正在投屏" + if (device.isNotBlank()) " · $device" else "",
            style = TextStyle(color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold),
        )
        Row(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            CastBtn(if (playing) "❚❚ 暂停" else "▶ 播放") { if (player.isPlaying) player.pause() else player.play() }
            CastBtn("⏹ 停止") { onStop() }
        }
    }
}

@Composable
private fun CastBtn(text: String, onClick: () -> Unit) {
    Box(
        Modifier.clip(RoundedCornerShape(10.dp)).background(Color(0x33FFFFFF))
            .clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 10.dp),
    ) {
        BasicText(text, style = TextStyle(color = Color.White, fontSize = 14.sp))
    }
}
