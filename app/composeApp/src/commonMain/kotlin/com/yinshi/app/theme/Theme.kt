package com.yinshi.app.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier

enum class ThemeMode { System, Light, Dark }

// 主题模式：可观察的全局状态。AppTheme 订阅它，切换即整树重组换色。持久化在调用方（见 App.kt / MineScreen）。
object ThemeController {
    var mode by mutableStateOf(ThemeMode.System)
        private set

    fun set(m: ThemeMode) {
        mode = m
    }
}

// 平台设置系统栏图标明暗（浅色主题→深色图标，深色主题→浅色图标）。非 Android 无操作。
@Composable
expect fun ApplySystemBarsTheme(darkTheme: Boolean)

// 当前是否深色主题，供组件按需取不同资源（如 logo 深/浅两版）
val LocalIsDark = staticCompositionLocalOf { true }

// 全局主题入口。把所有令牌注入到 CompositionLocal，子树用 AppTheme.colors / .spacing 取。
// 注：Compose Unstyled 也提供 composeunstyled-theming 的令牌 DSL，想用其原生主题系统可平滑替换这里，
// 取值入口（AppTheme.*）保持不变即可。
@Composable
fun AppTheme(content: @Composable () -> Unit) {
    val dark = when (ThemeController.mode) {
        ThemeMode.Dark -> true
        ThemeMode.Light -> false
        ThemeMode.System -> isSystemInDarkTheme()
    }
    ApplySystemBarsTheme(dark)
    CompositionLocalProvider(
        LocalIsDark provides dark,
        LocalAppColors provides if (dark) DarkColors else LightColors,
        LocalAppShapes provides AppShapes(),
        LocalAppSpacing provides AppSpacing(),
        LocalAppTypography provides AppTypography(),
    ) {
        content()
    }
}

// 统一取值入口，组件里写 AppTheme.colors.primary 这种。
object AppTheme {
    val colors: AppColors
        @Composable @ReadOnlyComposable get() = LocalAppColors.current
    val shapes: AppShapes
        @Composable @ReadOnlyComposable get() = LocalAppShapes.current
    val spacing: AppSpacing
        @Composable @ReadOnlyComposable get() = LocalAppSpacing.current
    val typography: AppTypography
        @Composable @ReadOnlyComposable get() = LocalAppTypography.current
}

// 页面根容器：铺品牌底色。
@Composable
fun AppBackground(content: @Composable () -> Unit) {
    androidx.compose.foundation.layout.Box(
        Modifier.fillMaxSize().background(AppTheme.colors.background),
    ) { content() }
}
