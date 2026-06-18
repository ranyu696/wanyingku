package com.yinshi.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.yinshi.app.data.Api
import com.yinshi.app.data.Session
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

private const val PUSH_CHANNEL = "yinshi_push"

class AppFirebaseMessagingService : FirebaseMessagingService() {

    // 设备令牌刷新：已登录则立即同步到后端
    override fun onNewToken(token: String) {
        if (Session.isLoggedIn) {
            CoroutineScope(Dispatchers.IO).launch {
                runCatching { Api().registerPushToken(token) }
            }
        }
    }

    // 前台收到消息时自行弹通知（后台时系统托盘自动展示 notification 负载）
    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title ?: message.data["title"] ?: "万影库"
        val body = message.notification?.body ?: message.data["body"] ?: ""
        val nm = getSystemService(NotificationManager::class.java) ?: return
        if (nm.getNotificationChannel(PUSH_CHANNEL) == null) {
            nm.createNotificationChannel(
                NotificationChannel(PUSH_CHANNEL, "更新提醒", NotificationManager.IMPORTANCE_DEFAULT),
            )
        }
        val pi = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_SINGLE_TOP },
            PendingIntent.FLAG_IMMUTABLE,
        )
        val notif = Notification.Builder(this, PUSH_CHANNEL)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()
        nm.notify(System.currentTimeMillis().toInt(), notif)
    }
}
