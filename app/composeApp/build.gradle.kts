import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
    alias(libs.plugins.kotlinSerialization)
    alias(libs.plugins.googleServices) // 需 composeApp/google-services.json 才能构建
}

kotlin {
    androidTarget {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_17) // Compose Unstyled 要求 JVM 17
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
        versionCode = 1
        versionName = "0.1.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
        }
    }
}
