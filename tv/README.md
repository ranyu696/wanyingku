# 万影库 TV（Android TV 客户端）

Kotlin + Jetpack Compose for TV 写的 Android TV 客户端，消费现有 Go 后端
（`/api/v1`，与 web/user、web/admin 同一套 API）。

## 功能

- 首页：横图轮播 + 分类榜单横滑 + 「继续观看」+「为你推荐」（登录后）
- 浏览：类型 / 题材 / 排序筛选 + 无限下拉网格
- 搜索：遥控器输入 + 热搜词
- 详情：英雄横图、线路切换、选集、收藏 / 订阅 / 点赞、相关推荐、评论
  （记住上次线路：进详情/播放默认选中同名线路，续播线路优先）
- 播放：Media3 ExoPlayer 播 HLS，自建 Compose 控制层（D-pad）：**OK** 播放/暂停、
  **← →** 快退/快进 10s、**↑** 打开线路/选集抽屉（多线路切换会保持当前集与进度）；
  续播定位、定时上报进度、自动跳片头/片尾、缓冲转圈、出错可重试
- 我的：收藏 / 历史 / 订阅 / 通知 / 我的求片，登录登出
- 求片广场：列表 + 顶片投票

## 跑起来

需要 Android Studio（Ladybug 或更新）+ Android SDK。

```bash
# 仓库未带 gradle wrapper 二进制，首次生成一次：
cd tv && gradle wrapper --gradle-version 8.9
# 或直接用 Android Studio 打开 tv/，会自动补全 wrapper

./gradlew assembleDebug          # 打 APK
./gradlew installDebug           # 装到已连接的 TV / 模拟器
```

模拟器选 **Android TV (1080p)** 系统镜像；真机用遥控器 D-pad 操作。

## 切后端地址

默认指向生产 `https://api.wanyingku.com/api/v1/`。本地联调：

```bash
./gradlew assembleDebug -PapiBase=http://192.168.1.10:8080/api/v1/
```

末尾的 `/` 必须保留（Retrofit baseUrl 约定）。`debug` 构建已开 `usesCleartextTraffic`，
可直连内网 http 后端。

## 结构

```
app/src/main/java/com/wanyingku/tv/
  Graph.kt / App.kt / MainActivity.kt   入口与极简依赖容器
  data/                                  ApiModels / Api(Retrofit) / Network / TokenStore / Repository
  ui/theme, ui/components, ui/nav        主题、复用组件、导航装配
  ui/home|browse|search|detail|player|login|mine|requests   各功能屏（VM + Composable 同文件）
```

## 已知简化（ponytail）

- 没接 FCM 推送 token 上报与「N 人在看」心跳（后端有接口，TV 端价值低，按需再加）。
- 图标 / 横幅 / 导航栏 logo 复用了 `web/user/public` 的正式品牌图（icon-512.png、logo.png）。

> 已用 `./gradlew assembleDebug`（AGP 9.2.1 / Kotlin 2.2.10 / Gradle 8.14.5）验证可构建，
> 产物 `app/build/outputs/apk/debug/app-debug.apk`。命令行构建需 `JAVA_HOME` 指向
> Android Studio 自带 JBR：`export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`。
