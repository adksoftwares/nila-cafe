package com.adksoftwares.nilacafe.ui.theme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
private val Forest = Color(0xFF176B52)
private val Ink = Color(0xFF17211D)
@Composable fun NilaCafeTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = lightColorScheme(primary=Forest,onPrimary=Color.White,primaryContainer=Color(0xFFE8F3EE),onPrimaryContainer=Ink,secondary=Color(0xFFB67B43),background=Color(0xFFF6F8F6),surface=Color.White,onSurface=Ink,onSurfaceVariant=Color(0xFF75827B),outline=Color(0xFFE4EAE5),error=Color(0xFFB54745)), content=content)
}
