package com.yinshi.app

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import com.yinshi.app.data.AndroidPlatform
import com.yinshi.app.data.AppContextHolder
import com.yinshi.app.data.platform

class MainActivity : ComponentActivity() {
    // 下载通知需要（Android 13+）
    private val notifPerm = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        AppContextHolder.context = applicationContext // DataStore 需要
        platform = AndroidPlatform() // 平台能力实现（持久化/缓存/品牌图/推送）
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notifPerm.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        DeepLinkBus.pending = parseDeepLink(intent) // 冷启动深链
        setContent { AppRoot() }
    }

    // 应用已在运行时收到的深链（需 launchMode=singleTop）
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        DeepLinkBus.pending = parseDeepLink(intent)
    }
}
