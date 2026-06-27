package com.yinshi.app.theme

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.view.WindowInsetsController
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalContext

private fun Context.activity(): Activity? {
    var c: Context? = this
    while (c is ContextWrapper) {
        if (c is Activity) return c
        c = c.baseContext
    }
    return null
}

// 浅色主题→深色系统栏图标；深色主题→浅色图标。minSdk 30 直接用平台 WindowInsetsController。
@Composable
actual fun ApplySystemBarsTheme(darkTheme: Boolean) {
    val ctx = LocalContext.current
    LaunchedEffect(darkTheme) {
        val ctl = ctx.activity()?.window?.insetsController ?: return@LaunchedEffect
        val light = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
            WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
        ctl.setSystemBarsAppearance(if (darkTheme) 0 else light, light)
    }
}
