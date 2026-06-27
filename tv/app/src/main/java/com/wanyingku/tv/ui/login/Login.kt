package com.wanyingku.tv.ui.login

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wanyingku.tv.Graph
import com.wanyingku.tv.data.Repository
import com.wanyingku.tv.ui.appViewModel
import com.wanyingku.tv.ui.components.M3Dark
import kotlinx.coroutines.launch

class LoginViewModel(private val repo: Repository) : ViewModel() {
    var username by mutableStateOf("")
    var password by mutableStateOf("")
    var nickname by mutableStateOf("")
    var register by mutableStateOf(false)
    var loading by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set

    fun submit(onDone: () -> Unit) {
        if (username.isBlank() || password.isBlank()) { error = "请输入账号和密码"; return }
        loading = true
        error = null
        viewModelScope.launch {
            runCatching {
                if (register) repo.register(username, password, nickname.ifBlank { username })
                else repo.login(username, password)
            }.onSuccess { onDone() }.onFailure { error = it.message ?: "失败" }
            loading = false
        }
    }
}

@Composable
fun LoginScreen(onDone: () -> Unit) {
    val vm = appViewModel { LoginViewModel(Graph.repository) }
    M3Dark {
        Column(
            Modifier.fillMaxSize().padding(48.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(if (vm.register) "注册账号" else "登录万影库", style = androidx.compose.material3.MaterialTheme.typography.headlineMedium)
            OutlinedTextField(value = vm.username, onValueChange = { vm.username = it }, label = { Text("账号") }, singleLine = true, modifier = Modifier.width(420.dp))
            OutlinedTextField(value = vm.password, onValueChange = { vm.password = it }, label = { Text("密码") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.width(420.dp))
            if (vm.register) {
                OutlinedTextField(value = vm.nickname, onValueChange = { vm.nickname = it }, label = { Text("昵称（选填）") }, singleLine = true, modifier = Modifier.width(420.dp))
            }
            vm.error?.let { Text(it, color = androidx.compose.material3.MaterialTheme.colorScheme.error) }
            Button(onClick = { vm.submit(onDone) }, enabled = !vm.loading, modifier = Modifier.width(420.dp)) {
                Text(if (vm.loading) "请稍候…" else if (vm.register) "注册并登录" else "登录")
            }
            TextButton(onClick = { vm.register = !vm.register }) {
                Text(if (vm.register) "已有账号？去登录" else "没有账号？去注册")
            }
        }
    }
}
