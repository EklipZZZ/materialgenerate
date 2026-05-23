import streamlit as st
import os
# 导入封装的函数名
from code_convert import code_convert_main
from manual_convert import manual_convert_main

st.set_page_config(page_title="软著材料生成器", layout="centered")
st.title("🛡️ 软著材料自动化工具平台")

# 预设模板路径（如果你的 test_file 文件夹里有这个文件，它会自动识别）
DEFAULT_TEMPLATE = "template.docx"

with st.sidebar:
    st.header("1. 基础信息配置")
    soft_name = st.text_input("软件名称", value="我的智能应用")
    version = st.text_input("版本号", value="V1.0")
    
    st.header("2. 功能选择")
    mode = st.radio("生成目标：", ["用户手册", "源代码"])

    # --- 新增：封面模板设置 ---
    st.header("3. 模板配置")
    use_custom_cover = st.checkbox("使用自定义封面模板", value=os.path.exists(DEFAULT_TEMPLATE))
    
    cover_file = None
    if use_custom_cover:
        cover_file = st.file_uploader("上传封面模板 (.docx)", type=['docx'])
        if not cover_file and os.path.exists(DEFAULT_TEMPLATE):
            st.info(f"已检测到本地默认模板：{DEFAULT_TEMPLATE}")

# 上传待转换的主文件
uploaded_file = st.file_uploader(f"上传要转换的 {mode} 内容 (.md 或 .py)", type=['md', 'py', 'txt'])

if uploaded_file:
    input_path = "temp_input.md"
    output_path = "result.docx"
    cover_path = None # 初始化封面路径
    
    # 写入上传内容
    with open(input_path, "wb") as f:
        f.write(uploaded_file.getbuffer())

    if st.button(f"🚀 开始生成 {mode} 文档"):
        try:
            with st.spinner("正在排版并套用模板，请稍后..."):
                if mode == "用户手册":
                    # 处理封面逻辑
                    if cover_file:
                        # 如果用户手动上传了新模板，保存它
                        cover_path = "temp_cover.docx"
                        with open(cover_path, "wb") as f:
                            f.write(cover_file.getbuffer())
                    elif os.path.exists(DEFAULT_TEMPLATE):
                        # 如果没上传但本地有 template.docx，就用本地的
                        cover_path = DEFAULT_TEMPLATE
                    
                    # --- 核心调用修改：传入 cover 参数 ---
                    manual_convert_main(
                        input_md=input_path, 
                        output_docx=output_path, 
                        software_name=soft_name, 
                        version=version, 
                        cover=cover_path  # 这里把封面路径传给你的函数
                    )
                else:
                    # 源代码模式（通常不需要封面，直接调用）
                    code_convert_main(input_path, output_path, soft_name, version)

            # 读取生成的 Word 提供下载
            with open(output_path, "rb") as f:
                st.download_button(
                    label="📥 点击下载带封面的 Word 文档",
                    data=f,
                    file_name=f"{soft_name}_{mode}_{version}.docx",
                    mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                )
            st.success("转换完成！封面已自动嵌入并替换信息。")
            
        except Exception as e:
            st.error(f"发生错误：{e}")
            import traceback
            st.code(traceback.format_exc()) # 显示详细报错方便排查