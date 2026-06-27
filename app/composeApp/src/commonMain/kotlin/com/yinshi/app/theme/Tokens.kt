package com.yinshi.app.theme

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// 设计令牌：这是「你自己的样式 UI 库」的根基。
// Compose Unstyled 的组件不带任何样式 —— 所有外观都从这里取，做到一处改、全局变。

@Immutable
data class AppColors(
    val primary: Color = Color(0xFFFF3D5A),       // 品牌红，沿用网页端
    val secondary: Color = Color(0xFF8B5CF6),     // 紫
    val background: Color = Color(0xFF08080C),    // 页面底
    val surface: Color = Color(0xFF16161E),       // 卡片
    val surfaceVariant: Color = Color(0xFF1C1C26),// 输入框/chip
    val onPrimary: Color = Color(0xFFFFFFFF),
    val text: Color = Color(0xFFF5F5F7),          // 主文字
    val textSecondary: Color = Color(0xFFA8A8B3), // 次文字
    val textDisabled: Color = Color(0xFF6B6B78),
    val border: Color = Color(0x1AFFFFFF),        // 10% 白描边
    val rating: Color = Color(0xFFFFC234),        // 评分星
)

// 深色（默认）与浅色两套品牌色板：主题切换时整树换色，品牌红/紫保持不变。
val DarkColors = AppColors()
val LightColors = AppColors(
    primary = Color(0xFFFF3D5A),
    secondary = Color(0xFF8B5CF6),
    background = Color(0xFFF6F6FA),
    surface = Color(0xFFFFFFFF),
    surfaceVariant = Color(0xFFECECF2),
    onPrimary = Color(0xFFFFFFFF),
    text = Color(0xFF14141A),
    textSecondary = Color(0xFF5C5C68),
    textDisabled = Color(0xFFAEAEB8),
    border = Color(0x14000000),
    rating = Color(0xFFE6A100),
)

@Immutable
data class AppShapes(
    val sm: Dp = 8.dp,
    val md: Dp = 12.dp,
    val lg: Dp = 16.dp,
    val pill: Dp = 999.dp,
)

@Immutable
data class AppSpacing(
    val xs: Dp = 4.dp,
    val sm: Dp = 8.dp,
    val md: Dp = 12.dp,
    val lg: Dp = 16.dp,
    val xl: Dp = 24.dp,
)

@Immutable
data class AppTypography(
    val title: TextStyle = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Bold),
    val sectionTitle: TextStyle = TextStyle(fontSize = 17.sp, fontWeight = FontWeight.Bold),
    val body: TextStyle = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Normal),
    val label: TextStyle = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.SemiBold),
    val caption: TextStyle = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Normal),
)

val LocalAppColors = staticCompositionLocalOf { AppColors() }
val LocalAppShapes = staticCompositionLocalOf { AppShapes() }
val LocalAppSpacing = staticCompositionLocalOf { AppSpacing() }
val LocalAppTypography = staticCompositionLocalOf { AppTypography() }
