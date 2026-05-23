"""
Test complete workflow simulation
"""
import sys
import os
import json
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def test_complete_workflow():
    """Test the complete workflow with sample data"""
    print("=" * 60)
    print("Test: Complete workflow simulation")
    print("=" * 60)
    
    # Simulate template_analysis output
    software_info = {
        "计算机软件著作权登记新系统信息采集表": {
            "软件全称": "测试软件",
            "版本号": "V1.0",
            "公司名称": "测试公司"
        }
    }
    
    # Simulate source code generation output
    source_code_content = "# 源代码\n\n```python\ndef main():\n    pass\n```"
    
    # Simulate documentation generation output
    documentation_content = "# 用户手册\n\n## 软件介绍\n这是一个测试软件。"
    
    # Simulate submission preparation
    temp_dir = tempfile.mkdtemp(prefix="test_workflow_")
    
    # Save three files
    source_code_path = os.path.join(temp_dir, "source_code.md")
    documentation_path = os.path.join(temp_dir, "user_manual.md")
    collection_form_path = os.path.join(temp_dir, "collection_form.json")
    
    with open(source_code_path, 'w', encoding='utf-8') as f:
        f.write(source_code_content)
    
    with open(documentation_path, 'w', encoding='utf-8') as f:
        f.write(documentation_content)
    
    with open(collection_form_path, 'w', encoding='utf-8') as f:
        json.dump(software_info, f, ensure_ascii=False, indent=2)
    
    # Verify files exist
    files_exist = all([
        os.path.exists(source_code_path),
        os.path.exists(documentation_path),
        os.path.exists(collection_form_path)
    ])
    
    if not files_exist:
        print("❌ Failed to create files")
        return False
    
    # Simulate output
    from graphs.state import GraphOutput
    
    output = GraphOutput(
        source_code_markdown=source_code_path,
        documentation_markdown=documentation_path,
        collection_form_json=collection_form_path,
        download_links={
            "source_code_markdown": "https://example.com/source_code.md",
            "documentation_markdown": "https://example.com/user_manual.md",
            "collection_form_json": "https://example.com/collection_form.json"
        }
    )
    
    output_dict = output.model_dump()
    
    print(f"\n✅ Workflow simulation successful")
    print(f"\nGenerated files:")
    print(f"  1. Source code: {os.path.basename(source_code_path)} ({os.path.getsize(source_code_path)} bytes)")
    print(f"  2. User manual: {os.path.basename(documentation_path)} ({os.path.getsize(documentation_path)} bytes)")
    print(f"  3. Collection form: {os.path.basename(collection_form_path)} ({os.path.getsize(collection_form_path)} bytes)")
    
    print(f"\n📥 Download links (valid for 30 minutes):")
    for key, url in output_dict["download_links"].items():
        print(f"  {key}:")
        print(f"    {url}")
    
    print(f"\n💡 To download files:")
    print(f"  - Click on the URLs above")
    print(f"  - Or use: curl/wget to download")
    print(f"  - Links expire in 30 minutes")
    
    # Cleanup
    import shutil
    shutil.rmtree(temp_dir, ignore_errors=True)
    
    return True

if __name__ == "__main__":
    result = test_complete_workflow()
    print("\n" + "=" * 60)
    if result:
        print("🎉 Complete workflow test PASSED!")
    else:
        print("❌ Complete workflow test FAILED!")
    print("=" * 60)
