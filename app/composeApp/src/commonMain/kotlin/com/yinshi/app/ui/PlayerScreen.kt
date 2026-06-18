package com.yinshi.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.yinshi.app.player.VideoPlayer
import com.yinshi.app.theme.AppButton
import com.yinshi.app.theme.AppText
import com.yinshi.app.theme.AppTheme
import com.yinshi.app.theme.ButtonVariant

// 独立播放页：直接按 url 播放（已缓存的可离线）。供下载页点击起播。
@Composable
fun PlayerScreen(url: String, title: String, onBack: () -> Unit) {
    Column(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars)) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AppButton("← 返回", onClick = onBack, variant = ButtonVariant.Outline)
            AppText(title, style = AppTheme.typography.title, modifier = Modifier.padding(start = 12.dp))
        }
        Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f)) {
            VideoPlayer(
                url = url,
                modifier = Modifier.fillMaxSize(),
                startPositionMs = 0,
                onProgress = { _, _ -> },
                onEnded = {},
                introEndMs = 0,
                outroStartMs = 0,
                onCurrentTimeMs = {},
            )
        }
        AppText(
            "已缓存的视频可断网观看",
            style = AppTheme.typography.caption,
            color = AppTheme.colors.textSecondary,
            modifier = Modifier.padding(16.dp),
        )
    }
}
