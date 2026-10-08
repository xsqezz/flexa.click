import java.net.URI
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
}

val versionProperties = Properties().apply {
    rootProject.file("version.properties").inputStream().use { load(it) }
}

/** Lokalny plik z hasłami klucza (zob. scripts/android-signing.mjs); w CI klucz idzie ze zmiennych środowiskowych. */
val localSigning = Properties().apply {
    val file = System.getenv("FLEXA_SIGNING_FILE")
        ?: "${System.getProperty("user.home")}/.flexa/android-signing/signing.properties"
    rootProject.file(file).takeIf { it.isFile }?.inputStream()?.use { load(it) }
}

fun setting(name: String): String? =
    System.getenv(name)?.takeIf { it.isNotBlank() }
        ?: providers.gradleProperty(name).orNull?.takeIf { it.isNotBlank() }
        ?: localSigning.getProperty(name)?.takeIf { it.isNotBlank() }

val appVersionName: String = setting("flexa.versionName") ?: versionProperties.getProperty("VERSION_NAME")
val appVersionCode: Int = (setting("flexa.versionCode") ?: versionProperties.getProperty("VERSION_CODE")).toInt()

val repository = setting("flexa.repository") ?: "xsqezz/flexa.click"
val appUrl = (setting("flexa.appUrl") ?: "https://flexa-click.pages.dev").trimEnd('/')
val updateManifestUrl = setting("flexa.updateManifestUrl")
    ?: "https://github.com/$repository/releases/latest/download/update.json"
val updateUrlPrefix = setting("flexa.updateUrlPrefix")
    ?: "https://github.com/$repository/releases/download/"
val downloadPageUrl = "https://github.com/$repository/releases/latest/download/flexa.apk"

android {
    namespace = "click.flexa.app"
    compileSdk = 37

    defaultConfig {
        applicationId = "click.flexa.app"
        minSdk = 26
        targetSdk = 36
        versionCode = appVersionCode
        versionName = appVersionName

        buildConfigField("String", "APP_URL", "\"$appUrl\"")
        buildConfigField("String", "UPDATE_MANIFEST_URL", "\"$updateManifestUrl\"")
        buildConfigField("String", "UPDATE_URL_PREFIX", "\"$updateUrlPrefix\"")
        buildConfigField("String", "DOWNLOAD_PAGE_URL", "\"$downloadPageUrl\"")
        manifestPlaceholders["appHost"] = URI(appUrl).host
    }

    buildFeatures {
        buildConfig = true
    }

    androidResources {
        localeFilters += listOf("pl", "en")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    signingConfigs {
        val keystore = setting("FLEXA_KEYSTORE_FILE")
        if (keystore != null) {
            create("release") {
                storeFile = file(keystore)
                storePassword = setting("FLEXA_KEYSTORE_PASSWORD")
                keyAlias = setting("FLEXA_KEY_ALIAS")
                keyPassword = setting("FLEXA_KEY_PASSWORD")
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release")
                ?: if (setting("flexa.allowDebugSigning") != null) signingConfigs.getByName("debug") else null
        }
    }

    lint {
        abortOnError = true
        warningsAsErrors = false
        // targetSdk 36 jest świadomym wyborem: najnowszy system, który testujemy na emulatorze.
        disable += "OldTargetApi"
    }
}

gradle.taskGraph.whenReady {
    val releasing = allTasks.any { it.path == ":app:assembleRelease" || it.path == ":app:packageRelease" }
    if (releasing) {
        check(android.buildTypes.getByName("release").signingConfig != null) {
            "Brak klucza podpisującego. Ustaw FLEXA_KEYSTORE_FILE, FLEXA_KEYSTORE_PASSWORD, FLEXA_KEY_ALIAS i " +
                "FLEXA_KEY_PASSWORD (zmienne środowiskowe albo ~/.gradle/gradle.properties); zob. docs/ANDROID.md."
        }
    }
}

dependencies {
    implementation(libs.androidx.activity)
    implementation(libs.androidx.core)
    implementation(libs.androidx.splashscreen)
    implementation(libs.androidx.webkit)

    testImplementation(libs.junit)
    testImplementation(libs.org.json)
}
