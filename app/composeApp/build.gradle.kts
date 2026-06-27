import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
    alias(libs.plugins.kotlinSerialization)
    alias(libs.plugins.googleServices) apply false // FCM 用，缺 google-services.json 时不应用（见下）
}

// FCM 可选：有 google-services.json 才接入 Firebase；缺文件也能正常出包/运行（推送届时失效）。
if (project.file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

// 版本可被 -PappVersionName / -PappVersionCode 覆盖（CI 从 tag 注入）
val verName = (project.findProperty("appVersionName") as String?) ?: "0.1.0"
val verCode = (project.findProperty("appVersionCode") as String?)?.toIntOrNull() ?: 1
// release 签名：CI 提供 keystore 用正式签名，否则回退 debug（侧载可装）
val releaseKeystore = System.getenv("ANDROID_KEYSTORE_PATH")?.let { file(it) }?.takeIf { it.exists() }

kotlin {
    androidTarget {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_17) // Compose Unstyled 要求 JVM 17
            // Downloads 用 expect/actual object（多平台播放器下载入口），抑制其 Beta 提示
            freeCompilerArgs.add("-Xexpect-actual-classes")
        }
    }
    // 以后加 iOS：在这里加 iosX64()/iosArm64()/iosSimulatorArm64()，
    // 并为 player/ 与 Ktor 引擎补 iosMain 的 actual 实现。

    sourceSets {
        commonMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.ui)
            implementation(compose.components.resources)

            implementation(libs.kotlinx.coroutines.core)
            implementation(libs.kotlinx.serialization.json)

            implementation(libs.ktor.client.core)
            implementation(libs.ktor.client.cio)
            implementation(libs.ktor.client.content.negotiation)
            implementation(libs.ktor.serialization.json)

            implementation(libs.coil.compose)
            implementation(libs.coil.network.ktor)

            // Compose Unstyled：headless 组件(core) + 主题(composetheme)
            implementation(libs.composables.core)
            implementation(libs.composables.composetheme)
        }
        androidMain.dependencies {
            implementation(libs.androidx.activity.compose)
            // Media3 / ExoPlayer：播放 m3u8（HLS）
            implementation(libs.media3.exoplayer)
            implementation(libs.media3.exoplayer.hls)
            implementation(libs.media3.ui)
            // 投屏（Chromecast）：Media3 CastPlayer + Cast 框架 + MediaRouter
            implementation(libs.media3.cast)
            implementation(libs.play.services.cast.framework)
            implementation(libs.androidx.mediarouter)
            // 路由式导航（Navigation 3）
            implementation(libs.androidx.navigation3.runtime)
            implementation(libs.androidx.navigation3.ui)
            // token 持久化
            implementation(libs.androidx.datastore.preferences)
            // FCM 推送
            implementation(libs.firebase.messaging)
        }
    }
}

android {
    namespace = "com.yinshi.app"
    compileSdk = libs.versions.android.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "com.yinshi.app"
        minSdk = libs.versions.android.minSdk.get().toInt()
        targetSdk = libs.versions.android.targetSdk.get().toInt()
        versionCode = verCode
        versionName = verName
    }
    signingConfigs {
        if (releaseKeystore != null) {
            create("release") {
                storeFile = releaseKeystore
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }
}
