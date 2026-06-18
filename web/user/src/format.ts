// 集数按钮样式：宽度跟随文字（内容自适应），整行排满后自动换到下一行。
//   - minWidth: 0   去掉 MUI Button 默认的 64px 最小宽，短名(正片/HD)不被撑宽
//   - flexShrink: 0 不压缩，保持「第0002集 / 20260304」单行完整
//   - maxWidth+normal 仅当单个标题(如「2026美加墨世界杯开幕式」)超过整行宽时才内部换行，杜绝溢出
export const epBtnSx = {
  minWidth: 64, // 短名(正片/HD)也有体面的大按钮宽度
  minHeight: 46, // 大号、易点
  flexShrink: 0,
  maxWidth: "100%",
  px: 2.25,
  py: 1,
  fontSize: 15,
  fontWeight: 600,
  lineHeight: 1.35,
  whiteSpace: "normal" as const,
  textAlign: "center" as const,
};

// 集数按钮容器：flex 换行，按钮各自按内容取宽，而非等宽网格。
export const epGridSx = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 1.25,
};
