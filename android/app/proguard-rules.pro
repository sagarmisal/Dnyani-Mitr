# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Keep Capacitor Bridge classes
-keep class com.getcapacitor.** { *; }
-keepclassmembers class com.getcapacitor.Bridge {
    public *;
}

# Keep all WebView related classes
-keep class android.webkit.** { *; }

# Keep generic signatures and annotations
-keepattributes Signature, Exceptions, InnerClasses, EnclosingMethod, Deprecated

# Keep source file names for debugging
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
