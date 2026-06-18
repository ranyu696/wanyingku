package com.yinshi.app.ui.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.yinshi.app.theme.AppTheme

// 呼吸式 alpha，骨架屏共用
@Composable
private fun shimmerAlpha(): Float {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val alpha by transition.animateFloat(
        initialValue = 0.35f,
        targetValue = 0.85f,
        animationSpec = infiniteRepeatable(animation = tween(800), repeatMode = RepeatMode.Reverse),
        label = "alpha",
    )
    return alpha
}

@Composable
private fun Bar(modifier: Modifier, alpha: Float) {
    Box(
        modifier.clip(RoundedCornerShape(4.dp))
            .background(AppTheme.colors.surfaceVariant.copy(alpha = alpha)),
    )
}

@Composable
fun PosterSkeleton(alpha: Float, modifier: Modifier = Modifier) {
    Column(modifier) {
        Box(
            Modifier.fillMaxWidth().aspectRatio(2f / 3f).clip(RoundedCornerShape(8.dp))
                .background(AppTheme.colors.surfaceVariant.copy(alpha = alpha)),
        )
        Bar(Modifier.padding(top = 6.dp).fillMaxWidth(0.82f).height(12.dp), alpha)
        Bar(Modifier.padding(top = 4.dp).fillMaxWidth(0.5f).height(10.dp), alpha)
    }
}

// 首页加载骨架：banner + 三排横向卡
@Composable
fun HomeSkeleton() {
    val alpha = shimmerAlpha()
    Column(Modifier.fillMaxWidth()) {
        Box(
            Modifier.fillMaxWidth().aspectRatio(16f / 9f)
                .background(AppTheme.colors.surfaceVariant.copy(alpha = alpha)),
        )
        repeat(3) {
            Bar(Modifier.padding(start = 16.dp, top = 16.dp, bottom = 8.dp).fillMaxWidth(0.32f).height(18.dp), alpha)
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                repeat(3) { PosterSkeleton(alpha, Modifier.weight(1f)) }
            }
        }
    }
}

// 网格加载骨架（分类/搜索）
@Composable
fun GridSkeleton(rows: Int = 4) {
    val alpha = shimmerAlpha()
    Column(
        Modifier.fillMaxWidth().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        repeat(rows) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                repeat(3) { PosterSkeleton(alpha, Modifier.weight(1f)) }
            }
        }
    }
}
