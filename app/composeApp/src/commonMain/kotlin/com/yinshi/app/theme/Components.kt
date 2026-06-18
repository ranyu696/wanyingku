package com.yinshi.app.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

// ============================================================================
// 你自己的样式 UI 库：令牌(Tokens) + 这里的有样式封装。
// 当前用 Compose foundation 原语实现（headless，和 Compose Unstyled 同理念），保证可编译。
// 依赖已加好 composeunstyled-button / -text-field，确认导入路径后可把 AppButton/AppTextField
// 的内核替换为 Compose Unstyled 组件（外观仍从令牌取，调用方零改动）。
// ============================================================================

@Composable
fun AppText(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = AppTheme.typography.body,
    color: Color = AppTheme.colors.text,
    maxLines: Int = Int.MAX_VALUE,
) {
    BasicText(
        text = text,
        modifier = modifier,
        style = style.copy(color = color),
        maxLines = maxLines,
        overflow = TextOverflow.Ellipsis,
    )
}

enum class ButtonVariant { Primary, Secondary, Outline }

@Composable
fun AppButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: ButtonVariant = ButtonVariant.Primary,
    enabled: Boolean = true,
) {
    val shape: Shape = RoundedCornerShape(AppTheme.shapes.pill)
    val bg = when (variant) {
        ButtonVariant.Primary -> AppTheme.colors.primary
        ButtonVariant.Secondary -> AppTheme.colors.surfaceVariant
        ButtonVariant.Outline -> Color.Transparent
    }
    val fg = when (variant) {
        ButtonVariant.Primary -> AppTheme.colors.onPrimary
        else -> AppTheme.colors.text
    }
    val base = modifier
        .clip(shape)
        .background(bg)
        .then(if (variant == ButtonVariant.Outline) Modifier.border(1.dp, AppTheme.colors.border, shape) else Modifier)
        .clickable(enabled = enabled, onClick = onClick)
        .padding(horizontal = AppTheme.spacing.lg, vertical = AppTheme.spacing.sm)
    Box(modifier = base, contentAlignment = Alignment.Center) {
        AppText(
            text = text,
            style = AppTheme.typography.label,
            color = if (enabled) fg else AppTheme.colors.textDisabled,
        )
    }
}

@Composable
fun AppChip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape: Shape = RoundedCornerShape(AppTheme.shapes.pill)
    Box(
        modifier = modifier
            .clip(shape)
            .background(if (selected) AppTheme.colors.primary else AppTheme.colors.surfaceVariant)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 6.dp),
    ) {
        AppText(
            text = text,
            style = AppTheme.typography.label,
            color = if (selected) AppTheme.colors.onPrimary else AppTheme.colors.textSecondary,
        )
    }
}

@Composable
fun AppCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    val shape: Shape = RoundedCornerShape(AppTheme.shapes.md)
    val base = modifier
        .clip(shape)
        .background(AppTheme.colors.surface)
        .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
    Box(base) { content() }
}

@Composable
fun AppTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    mask: Boolean = false,
) {
    val shape: Shape = RoundedCornerShape(AppTheme.shapes.pill)
    Box(
        modifier = modifier
            .clip(shape)
            .background(AppTheme.colors.surfaceVariant)
            .padding(horizontal = AppTheme.spacing.lg, vertical = 10.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        if (value.isEmpty()) {
            AppText(placeholder, color = AppTheme.colors.textDisabled)
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            textStyle = AppTheme.typography.body.copy(color = AppTheme.colors.text),
            cursorBrush = SolidColor(AppTheme.colors.primary),
            visualTransformation = if (mask) PasswordVisualTransformation() else VisualTransformation.None,
        )
    }
}

@Composable
fun ChipRow(content: @Composable () -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { content() }
}
