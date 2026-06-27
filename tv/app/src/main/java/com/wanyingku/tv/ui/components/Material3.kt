package com.wanyingku.tv.ui.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import com.wanyingku.tv.ui.theme.Brand
import com.wanyingku.tv.ui.theme.Ink

// tv-material 不含 TextField/Button 文本输入控件，这里用普通 material3 控件并套暗色主题。
// 与外层 tv MaterialTheme 互不干扰（各读各的 CompositionLocal）。
@Composable
fun M3Dark(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = darkColorScheme(primary = Brand, background = Ink, surface = Ink)) {
        content()
    }
}
