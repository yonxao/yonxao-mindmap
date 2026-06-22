/*
 * 文件作用：
 * 视口坐标转换纯数学计算。
 *
 * 实现逻辑：
 * 这里不读取 DOM，也不修改 renderer 状态；调用方传入画布局部坐标、viewBox 和画布尺寸后得到导图坐标。
 *
 * 调用链：
 * viewFit.clientPointToSvg() -> viewportMath -> panZoom/topic drag 使用的导图坐标。
 */

/*
 * 作用：
 * 将画布局部像素 x 坐标还原为导图坐标，供指针缩放和主题拖拽使用。
 */
export function canvasToMapX(canvasX, viewBox, canvasWidth) {
  return (canvasX * viewBox.width) / canvasWidth + viewBox.x;
}

/*
 * 作用：
 * 将画布局部像素 y 坐标还原为导图坐标，供指针缩放和主题拖拽使用。
 */
export function canvasToMapY(canvasY, viewBox, canvasHeight) {
  return (canvasY * viewBox.height) / canvasHeight + viewBox.y;
}
