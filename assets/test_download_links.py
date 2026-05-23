"""
Test download links generation
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from graphs.state import GraphOutput

def test_download_links_format():
    """Test that download links are included in output"""
    print("=" * 60)
    print("Test: Download links in output")
    print("=" * 60)
    
    # Create test output with download links
    test_output = GraphOutput(
        source_code_markdown="/tmp/source_code.md",
        documentation_markdown="/tmp/user_manual.md",
        collection_form_json="/tmp/collection_form.json",
        download_links={
            "source_code_markdown": "https://coze-coding-project.tos.coze.site/xxx/source_code.md",
            "documentation_markdown": "https://coze-coding-project.tos.coze.site/xxx/user_manual.md",
            "collection_form_json": "https://coze-coding-project.tos.coze.site/xxx/collection_form.json"
        }
    )
    
    # Convert to dict
    output_dict = test_output.model_dump()
    
    print(f"\nOutput fields: {list(output_dict.keys())}")
    print(f"\nDownload links:")
    for key, url in output_dict["download_links"].items():
        print(f"  {key}: {url}")
    
    # Check that download_links is present
    if "download_links" in output_dict:
        if isinstance(output_dict["download_links"], dict):
            if len(output_dict["download_links"]) == 3:
                print(f"\n✅ download_links is present and has 3 URLs")
                
                # Check that all URLs start with https://
                all_valid = all(
                    url.startswith("https://") 
                    for url in output_dict["download_links"].values()
                )
                
                if all_valid:
                    print(f"✅ All URLs are valid HTTPS links")
                    return True
                else:
                    print(f"❌ Some URLs are not valid HTTPS links")
                    return False
            else:
                print(f"❌ download_links has {len(output_dict['download_links'])} URLs (expected 3)")
                return False
        else:
            print(f"❌ download_links is not a dict")
            return False
    else:
        print(f"❌ download_links is NOT in output")
        return False

if __name__ == "__main__":
    result = test_download_links_format()
    print("\n" + "=" * 60)
    if result:
        print("🎉 Download links test PASSED!")
        print("\nUsers can download files using these links:")
        print("1. source_code_markdown URL")
        print("2. documentation_markdown URL")
        print("3. collection_form_json URL")
    else:
        print("❌ Download links test FAILED!")
    print("=" * 60)
