# kotlinx.serialization：保留生成的序列化器
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class **$$serializer { *; }
-keepclasseswithmembers class com.wanyingku.tv.data.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.wanyingku.tv.data.** { *; }

# Retrofit
-keepattributes Signature, Exceptions
-keep,allowobfuscation interface com.wanyingku.tv.data.Api
