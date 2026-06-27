package com.wanyingku.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.material3.CircularProgressIndicator
import androidx.tv.material3.Card
import androidx.tv.material3.Icon
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import coil3.compose.AsyncImage
import com.wanyingku.tv.data.Title
import com.wanyingku.tv.data.poster

private val cardWidth = 132.dp

// 海报卡：聚焦自动放大（tv-material Card 内建）。成人内容模糊 + 标记。
@Composable
fun PosterCard(title: Title, onClick: (Long) -> Unit, modifier: Modifier = Modifier) {
    Card(onClick = { onClick(title.id) }, modifier = modifier.width(cardWidth)) {
        Box {
            AsyncImage(
                model = title.poster.poster(400),
                contentDescription = title.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(2f / 3f)
                    .background(Color(0xFF1C1C26))
                    .then(if (title.adult) Modifier.blur(20.dp) else Modifier),
            )
            if (title.adult) {
                Box(
                    Modifier.fillMaxSize().background(Color(0x55000000)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Default.VisibilityOff, contentDescription = "成人内容", tint = Color.White)
                }
            }
            if (title.latestEpisode > 0 && title.totalEpisodes != 1) {
                Badge(
                    text = if (title.serialComplete) "完结·${title.latestEpisode}" else "更新至${title.latestEpisode}",
                    modifier = Modifier.align(Alignment.BottomEnd).padding(4.dp),
                )
            }
        }
        Text(
            text = title.name,
            style = MaterialTheme.typography.bodySmall,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 4.dp),
        )
    }
}

@Composable
fun Badge(text: String, modifier: Modifier = Modifier) {
    Box(
        modifier
            .background(Color(0xCCFF4D5E), MaterialTheme.shapes.small)
            .padding(horizontal = 6.dp, vertical = 2.dp),
    ) {
        Text(text, style = MaterialTheme.typography.labelSmall, color = Color.White)
    }
}

@Composable
fun TitleRow(label: String, items: List<Title>, onClick: (Long) -> Unit) {
    if (items.isEmpty()) return
    Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        Text(
            label,
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(start = 48.dp, bottom = 8.dp),
        )
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            contentPadding = PaddingValues(horizontal = 48.dp, vertical = 8.dp),
        ) {
            items(items, key = { it.id }) { PosterCard(it, onClick) }
        }
    }
}

// 可聚焦筛选项：选中用品牌色文字标识，聚焦高亮由 tv Surface 内建。
@Composable
fun Chip(text: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Surface(onClick = onClick, modifier = modifier) {
        Text(
            text,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
            style = MaterialTheme.typography.titleSmall,
            color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
        )
    }
}

@Composable
fun Loading(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
    }
}

@Composable
fun CenterMessage(text: String, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize().padding(48.dp), contentAlignment = Alignment.Center) {
        Text(text, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
