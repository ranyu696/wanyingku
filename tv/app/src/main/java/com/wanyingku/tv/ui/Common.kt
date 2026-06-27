package com.wanyingku.tv.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.compose.runtime.Composable

// 用全局 Graph 构造 ViewModel，作用域跟随当前导航返回栈条目。
@Composable
inline fun <reified VM : ViewModel> appViewModel(crossinline create: () -> VM): VM =
    viewModel(factory = viewModelFactory { initializer { create() } })

// 通用异步状态：列表/详情屏共用。
data class Loadable<T>(
    val loading: Boolean = true,
    val data: T? = null,
    val error: String? = null,
) {
    companion object {
        fun <T> ok(data: T) = Loadable(loading = false, data = data)
        fun <T> fail(msg: String?) = Loadable<T>(loading = false, error = msg ?: "加载失败")
    }
}
