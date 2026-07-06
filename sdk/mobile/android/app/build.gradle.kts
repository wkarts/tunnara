plugins {
    id("com.android.application")
}

val releaseKeystore = System.getenv("TUNNARA_ANDROID_KEYSTORE")?.trim().orEmpty()
val releaseStorePassword = System.getenv("TUNNARA_ANDROID_STORE_PASSWORD")?.trim().orEmpty()
val releaseKeyAlias = System.getenv("TUNNARA_ANDROID_KEY_ALIAS")?.trim().orEmpty()
val releaseKeyPassword = System.getenv("TUNNARA_ANDROID_KEY_PASSWORD")?.trim().orEmpty()
val signingValues = listOf(releaseKeystore, releaseStorePassword, releaseKeyAlias, releaseKeyPassword)
val signingRequested = signingValues.any { it.isNotBlank() }
val releaseSigningReady = signingValues.all { it.isNotBlank() } && file(releaseKeystore).isFile

if (signingRequested && !releaseSigningReady) {
    logger.warn(
        "Assinatura Android incompleta. O build continuará sem assinatura release. " +
            "Configure TUNNARA_ANDROID_KEYSTORE, TUNNARA_ANDROID_STORE_PASSWORD, " +
            "TUNNARA_ANDROID_KEY_ALIAS e TUNNARA_ANDROID_KEY_PASSWORD."
    )
}

android {
    namespace = "br.com.wwsoftwares.tunnara.mobile"
    compileSdk = 35

    defaultConfig {
        applicationId = "br.com.wwsoftwares.tunnara.mobile"
        minSdk = 26
        targetSdk = 35
        versionCode = 200007002
        versionName = "2.0.0-rc.2"
    }

    signingConfigs {
        if (releaseSigningReady) {
            create("releaseFromEnv") {
                storeFile = file(releaseKeystore)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
                enableV4Signing = true
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            if (releaseSigningReady) {
                signingConfig = signingConfigs.getByName("releaseFromEnv")
            }
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }
}

tasks.register("printTunnaraSigningMode") {
    doLast {
        println(if (releaseSigningReady) "SIGNED" else "UNSIGNED")
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.4")
    implementation("com.wireguard.android:tunnel:1.0.20260102")
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
