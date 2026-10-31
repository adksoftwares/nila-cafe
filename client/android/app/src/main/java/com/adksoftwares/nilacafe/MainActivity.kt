package com.adksoftwares.nilacafe

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import com.adksoftwares.nilacafe.ui.NilaCafeApp
import com.adksoftwares.nilacafe.ui.theme.NilaCafeTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContent { NilaCafeTheme { NilaCafeApp() } }
    }
}
