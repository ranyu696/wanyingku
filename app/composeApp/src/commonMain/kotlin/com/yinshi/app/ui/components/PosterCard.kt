package com.yinshi.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.yinshi.app.data.Title
import com.yinshi.app.theme.AppCard
import com.yinshi.app.theme.AppText
import com.yinshi.app.theme.AppTheme

// 宽度由调用方控制：首页横排传 Modifier.width(120.dp)，网格传 Modifier.fillMaxWidth()。
// rank 非空时左上角显示名次徽标（排行榜第 4 名起用）。
@Composable
fun PosterCard(title: Title, onClick: () -> Unit, modifier: Modifier = Modifier, rank: Int? = null) {
    val isDouban = title.douban_rating > 0
    val rating = when {
        isDouban -> "豆 " + (kotlin.math.round(title.douban_rating * 10) / 10.0)
        title.vote_average > 0 -> "★ " + (kotlin.math.round(title.vote_average * 10) / 10.0)
        else -> ""
    }
    Column(modifier = modifier) {
        AppCard(modifier = Modifier.fillMaxWidth().aspectRatio(2f / 3f), onClick = onClick) {
            Box(Modifier.fillMaxSize()) {
                AsyncImage(
                    model = title.poster,
                    contentDescription = title.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
                if (rating.isNotEmpty()) {
                    Box(
                        Modifier.align(Alignment.TopEnd).padding(6.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color(0xAA000000))
                            .padding(horizontal = 5.dp, vertical = 1.dp),
                    ) {
                        AppText(
                            rating,
                            style = AppTheme.typography.caption,
                            color = if (isDouban) Color(0xFFFFCE3D) else Color.White,
                            maxLines = 1,
                        )
                    }
                }
                if (rank != null) {
                    Box(
                        Modifier.align(Alignment.TopStart).padding(6.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color(0xAA000000))
                            .padding(horizontal = 6.dp, vertical = 1.dp),
                    ) {
                        AppText("$rank", style = AppTheme.typography.caption, color = Color.White, maxLines = 1)
                    }
                }
            }
        }
        AppText(
            text = title.name,
            style = AppTheme.typography.label,
            maxLines = 1,
            modifier = Modifier.padding(top = 6.dp),
        )
        if (title.year > 0) {
            AppText(
                title.year.toString(),
                style = AppTheme.typography.caption,
                color = AppTheme.colors.textSecondary,
                maxLines = 1,
            )
        }
    }
}
