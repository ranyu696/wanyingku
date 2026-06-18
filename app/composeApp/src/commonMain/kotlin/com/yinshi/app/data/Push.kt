package com.yinshi.app.data

// 取本机推送令牌并注册到后端（Android 用 FCM；登录后/启动时调用）。其它平台暂 no-op。
// 仅当「推送开关=开」且已登录时才注册。
expect fun syncPushToken()

// 推送开关偏好（默认开）。关闭时注销本机令牌，开启时重新注册。
expect fun isPushEnabled(): Boolean

expect fun setPushEnabled(enabled: Boolean)
