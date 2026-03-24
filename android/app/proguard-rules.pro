# ProGuard / R8 rules for NGO Mitr (Capacitor WebView app)
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ---- Capacitor Framework ----
# Keep all Capacitor classes — bridge, plugins, and annotations
-keep class com.getcapacitor.** { *; }
-keep class org.apache.cordova.** { *; }

# Keep plugin classes loaded by reflection
-keepclassmembers class * extends com.getcapacitor.Plugin {
    public *;
}

# ---- WebView ----
# Keep WebView and JavaScript interface classes
-keep class android.webkit.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ---- AndroidX ----
# Keep AndroidX components used by Capacitor
-keep class androidx.core.content.FileProvider { *; }
-keep class androidx.appcompat.** { *; }

# ---- General ----
# Keep generic signatures and annotations for reflection
-keepattributes Signature, Exceptions, InnerClasses, EnclosingMethod, Deprecated
-keepattributes *Annotation*

# Keep source file names for crash reporting
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Don't warn about missing classes in optional dependencies
-dontwarn org.apache.cordova.**
-dontwarn com.google.android.gms.**
