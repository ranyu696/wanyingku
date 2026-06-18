rootProject.name = "Yinshi"

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral() // Compose Unstyled / Coil / Ktor 都在这
    }
}

include(":composeApp")
