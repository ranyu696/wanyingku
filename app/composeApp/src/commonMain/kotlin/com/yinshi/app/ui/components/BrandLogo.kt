package com.yinshi.app.ui.components

import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import coil3.compose.AsyncImage
import com.yinshi.app.data.platform
import com.yinshi.app.theme.LocalIsDark

// 万影库字标，跟随主题：深色主题用浅色字版（透明底），浅色主题用白底深字版。
@Composable
fun BrandLogo(height: Dp, modifier: Modifier = Modifier) {
    val dark = LocalIsDark.current
    // 两版 logo 宽高比不同：深色版 621:160、浅色版 2092:752
    val ratio = if (dark) 621f / 160f else 2092f / 752f
    AsyncImage(
        model = platform.brandLogo(light = !dark),
        contentDescription = "万影库",
        contentScale = ContentScale.Fit,
        modifier = modifier.height(height).aspectRatio(ratio),
    )
}
