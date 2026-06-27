package com.wanyingku.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.tv.material3.Surface
import com.wanyingku.tv.ui.nav.AppNav
import com.wanyingku.tv.ui.theme.WanYingTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            WanYingTheme {
                Surface(modifier = Modifier.fillMaxSize().background(Color(0xFF0E0E14))) {
                    AppNav()
                }
            }
        }
    }
}
