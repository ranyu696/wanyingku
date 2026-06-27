package com.wanyingku.tv.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.darkColorScheme

val Brand = Color(0xFFFF4D5E)
val Ink = Color(0xFF0E0E14)
val Surface1 = Color(0xFF1C1C26)

private val colors = darkColorScheme(
    primary = Brand,
    onPrimary = Color.White,
    background = Ink,
    surface = Surface1,
    onSurface = Color(0xFFEDEDF2),
    onSurfaceVariant = Color(0xFFB6B6C2),
)

@Composable
fun WanYingTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = colors, content = content)
}
