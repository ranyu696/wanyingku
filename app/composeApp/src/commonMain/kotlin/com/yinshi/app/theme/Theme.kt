package com.yinshi.app.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Modifier

// 全局主题入口。把所有令牌注入到 CompositionLocal，子树用 AppTheme.colors / .spacing 取。
// 注：Compose Unstyled 也提供 composeunstyled-theming 的令牌 DSL，想用其原生主题系统可平滑替换这里，
// 取值入口（AppTheme.*）保持不变即可。
@Composable
fun AppTheme(content: @Composable () -> Unit) {
    CompositionLocalProvider(
        LocalAppColors provides AppColors(),
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
