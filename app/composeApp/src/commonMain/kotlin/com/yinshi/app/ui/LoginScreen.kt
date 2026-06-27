package com.yinshi.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.yinshi.app.data.Api
import com.yinshi.app.data.SessionManager
import com.yinshi.app.data.platform
import com.yinshi.app.theme.AppButton
import com.yinshi.app.theme.AppText
import com.yinshi.app.theme.AppTextField
import com.yinshi.app.theme.AppTheme
import com.yinshi.app.theme.ButtonVariant
import com.yinshi.app.ui.components.BrandLogo
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(api: Api, onClose: () -> Unit) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isRegister by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun submit() {
        if (username.isBlank() || password.isBlank()) {
            error = "请输入用户名和密码"
            return
        }
        scope.launch {
            loading = true
            error = null
            try {
                val res = if (isRegister) {
                    api.register(username.trim(), password, username.trim())
                } else {
                    api.login(username.trim(), password)
                }
                if (res?.token != null) {
                    SessionManager.signIn(res)
                    platform.syncPushToken() // 登录后同步推送令牌
                    onClose()
                } else {
                    error = "用户名或密码错误"
                }
            } catch (e: Throwable) {
                error = e.message ?: "请求失败"
            }
            loading = false
        }
    }

    Column(
        Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.statusBars).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        AppButton("← 返回", onClick = onClose, variant = ButtonVariant.Outline)
        BrandLogo(
            height = 40.dp,
            modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = 16.dp),
        )
        AppText(if (isRegister) "注册" else "登录", style = AppTheme.typography.title)
        AppTextField(username, { username = it }, "用户名", Modifier.fillMaxWidth())
        AppTextField(password, { password = it }, "密码", Modifier.fillMaxWidth(), mask = true)
        error?.let { AppText(it, color = AppTheme.colors.primary) }
        AppButton(
            text = if (loading) "请稍候…" else if (isRegister) "注册并登录" else "登录",
            onClick = { submit() },
            enabled = !loading,
            modifier = Modifier.fillMaxWidth(),
        )
        AppButton(
            text = if (isRegister) "已有账号？去登录" else "没有账号？去注册",
            onClick = { isRegister = !isRegister; error = null },
            variant = ButtonVariant.Secondary,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
