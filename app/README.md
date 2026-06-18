# 影视 App（Compose Multiplatform 起步骨架）

用 **Compose Multiplatform + Compose Unstyled 理念的自建设计系统**，打现有 Go 后端（`/api/v1`）。
当前只开 **Android** 目标，工程结构按 CMP 组织，方便以后加 iOS/Desktop。

## 跑起来

前置：Android Studio（Ladybug 及以上）、JDK 17、Android SDK 35、一个模拟器或真机。

1. **启动 Go 后端**（在仓库根目录）：`./bin/server` 或 `make run`，确认 `http://localhost:8080/api/v1/home` 有数据。
2. **配置后端地址**（`composeApp/.../data/Api.kt` 的 `BASE_URL`）：
   - 模拟器：默认 `http://10.0.2.2:8080/api/v1`（`10.0.2.2` = 模拟器访问宿主机 localhost），**无需改**。
   - 真机：改成你电脑局域网 IP（如 `http://192.168.1.10:8080/api/v1`）；或 `adb reverse tcp:8080 tcp:8080` 后用 `http://127.0.0.1:8080/api/v1`。
3. Android Studio 打开 **`app/` 目录**（不是仓库根），等 Gradle sync，选模拟器 **Run**。
   - 首次 sync 若版本报红，按提示把 `gradle/libs.versions.toml` 里的版本升到最新即可。

## 结构

```
app/
├─ settings.gradle.kts / build.gradle.kts / gradle.properties
├─ gradle/libs.versions.toml        # 版本目录（依赖都在这调）
└─ composeApp/
   ├─ build.gradle.kts              # KMP + Android + Compose + Ktor + Media3
   └─ src/
      ├─ commonMain/kotlin/com/yinshi/app/
      │  ├─ App.kt                  # 主题 + 极简导航(首页↔详情) + Coil 图片加载器
      │  ├─ theme/                  # ★ 你的样式 UI 库
      │  │  ├─ Tokens.kt            #   颜色/字体/圆角/间距 令牌（沿用网页端品牌色）
      │  │  ├─ Theme.kt             #   AppTheme 注入 + AppTheme.colors/.spacing 取值入口
      │  │  └─ Components.kt        #   AppText/AppButton/AppChip/AppCard/AppTextField
      │  ├─ data/
      │  │  ├─ Models.kt            #   对齐 Go {code,message,data} 信封的 DTO
      │  │  └─ Api.kt               #   Ktor 客户端：home/titles/search/detail
      │  ├─ player/VideoPlayer.kt   #   expect（多平台播放器入口）
      │  └─ ui/
      │     ├─ HomeScreen.kt        #   横图 banner + 分类横排
      │     ├─ DetailScreen.kt      #   详情 + 线路/选集 + 内嵌播放器
      │     └─ components/PosterCard.kt
      └─ androidMain/
         ├─ AndroidManifest.xml     # INTERNET + usesCleartextTraffic
         ├─ kotlin/.../MainActivity.kt
         ├─ kotlin/.../player/VideoPlayer.android.kt  # actual：Media3/ExoPlayer 播 m3u8
         └─ res/values/{strings,themes}.xml
```

## 设计系统（重点）

「样式 UI 库」= `theme/Tokens.kt`（令牌）+ `theme/Components.kt`（有样式封装）。
所有外观从令牌取，**一处改、全局变**。组件目前用 Compose foundation 原语实现（`clickable`/`BasicText`/
`BasicTextField`，和 Compose Unstyled 同一 headless 理念），保证开箱可编译。

依赖里已加好 **`com.composables:core`**（Compose Unstyled 的 headless 组件，import `com.composables.core.*`，
含 `Button`/`TextField`/`Dialog` 等）和 `com.composables:composetheme`（主题）。想换成 Compose Unstyled 原生组件：
打开 `Components.kt`，把 `AppButton`/`AppTextField` 的内核换成 `com.composables.core.Button`/`TextField`
（外观仍从 `AppTheme.*` 令牌取，**调用方零改动**），AS 自动导入会补全。

> 注：你贴的 `composeunstyled-button / -theming / ...` 拆分坐标目前 Maven Central 查不到（应是官网新版命名，尚未发布到索引）；
> 已改用现存的 `com.composables:core:1.36.1`。等新坐标发布后，按官网在 `libs.versions.toml` 里替换即可。

## 已实现 / 待办

- ✅ 底部导航（首页 / 分类 / 搜索 / 我的）+ 详情 / 登录 / 求片 覆盖层
- ✅ 首页（banner + 分类横排）、详情（多线路切换 + 选集）、**Media3 播 m3u8**、Coil 海报
- ✅ 设计系统（Tokens + Components，含密码掩码 TextField）
- ✅ 搜索页（防抖 + 网格）
- ✅ 登录/注册 + JWT 自动注入 + **token 持久化（DataStore，重启免登录）**
- ✅ 我的页（继续观看 + 我的收藏）、详情页**收藏开关 + 订阅追更开关**
- ✅ 播放**进度回传**（每 5s）+ **续播** + **自动下一集**
- ✅ **分类 / 排行榜页**（题材 + 排序：热门/最新/高分/最赞）
- ✅ **求片广场**（列表 + 顶片投票 + 我要求片）
- ⬜ 记忆上次线路、骨架屏、edge-to-edge 细化、排行榜 podium 样式
- （按需）iOS/Desktop 目标：不做

## 注意

- 本骨架在无 Android SDK 的环境里**未经编译**，是结构正确、可直接 AS 同步运行的脚手架；首次 sync 时按提示微调版本。
- **版本兼容**：工具链已升到 AGP 9.2.1 / Kotlin 2.2.10 / Gradle 9.4.1。Kotlin 2.2.x 目前**只有 Compose Multiplatform 1.9.0-alpha 支持**（无稳定版），故 `compose` 用了 `1.9.0-alpha02`；序列化用 1.9.0。若想全用稳定版，把 Kotlin 退回 2.1.21 + `compose` 回 1.8.2 即可。
- Compose Unstyled 真实坐标是 `com.composables:core`（组件都在 `com.composables.core.*`）。
- **minSdk = 30**：Ktor 3.2.0 内含带空格的成员名（`io.ktor.client.plugins.Messages`），dex 需 DEX 040（minSdk≥30），否则 R8 报 "Space characters in SimpleName ... not allowed"。若必须支持 Android 11 以下，把 Ktor 退到 3.1.x 即可改回 minSdk 26。
- `gradle.properties` 里保留了 `android.newDsl=false` / `android.builtInKotlin=false`（AGP 9 + KMP + Compose-alpha 必需）；其余升级助手加的废弃开关已删。
- Go 后端是 http、m3u8 多为 http，已开 `usesCleartextTraffic`；上线走 https 后可收紧。
