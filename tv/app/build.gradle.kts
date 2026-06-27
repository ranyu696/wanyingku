plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// 版本可被 -PappVersionName / -PappVersionCode 覆盖（CI 从 tag 注入）
val verName = (project.findProperty("appVersionName") as String?) ?: "1.0"
val verCode = (project.findProperty("appVersionCode") as String?)?.toIntOrNull() ?: 1
// release 签名：CI 提供 keystore 用正式签名，否则回退 debug（侧载可装，便于本地出 release 包）
val releaseKeystore = System.getenv("ANDROID_KEYSTORE_PATH")?.let { file(it) }?.takeIf { it.exists() }

android {
    namespace = "com.wanyingku.tv"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.wanyingku.tv"
        minSdk = 23
        targetSdk = 34
        versionCode = verCode
        versionName = verName

        // API 基址：可被 gradle 命令行 -PapiBase=... 覆盖。末尾必须带 /
        val apiBase = (project.findProperty("apiBase") as String?) ?: "https://api.wanyingku.com/api/v1/"
        buildConfigField("String", "API_BASE", "\"$apiBase\"")
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

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons)
    debugImplementation(libs.androidx.compose.ui.tooling)

    implementation(libs.androidx.tv.material)
    implementation(libs.androidx.navigation.compose)

    implementation(libs.media3.exoplayer)
    implementation(libs.media3.exoplayer.hls)
    implementation(libs.media3.ui)

    implementation(libs.retrofit)
    implementation(libs.retrofit.kotlinx.serialization)
    implementation(libs.okhttp.logging)
    implementation(libs.kotlinx.serialization.json)

    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)
}
