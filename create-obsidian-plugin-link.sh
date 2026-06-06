#!/bin/bash

# ==============================================================================
# 脚本名称：
#   create-obsidian-plugin-link.sh
#
# 注意事项：
#   - 运行脚本前，建议先完全退出 Obsidian。
#   - macOS Finder 的“替身”不是标准 Unix 软链接，Obsidian 通常无法识别为插件目录。
#   - 因此，本脚本通过 ln -s 创建真正的符号链接。
#   - 如果目标位置已经存在同名软链接，脚本会删除旧软链接并重新创建。
#
# 脚本作用：
#   为 Obsidian 插件开发创建软链接。
#
# 使用场景：
#   当 Obsidian 插件的源码目录或编译输出目录不在 Obsidian 的插件目录中时，
#   可以使用本脚本把“插件编译目录 dist”软链接到 Obsidian 的插件目录下。
#
#   这样 Obsidian 会认为插件位于：
#
#     <Vault 路径>/.obsidian/plugins/<插件 ID>
#
#   但实际文件仍然保存在你的开发目录中，例如：
#
#     /Users/yonxao/develop/code/plugin/yonxao-mindmap/dist
#
# 最终效果：
#   本脚本会创建类似下面的软链接：
#
#     /Users/yonxao/Documents/YxNotes/.obsidian/plugins/yonxao-mindmap
#       -> /Users/yonxao/develop/code/plugin/yonxao-mindmap/dist
#
# Obsidian 插件目录结构要求：
#   Obsidian 需要能在插件目录下直接读取到以下文件：
#
#     manifest.json
#     main.js
#     styles.css
#
#   其中 styles.css 不是所有插件都必须有，但 manifest.json 和 main.js 通常是必须的。
#
# 支持的使用方式：
#   1. 固定参数模式：
#      在脚本顶部填写 PLUGIN_ID、DIST_DIR、OBSIDIAN_PLUGINS_DIR。
#      运行脚本时会直接使用这些值。
#
#   2. 交互输入模式：
#      如果脚本顶部的某些参数为空，脚本会在运行时提示你输入。
#
# 注意事项：
#   - 运行脚本前，建议先完全退出 Obsidian。
#   - 如果目标位置已经存在同名软链接，脚本会删除旧软链接并重新创建。
#   - 如果目标位置已经存在同名真实文件或目录，脚本会询问是否备份后继续。
#   - 脚本不会直接删除已有真实目录，而是移动到带时间戳的 backup 目录。
#
# 当前插件示例：
#   插件 ID：
#     yonxao-mindmap
#
#   插件编译目录：
#     /Users/yonxao/develop/code/plugin/yonxao-mindmap/dist
#
#   Obsidian 插件目录：
#     /Users/yonxao/Documents/YxNotes/.obsidian/plugins
#
# 使用方法：
#   chmod +x create-obsidian-plugin-link.sh
#   ./create-obsidian-plugin-link.sh
#
# ==============================================================================

# 一旦脚本中任意命令执行失败，立即退出。
# 这样可以避免在路径错误、文件缺失等情况下继续执行，造成误操作。
set -e

# ==============================================================================
# 1. 可选预设参数
# ==============================================================================
#
# 如果下面三个变量都填写了值，脚本会直接使用这些值。
# 如果某个变量留空，脚本会在运行时提示你输入。
#
# 示例：
#   PLUGIN_ID="yonxao-mindmap"
#
# 留空示例：
#   PLUGIN_ID=""
#
# ------------------------------------------------------------------------------

# 插件 ID。
# 这个值建议与 manifest.json 里的 "id" 保持一致。
# 同时它也会作为 Obsidian 插件目录下的文件夹名或软链接名。
PLUGIN_ID="yonxao-mindmap"

# 插件编译输出目录。
# 这个目录里应该直接包含 manifest.json、main.js、styles.css。
# 注意：这里应该填写 dist 目录，而不是插件源码根目录。
DIST_DIR="/Users/yonxao/develop/code/plugin/yonxao-mindmap/dist"

# Obsidian 当前 Vault 的第三方插件目录。
# 一般路径格式是：
#   <Vault 路径>/.obsidian/plugins
OBSIDIAN_PLUGINS_DIR="/Users/yonxao/Documents/YxNotes/.obsidian/plugins"

# ==============================================================================
# 2. 工具函数：当变量为空时，提示用户输入
# ==============================================================================
#
# 参数说明：
#   $1：变量名，例如 PLUGIN_ID
#   $2：提示文案，例如 请输入插件 ID
#
# 工作逻辑：
#   - 读取指定变量当前的值。
#   - 如果变量已有值，则不做任何事。
#   - 如果变量为空，则提示用户输入。
#   - 如果用户输入仍为空，则终止脚本。
#
# ------------------------------------------------------------------------------

ask_if_empty() {
  local var_name="$1"
  local prompt_text="$2"
  local current_value="${!var_name}"

  if [ -z "${current_value}" ]; then
    read -r -p "${prompt_text}: " input_value

    if [ -z "${input_value}" ]; then
      echo "错误：${prompt_text} 不能为空"
      exit 1
    fi

    printf -v "${var_name}" "%s" "${input_value}"
  fi
}

# ==============================================================================
# 3. 工具函数：二次确认
# ==============================================================================
#
# 参数说明：
#   $1：确认提示文案
#
# 返回结果：
#   输入 y / Y / yes / YES 时，返回成功。
#   其他输入都视为否。
#
# 使用场景：
#   - 创建软链接前，让用户确认配置是否正确。
#   - 遇到已有真实目录时，确认是否备份并继续。
#
# ------------------------------------------------------------------------------

confirm() {
  local prompt_text="$1"

  read -r -p "${prompt_text} [y/N]: " answer

  case "${answer}" in
    y|Y|yes|YES)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

# ==============================================================================
# 4. 交互式补全参数
# ==============================================================================
#
# 如果顶部配置中的变量为空，这里会提示用户输入。
# 如果顶部配置已经填写，则这里不会打断用户。
#
# ------------------------------------------------------------------------------

ask_if_empty "PLUGIN_ID" "请输入插件 ID，例如 yonxao-mindmap"
ask_if_empty "DIST_DIR" "请输入插件编译目录，例如 /Users/yonxao/develop/code/plugin/yonxao-mindmap/dist"
ask_if_empty "OBSIDIAN_PLUGINS_DIR" "请输入 Obsidian 插件目录，例如 /Users/yonxao/Documents/YxNotes/.obsidian/plugins"

# 目标软链接路径。
# 例如：
#   /Users/yonxao/Documents/YxNotes/.obsidian/plugins/yonxao-mindmap
TARGET_LINK="${OBSIDIAN_PLUGINS_DIR}/${PLUGIN_ID}"

# ==============================================================================
# 5. 展示当前配置，并请求确认
# ==============================================================================
#
# 在真正修改文件系统之前，先展示关键路径。
# 这样可以避免误把软链接创建到错误的 Vault 或错误的插件目录。
#
# ------------------------------------------------------------------------------

echo ""
echo "即将创建 Obsidian 插件软链接："
echo ""
echo "插件 ID：${PLUGIN_ID}"
echo "编译目录：${DIST_DIR}"
echo "Obsidian 插件目录：${OBSIDIAN_PLUGINS_DIR}"
echo "目标软链接：${TARGET_LINK}"
echo ""

if ! confirm "确认继续吗？"; then
  echo "已取消。"
  exit 0
fi

# ==============================================================================
# 6. 基础检查
# ==============================================================================
#
# 检查 dist 目录是否存在，以及 Obsidian 插件所需的关键文件是否存在。
#
# 必要文件：
#   - manifest.json
#   - main.js
#
# 可选文件：
#   - styles.css
#
# ------------------------------------------------------------------------------

if [ ! -d "${DIST_DIR}" ]; then
  echo "错误：编译目录不存在：${DIST_DIR}"
  exit 1
fi

if [ ! -f "${DIST_DIR}/manifest.json" ]; then
  echo "错误：编译目录中缺少 manifest.json"
  exit 1
fi

if [ ! -f "${DIST_DIR}/main.js" ]; then
  echo "错误：编译目录中缺少 main.js"
  exit 1
fi

if [ ! -f "${DIST_DIR}/styles.css" ]; then
  echo "提示：编译目录中没有 styles.css，如果你的插件不需要样式文件，可以忽略。"
fi

# 如果 Obsidian 插件目录不存在，则自动创建。
# 正常情况下 .obsidian/plugins 应该已经存在；
# 这里保留 mkdir -p 是为了增强脚本容错性。
mkdir -p "${OBSIDIAN_PLUGINS_DIR}"

# ==============================================================================
# 7. 处理已有目标
# ==============================================================================
#
# 目标路径可能存在三种情况：
#
#   1. 不存在：
#      直接创建软链接。
#
#   2. 已经是软链接：
#      删除旧软链接，然后重新创建。
#
#   3. 是真实文件或真实目录：
#      不直接删除，而是询问是否备份后继续。
#
# 这样设计的原因：
#   - 旧软链接通常可以安全删除。
#   - 真实目录可能包含重要文件，所以只做备份移动，不做直接删除。
#
# ------------------------------------------------------------------------------

if [ -L "${TARGET_LINK}" ]; then
  echo ""
  echo "发现已有软链接，正在删除：${TARGET_LINK}"
  rm "${TARGET_LINK}"
elif [ -e "${TARGET_LINK}" ]; then
  echo ""
  echo "发现已有同名文件或目录：${TARGET_LINK}"

  BACKUP_PATH="${TARGET_LINK}.backup.$(date +%Y%m%d-%H%M%S)"

  echo "将备份到：${BACKUP_PATH}"

  if confirm "是否备份并继续？"; then
    mv "${TARGET_LINK}" "${BACKUP_PATH}"
    echo "已备份：${BACKUP_PATH}"
  else
    echo "已取消。"
    exit 0
  fi
fi

# ==============================================================================
# 8. 创建软链接
# ==============================================================================
#
# 创建软链接后，Obsidian 会在 plugins 目录下看到一个名为插件 ID 的目录。
# 实际上这个目录指向插件的 dist 编译目录。
#
# ------------------------------------------------------------------------------

ln -s "${DIST_DIR}" "${TARGET_LINK}"

# ==============================================================================
# 9. 输出结果和检查信息
# ==============================================================================
#
# 输出三部分信息：
#
#   1. 软链接本身
#   2. Obsidian 视角下能看到的插件文件
#   3. manifest.json 内容
#
# 如果这里能正常看到 manifest.json 和 main.js，
# 说明文件系统层面的软链接已经创建成功。
#
# ------------------------------------------------------------------------------

echo ""
echo "软链接创建完成："
ls -la "${TARGET_LINK}"

echo ""
echo "Obsidian 视角下的插件文件："
ls -la "${TARGET_LINK}/"

echo ""
echo "manifest.json 内容："
cat "${TARGET_LINK}/manifest.json"

echo ""
echo "完成。请完全退出并重新打开 Obsidian。"