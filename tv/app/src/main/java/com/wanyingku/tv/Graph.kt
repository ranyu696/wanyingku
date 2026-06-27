package com.wanyingku.tv

import android.content.Context
import com.wanyingku.tv.data.Network
import com.wanyingku.tv.data.Repository
import com.wanyingku.tv.data.TokenStore

// 极简手动依赖容器：一个仓库走天下，省掉 Hilt 那套样板。
object Graph {
    lateinit var tokenStore: TokenStore
        private set
    lateinit var repository: Repository
        private set

    fun init(context: Context) {
        tokenStore = TokenStore(context.applicationContext)
        repository = Repository(Network.create(tokenStore), tokenStore)
    }
}
